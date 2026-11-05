import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import Project from "../models/Project.js";
import { authUserResponse, issueSession } from "./auth.controller.js";
import { config } from "../lib/config.js";
import { emailService } from "../lib/email.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const guestLinkLifetime = 24 * 60 * 60 * 1000;
const guestLifetime = 3 * 24 * 60 * 60 * 1000;
const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("hex");
const validEmail = (email) =>
  email.length <= 254 && emailPattern.test(email);
const validPassword = (password) =>
  typeof password === "string" &&
  password.length >= 8 &&
  password.length <= 128 &&
  !bcrypt.truncates(password);

const selectGuestToken = (query) =>
  typeof query?.select === "function"
    ? query.select("+guestTokenHash +guestTokenExpiresAt")
    : query;

export const createGuestController = ({
  UserModel = User,
  WorkspaceModel = Workspace,
  ProjectModel = Project,
  mailer = emailService,
  jwtSecret = config.envs.jwtSecret,
  nodeEnv = config.envs.nodeEnv,
  now = () => new Date(),
} = {}) => {
  const start = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    try {
      let user = await UserModel.findOne({ email });
      if (user && (user.accountType ?? "regular") !== "guest") {
        return res.status(409).json({
          error: "This email already has an account. Sign in instead.",
        });
      }
      if (
        user?.guestExpiresAt &&
        new Date(user.guestExpiresAt) <= now()
      ) {
        return res.status(410).json({
          error: "Guest access has expired. Start a new account to continue.",
        });
      }

      const token = newToken();
      const attributes = {
        guestTokenHash: hashToken(token),
        guestTokenExpiresAt: new Date(now().getTime() + guestLinkLifetime),
      };
      if (user) {
        Object.assign(user, attributes);
        await user.save();
      } else {
        user = await UserModel.create({
          firstName: "Guest",
          lastName: "Member",
          email,
          emailVerified: false,
          accountType: "guest",
          ...attributes,
        });
      }

      try {
        await mailer.sendGuestVerificationEmail(user, token);
      } catch (error) {
        console.error("Could not send guest verification email.", error?.name);
        return res.status(503).json({
          error: "Could not send the guest access email. Try again.",
        });
      }

      return res.status(200).json({
        message: "Check your email for a link to start or resume your guest account.",
      });
    } catch (error) {
      console.error("Could not start guest account.", error?.name);
      return res.status(500).json({ error: "Could not start a guest account." });
    }
  };

  const verify = async (req, res) => {
    const token = req.body?.token;
    if (typeof token !== "string" || !token) {
      return res.status(400).json({ error: "Guest access token is required." });
    }

    try {
      const query = UserModel.findOne({
        accountType: "guest",
        guestTokenHash: hashToken(token),
        guestTokenExpiresAt: { $gt: now() },
      });
      const user = await selectGuestToken(query);
      if (!user || (user.guestExpiresAt && new Date(user.guestExpiresAt) <= now())) {
        return res
          .status(400)
          .json({ error: "Guest access link is invalid or expired." });
      }

      if (!user.emailVerified) {
        let workspace;
        try {
          workspace = await WorkspaceModel.create({
            name: "Guest Workspace",
            owner: user._id,
            members: [{ user: user._id, role: "owner" }],
            guestProjectCount: 1,
            guestTaskCount: 1,
          });
          await ProjectModel.create({
            workspace: workspace._id,
            name: "Sample Project",
            description: "Explore your guest workspace with this sample task.",
            tasks: [
              {
                title: "Explore the Kanban board",
                description: "Move this task through the four workflow columns.",
              },
            ],
          });
          user.emailVerified = true;
          user.guestExpiresAt = new Date(now().getTime() + guestLifetime);
          user.guestTokenHash = undefined;
          user.guestTokenExpiresAt = undefined;
          await user.save();
        } catch (error) {
          if (workspace) {
            try {
              await ProjectModel.deleteMany({ workspace: workspace._id });
              await WorkspaceModel.deleteOne({ _id: workspace._id });
            } catch (cleanupError) {
              console.error("Could not clean up incomplete guest data.", cleanupError?.name);
            }
          }
          console.error("Could not activate guest account.", error?.name);
          return res.status(500).json({ error: "Could not start your guest account." });
        }
      } else {
        user.guestTokenHash = undefined;
        user.guestTokenExpiresAt = undefined;
        await user.save();
      }

      issueSession({ user, res, jwtSecret, nodeEnv });
      return res.status(200).json({
        message: "Guest account ready.",
        user: authUserResponse(user),
      });
    } catch (error) {
      console.error("Could not verify guest access.", error?.name);
      return res.status(500).json({ error: "Could not verify guest access." });
    }
  };

  const upgrade = async (req, res) => {
    const { firstName, lastName, password } = req.body ?? {};
    if (
      typeof firstName !== "string" ||
      !firstName.trim() ||
      firstName.trim().length > 80 ||
      typeof lastName !== "string" ||
      !lastName.trim() ||
      lastName.trim().length > 80 ||
      !validPassword(password)
    ) {
      return res.status(400).json({
        error: "Enter your first and last name and a valid password.",
      });
    }

    try {
      const nowDate = now();
      const user = await UserModel.findOneAndUpdate(
        {
          _id: req.user._id,
          accountType: "guest",
          guestExpiresAt: { $gt: nowDate },
          emailVerified: true,
        },
        {
          $set: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            password: await bcrypt.hash(password, 10),
            accountType: "regular",
          },
          $unset: {
            guestExpiresAt: 1,
            guestTokenHash: 1,
            guestTokenExpiresAt: 1,
          },
        },
        { new: true, runValidators: true },
      );
      if (!user) {
        return res.status(410).json({
          error: "Guest access has expired. The account can no longer be upgraded.",
        });
      }
      return res
        .status(200)
        .json({ message: "Guest account upgraded.", user: authUserResponse(user) });
    } catch (error) {
      console.error("Could not upgrade guest account.", error?.name);
      return res.status(500).json({ error: "Could not upgrade your account." });
    }
  };

  return { start, verify, upgrade };
};

export const guestController = createGuestController();
