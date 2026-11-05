import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createWorkspaceController } from "../src/controllers/workspace.controller.js";

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("workspace owner creates a hashed, expiring email invitation", async () => {
  const ownerId = "owner-1";
  const workspaceId = "workspace-1";
  const workspace = {
    _id: workspaceId,
    owner: ownerId,
    name: "Analytical Engine",
    members: [{ user: ownerId, role: "owner" }],
    invitations: [],
  };
  let invitationEmail;
  let savedInvitation;
  const controller = createWorkspaceController({
    WorkspaceModel: {
      findOne: async (query) => {
        assert.deepEqual(query, { _id: workspaceId, owner: ownerId });
        return workspace;
      },
      findOneAndUpdate: async (query, update) => {
        assert.equal(query._id, workspaceId);
        assert.equal(query.owner, ownerId);
        assert.deepEqual(query.invitations.$not.$elemMatch.email, "ada@example.com");
        assert.ok(query.invitations.$not.$elemMatch.expiresAt.$gt instanceof Date);
        savedInvitation = update.$push.invitations;
        workspace.invitations.push(savedInvitation);
        return workspace;
      },
    },
    UserModel: { findOne: async () => null },
    mailer: {
      sendWorkspaceInvitationEmail: async (details) => {
        invitationEmail = details;
      },
    },
  });
  const res = createResponse();
  const now = Date.now();

  await controller.invite(
    {
      params: { workspaceId },
      body: { email: " ADA@Example.com " },
      user: { _id: ownerId },
    },
    res,
  );

  assert.equal(res.statusCode, 201);
  assert.equal(invitationEmail.email, "ada@example.com");
  assert.equal(res.body.invitation.id, savedInvitation._id);
  assert.match(savedInvitation._id, /^[a-f\d]{24}$/i);
  assert.equal(
    workspace.invitations[0].tokenHash,
    createHash("sha256").update(invitationEmail.token).digest("hex"),
  );
  assert.ok(
    workspace.invitations[0].expiresAt.getTime() >=
      now + 7 * 86400000 - 1000,
  );
  assert.equal("tokenHash" in res.body.invitation, false);
});

test("workspace invitations reject invalid email before querying the workspace", async () => {
  const controller = createWorkspaceController({
    WorkspaceModel: {
      findOne: async () => {
        throw new Error("Must not query the workspace.");
      },
    },
  });
  const res = createResponse();

  await controller.invite(
    {
      params: { workspaceId: "workspace-1" },
      body: { email: "not-an-email" },
      user: { _id: "owner-1" },
    },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "Enter a valid email address.");
});

test("non-owners cannot create workspace invitations", async () => {
  let userLookedUp = false;
  const controller = createWorkspaceController({
    WorkspaceModel: { findOne: async () => null },
    UserModel: {
      findOne: async () => {
        userLookedUp = true;
      },
    },
  });
  const res = createResponse();

  await controller.invite(
    {
      params: { workspaceId: "workspace-1" },
      body: { email: "ada@example.com" },
      user: { _id: "member-1" },
    },
    res,
  );

  assert.equal(res.statusCode, 404);
  assert.equal(userLookedUp, false);
});

test("workspace invitation returns failure and deletes the unsent invitation when email fails", async () => {
  const workspace = {
    _id: "workspace-1",
    owner: "owner-1",
    name: "Analytical Engine",
    members: [],
    invitations: [],
  };
  let cleanup;
  const controller = createWorkspaceController({
    WorkspaceModel: {
      findOne: async () => workspace,
      findOneAndUpdate: async (_query, update) => {
        workspace.invitations.push(update.$push.invitations);
        return workspace;
      },
      updateOne: async (query, update) => {
        cleanup = { query, update };
        return { modifiedCount: 1 };
      },
    },
    UserModel: { findOne: async () => null },
    mailer: {
      sendWorkspaceInvitationEmail: async () => {
        throw new Error("SMTP unavailable");
      },
    },
  });
  const res = createResponse();

  await controller.invite(
    {
      params: { workspaceId: "workspace-1" },
      body: { email: "ada@example.com" },
      user: { _id: "owner-1" },
    },
    res,
  );

  assert.equal(res.statusCode, 503);
  assert.deepEqual(cleanup.update.$pull.invitations, {
    tokenHash: workspace.invitations[0].tokenHash,
  });
});

test("acceptance atomically consumes a matching unexpired invitation", async () => {
  let operation;
  const controller = createWorkspaceController({
    WorkspaceModel: {
      updateOne: async (filter, update) => {
        operation = { filter, update };
        return { modifiedCount: 1 };
      },
    },
  });
  const res = createResponse();

  await controller.acceptInvitation(
    {
      body: { token: "a".repeat(64) },
      user: { _id: "member-1", email: "ada@example.com" },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(
    operation.filter.invitations.$elemMatch.tokenHash,
    createHash("sha256").update("a".repeat(64)).digest("hex"),
  );
  assert.equal(operation.filter.invitations.$elemMatch.email, "ada@example.com");
  assert.ok(operation.filter.invitations.$elemMatch.expiresAt.$gt instanceof Date);
  assert.deepEqual(operation.filter.members.$not.$elemMatch, {
    user: "member-1",
  });
  assert.deepEqual(operation.update.$push.members, {
    user: "member-1",
    role: "member",
  });
  assert.deepEqual(operation.update.$pull.invitations, {
    tokenHash: operation.filter.invitations.$elemMatch.tokenHash,
  });
});

test("expired, revoked, used, and mismatched invitations grant no access", async () => {
  const controller = createWorkspaceController({
    WorkspaceModel: {
      updateOne: async () => ({ modifiedCount: 0 }),
    },
  });
  const res = createResponse();

  await controller.acceptInvitation(
    {
      body: { token: "b".repeat(64) },
      user: { _id: "member-1", email: "wrong@example.com" },
    },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "Invitation link is invalid or expired.");
});

test("owner can revoke only their workspace's pending invitation", async () => {
  let operation;
  const controller = createWorkspaceController({
    WorkspaceModel: {
      updateOne: async (filter, update) => {
        operation = { filter, update };
        return { modifiedCount: 1 };
      },
    },
  });
  const res = createResponse();

  await controller.revokeInvitation(
    {
      params: { workspaceId: "workspace-1", invitationId: "invitation-1" },
      user: { _id: "owner-1" },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(operation.filter.owner, "owner-1");
  assert.equal(operation.filter._id, "workspace-1");
  assert.equal(operation.filter.invitations.$elemMatch._id, "invitation-1");
  assert.ok(
    operation.filter.invitations.$elemMatch.expiresAt.$gt instanceof Date,
  );
  assert.deepEqual(operation.update.$pull.invitations, {
    _id: "invitation-1",
  });
});

test("owner removes a member with one membership update", async () => {
  let operation;
  const controller = createWorkspaceController({
    WorkspaceModel: {
      updateOne: async (filter, update) => {
        operation = { filter, update };
        return { modifiedCount: 1 };
      },
    },
  });
  const res = createResponse();

  await controller.removeMember(
    {
      params: { workspaceId: "workspace-1", memberId: "member-1" },
      user: { _id: "owner-1" },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(operation.filter.owner, "owner-1");
  assert.deepEqual(operation.filter.members.$elemMatch, {
    user: "member-1",
    role: "member",
  });
  assert.deepEqual(operation.update.$pull.members, {
    user: "member-1",
    role: "member",
  });
});
