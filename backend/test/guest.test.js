import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import bcrypt from "bcryptjs";
import { createGuestController } from "../src/controllers/guest.controller.js";
import { createExpiredGuestCleanup } from "../src/lib/guest-cleanup.js";

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  cookies: [],
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  cookie(name, value, options) {
    this.cookies.push({ name, value, options });
    return this;
  },
});

const hashToken = (token) =>
  createHash("sha256").update(token).digest("hex");

test("guest start sends a verification link without creating a workspace", async () => {
  let guest;
  let sentToken;
  let createdWorkspace = false;
  const controller = createGuestController({
    UserModel: {
      findOne: async () => null,
      create: async (attributes) => {
        guest = { _id: "guest-1", ...attributes };
        return guest;
      },
    },
    WorkspaceModel: {
      create: async () => {
        createdWorkspace = true;
      },
    },
    mailer: {
      sendGuestVerificationEmail: async (_user, token) => {
        sentToken = token;
      },
    },
    jwtSecret: "test-secret",
    now: () => new Date("2026-11-06T00:00:00.000Z"),
  });
  const res = createResponse();

  await controller.start({ body: { email: "  demo@example.com " } }, res);

  assert.equal(res.statusCode, 200);
  assert.match(res.body.message, /check your email/i);
  assert.equal(guest.email, "demo@example.com");
  assert.equal(guest.accountType, "guest");
  assert.equal(guest.emailVerified, false);
  assert.equal(guest.guestTokenHash, hashToken(sentToken));
  assert.equal(guest.guestExpiresAt, undefined);
  assert.equal(createdWorkspace, false);
});

test("guest start rejects an email belonging to a full account", async () => {
  const controller = createGuestController({
    UserModel: {
      findOne: async () => ({ _id: "full-user", accountType: "regular" }),
      create: async () => assert.fail("must not create a guest"),
    },
    mailer: { sendGuestVerificationEmail: async () => {} },
  });
  const res = createResponse();

  await controller.start({ body: { email: "ada@example.com" } }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /sign in/i);
});

