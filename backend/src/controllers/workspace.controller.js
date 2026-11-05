import { createHash, randomBytes } from "node:crypto";
import Workspace from "../models/Workspace.js";
import User from "../models/User.js";
import { emailService } from "../lib/email.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const invitationLifetime = 7 * 24 * 60 * 60 * 1000;
const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("hex");

const userId = (user) => String(user?._id ?? user);
const workspaceResponse = (workspace, currentUser) => {
  const ownerId = userId(workspace.owner);
  const isOwner = ownerId === userId(currentUser);

  return {
    id: userId(workspace._id),
    name: workspace.name,
    owner: ownerId,
    members: (workspace.members ?? []).map(({ user, role }) => ({
      id: userId(user),
      ...(user?.firstName && { firstName: user.firstName }),
      ...(user?.lastName && { lastName: user.lastName }),
      ...(user?.email && { email: user.email }),
      role,
    })),
    invitations: isOwner
      ? (workspace.invitations ?? [])
          .filter((invitation) => invitation.expiresAt > new Date())
          .map((invitation) => ({
            id: userId(invitation._id),
            email: invitation.email,
            expiresAt: invitation.expiresAt,
          }))
      : [],
  };
};

export const createWorkspaceController = ({
  WorkspaceModel = Workspace,
  UserModel = User,
  mailer = emailService,
} = {}) => {
  const list = async (req, res) => {
    try {
      const workspaces = await WorkspaceModel.find({
        "members.user": req.user._id,
      })
        .sort({ createdAt: 1 })
        .populate("members.user", "firstName lastName email");
      return res.status(200).json({
        workspaces: workspaces.map((workspace) =>
          workspaceResponse(workspace, req.user),
        ),
      });
    } catch (error) {
      console.error("Could not load workspaces.", error);
      return res.status(500).json({ error: "Could not load workspaces." });
    }
  };

  const create = async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (name.length < 2 || name.length > 80) {
      return res
        .status(400)
        .json({ error: "Workspace name must be 2 to 80 characters." });
    }

    try {
      const workspace = await WorkspaceModel.create({
        name,
        owner: req.user._id,
        members: [{ user: req.user._id, role: "owner" }],
      });
      return res
        .status(201)
        .json({ workspace: workspaceResponse(workspace, req.user) });
    } catch (error) {
      console.error("Could not create workspace.", error);
      return res.status(500).json({ error: "Could not create workspace." });
    }
  };

  const invite = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (email.length > 254 || !emailPattern.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    try {
      const workspace = await WorkspaceModel.findOne({
        _id: req.params.workspaceId,
        owner: req.user._id,
      });
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found." });
      }

      const invitedUser = await UserModel.findOne({ email });
      if (
        invitedUser &&
        workspace.members.some(
          (member) => userId(member.user) === userId(invitedUser),
        )
      ) {
        return res
          .status(409)
          .json({ error: "That user is already a workspace member." });
      }

      if (
        workspace.invitations.some(
          (invitation) =>
            invitation.email === email && invitation.expiresAt > new Date(),
        )
      ) {
        return res
          .status(409)
          .json({ error: "A pending invitation already exists for that email." });
      }

      const token = newToken();
      const invitationId = randomBytes(12).toString("hex");
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + invitationLifetime);
      const updatedWorkspace = await WorkspaceModel.findOneAndUpdate(
        {
          _id: req.params.workspaceId,
          owner: req.user._id,
          invitations: {
            $not: {
              $elemMatch: { email, expiresAt: { $gt: new Date() } },
            },
          },
        },
        {
          $push: {
            invitations: { _id: invitationId, email, tokenHash, expiresAt },
          },
        },
        { new: true, runValidators: true },
      );
      if (!updatedWorkspace) {
        return res
          .status(409)
          .json({ error: "A pending invitation already exists for that email." });
      }

      try {
        await mailer.sendWorkspaceInvitationEmail({
          email,
          token,
        });
      } catch (error) {
        console.error("Could not send workspace invitation email.", error?.name);
        try {
          await WorkspaceModel.updateOne(
            { _id: req.params.workspaceId, owner: req.user._id },
            { $pull: { invitations: { tokenHash } } },
          );
        } catch (cleanupError) {
          console.error(
            "Could not remove unsent workspace invitation.",
            cleanupError?.name,
          );
        }
        return res
          .status(503)
          .json({ error: "Could not send the invitation email." });
      }

      return res.status(201).json({
        invitation: {
          id: invitationId,
          email,
          expiresAt,
        },
      });
    } catch (error) {
      console.error("Could not create workspace invitation.", error?.name);
      return res
        .status(500)
        .json({ error: "Could not create the workspace invitation." });
    }
  };

  const revokeInvitation = async (req, res) => {
    try {
      const result = await WorkspaceModel.updateOne(
        {
          _id: req.params.workspaceId,
          owner: req.user._id,
          invitations: {
            $elemMatch: {
              _id: req.params.invitationId,
              expiresAt: { $gt: new Date() },
            },
          },
        },
        { $pull: { invitations: { _id: req.params.invitationId } } },
      );
      if (!result.modifiedCount) {
        return res.status(404).json({ error: "Pending invitation not found." });
      }
      return res.status(200).json({ message: "Invitation revoked." });
    } catch (error) {
      console.error("Could not revoke workspace invitation.", error?.name);
      return res
        .status(500)
        .json({ error: "Could not revoke the workspace invitation." });
    }
  };

  const acceptInvitation = async (req, res) => {
    const { token } = req.body ?? {};
    if (typeof token !== "string" || !/^[a-f\d]{64}$/i.test(token)) {
      return res.status(400).json({ error: "A valid invitation token is required." });
    }

    try {
      const tokenHash = hashToken(token);
      const result = await WorkspaceModel.updateOne(
        {
          invitations: {
            $elemMatch: {
              tokenHash,
              email: normalizeEmail(req.user.email),
              expiresAt: { $gt: new Date() },
            },
          },
          members: { $not: { $elemMatch: { user: req.user._id } } },
        },
        {
          $push: { members: { user: req.user._id, role: "member" } },
          $pull: { invitations: { tokenHash } },
        },
      );
      if (!result.modifiedCount) {
        return res
          .status(400)
          .json({ error: "Invitation link is invalid or expired." });
      }
      return res.status(200).json({ message: "Workspace invitation accepted." });
    } catch (error) {
      console.error("Could not accept workspace invitation.", error?.name);
      return res
        .status(500)
        .json({ error: "Could not accept the workspace invitation." });
    }
  };

  const removeMember = async (req, res) => {
    try {
      const result = await WorkspaceModel.updateOne(
        {
          _id: req.params.workspaceId,
          owner: req.user._id,
          members: {
            $elemMatch: { user: req.params.memberId, role: "member" },
          },
        },
        {
          $pull: {
            members: { user: req.params.memberId, role: "member" },
          },
        },
      );
      if (!result.modifiedCount) {
        return res.status(404).json({ error: "Workspace member not found." });
      }
      return res.status(200).json({ message: "Workspace member removed." });
    } catch (error) {
      console.error("Could not remove workspace member.", error?.name);
      return res
        .status(500)
        .json({ error: "Could not remove the workspace member." });
    }
  };

  return { list, create, invite, revokeInvitation, acceptInvitation, removeMember };
};

export const workspaceController = createWorkspaceController();