test("guest start resends access without extending the three-day retention", async () => {
  const expiry = new Date("2026-11-08T00:00:00.000Z");
  const guest = {
    _id: "guest-1",
    email: "demo@example.com",
    accountType: "guest",
    emailVerified: true,
    guestExpiresAt: expiry,
    save: async () => {},
  };
  let sentToken;
  const controller = createGuestController({
    UserModel: { findOne: async () => guest },
    mailer: {
      sendGuestVerificationEmail: async (_user, token) => {
        sentToken = token;
      },
    },
    now: () => new Date("2026-11-06T00:00:00.000Z"),
  });
  const res = createResponse();

  await controller.start({ body: { email: guest.email } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(guest.guestExpiresAt, expiry);
  assert.equal(guest.guestTokenHash, hashToken(sentToken));
});

test("guest verification seeds a workspace, project, task, and three-day expiry", async () => {
  const now = new Date("2026-11-06T00:00:00.000Z");
  const token = "guest-verification-token";
  const guest = {
    _id: "guest-1",
    firstName: "Guest",
    lastName: "User",
    email: "demo@example.com",
    emailVerified: false,
    accountType: "guest",
    guestTokenHash: hashToken(token),
    guestTokenExpiresAt: new Date("2026-11-07T00:00:00.000Z"),
    async save() {},
  };
  let workspaceAttributes;
  let projectAttributes;
  const controller = createGuestController({
    UserModel: {
      findOne: async (filter) => {
        assert.equal(filter.guestTokenHash, hashToken(token));
        return guest;
      },
    },
    WorkspaceModel: {
      create: async (attributes) => {
        workspaceAttributes = attributes;
        return { _id: "workspace-1" };
      },
    },
    ProjectModel: {
      create: async (attributes) => {
        projectAttributes = attributes;
        return { _id: "project-1", tasks: attributes.tasks };
      },
    },
    jwtSecret: "test-secret",
    now: () => now,
  });
  const res = createResponse();

  await controller.verify({ body: { token } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(guest.emailVerified, true);
  assert.equal(guest.guestExpiresAt.toISOString(), "2026-11-09T00:00:00.000Z");
  assert.equal(guest.guestTokenHash, undefined);
  assert.equal(workspaceAttributes.owner, guest._id);
  assert.deepEqual(workspaceAttributes.members, [
    { user: guest._id, role: "owner" },
  ]);
  assert.equal(projectAttributes.workspace, "workspace-1");
  assert.equal(projectAttributes.tasks.length, 1);
  assert.equal(res.cookies.length, 1);
  assert.equal(res.body.user.accountType, "guest");
});

test("verified guests can use a fresh email link without reseeding data", async () => {
  const token = "resumed-guest-token";
  const guest = {
    _id: "guest-1",
    firstName: "Guest",
    lastName: "Member",
    email: "demo@example.com",
    emailVerified: true,
    accountType: "guest",
    guestExpiresAt: new Date("2026-11-08T00:00:00.000Z"),
    guestTokenHash: hashToken(token),
    guestTokenExpiresAt: new Date("2026-11-07T00:00:00.000Z"),
    async save() {},
  };
  const controller = createGuestController({
    UserModel: {
      findOne: async () => guest,
    },
    WorkspaceModel: {
      create: async () => assert.fail("must not create another workspace"),
    },
    ProjectModel: {
      create: async () => assert.fail("must not seed the project again"),
    },
    jwtSecret: "test-secret",
    now: () => new Date("2026-11-06T00:00:00.000Z"),
  });
  const res = createResponse();

  await controller.verify({ body: { token } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(guest.guestExpiresAt.toISOString(), "2026-11-08T00:00:00.000Z");
  assert.equal(guest.guestTokenHash, undefined);
  assert.equal(res.body.user.accountType, "guest");
  assert.equal(res.cookies.length, 1);
});

test("guest upgrade preserves the account identity and hashes a password", async () => {
  let updateFilter;
  let update;
  const now = new Date("2026-11-06T00:00:00.000Z");
  const controller = createGuestController({
    UserModel: {
      findOneAndUpdate: async (filter, attributes) => {
        updateFilter = filter;
        update = attributes;
        return {
          _id: "guest-1",
          email: "demo@example.com",
          firstName: attributes.$set.firstName,
          lastName: attributes.$set.lastName,
          accountType: "regular",
        };
      },
    },
    now: () => now,
  });
  const res = createResponse();

  await controller.upgrade(
    {
      user: { _id: "guest-1" },
      body: {
        firstName: "Ada",
        lastName: "Lovelace",
        password: "correct horse battery",
      },
    },
    res,
  );

  assert.deepEqual(updateFilter, {
    _id: "guest-1",
    accountType: "guest",
    guestExpiresAt: { $gt: now },
    emailVerified: true,
  });
  assert.equal(update.$set.firstName, "Ada");
  assert.equal(update.$set.lastName, "Lovelace");
  assert.equal(update.$set.accountType, "regular");
  assert.equal(update.$unset.guestExpiresAt, 1);
  assert.equal(
    await bcrypt.compare("correct horse battery", update.$set.password),
    true,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.email, "demo@example.com");
  assert.equal(res.body.user.accountType, "regular");
});

test("expired guest cleanup removes owned projects, workspaces, and users", async () => {
  const calls = [];
  const cleanup = createExpiredGuestCleanup({
    UserModel: {
      updateMany: async (...args) => calls.push(["expire", ...args]),
      find: async (...args) => {
        calls.push(["find-expired", ...args]);
        return [{ _id: "guest-1" }];
      },
      deleteMany: async (...args) => calls.push(["delete-users", ...args]),
    },
    WorkspaceModel: {
      find: async (...args) => {
        calls.push(["find-workspaces", ...args]);
        return [{ _id: "workspace-1" }];
      },
      deleteMany: async (...args) => calls.push(["delete-workspaces", ...args]),
      updateMany: async (...args) => calls.push(["remove-members", ...args]),
    },
    ProjectModel: {
      deleteMany: async (...args) => calls.push(["delete-projects", ...args]),
    },
    now: () => new Date("2026-11-10T00:00:00.000Z"),
  });

  await cleanup();

  assert.deepEqual(calls.map(([name]) => name), [
    "expire",
    "find-expired",
    "find-workspaces",
    "delete-projects",
    "delete-workspaces",
    "remove-members",
    "delete-users",
  ]);
  assert.deepEqual(calls[0][1], {
    accountType: "guest",
    $or: [
      { guestExpiresAt: { $lte: new Date("2026-11-10T00:00:00.000Z") } },
      {
        emailVerified: false,
        guestTokenExpiresAt: { $lte: new Date("2026-11-10T00:00:00.000Z") },
      },
    ],
  });
  assert.deepEqual(calls[3][1], { workspace: { $in: ["workspace-1"] } });
  assert.deepEqual(calls[6][1], {
    _id: { $in: ["guest-1"] },
    accountType: "expired",
  });
});

test("expired unverified guest links are included in cleanup", async () => {
  let expiryFilter;
  const cleanup = createExpiredGuestCleanup({
    UserModel: {
      updateMany: async (filter) => {
        expiryFilter = filter;
      },
      find: async () => [],
    },
    now: () => new Date("2026-11-10T00:00:00.000Z"),
  });

  await cleanup();

  assert.deepEqual(expiryFilter, {
    accountType: "guest",
    $or: [
      { guestExpiresAt: { $lte: new Date("2026-11-10T00:00:00.000Z") } },
      {
        emailVerified: false,
        guestTokenExpiresAt: { $lte: new Date("2026-11-10T00:00:00.000Z") },
      },
    ],
  });
});
