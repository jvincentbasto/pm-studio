import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import jwt from "jsonwebtoken";
import { createAuthController } from "../src/controllers/auth.controller.js";
import { createProtectRoute } from "../src/middlewares/auth.middleware.js";
import { createWorkspaceController } from "../src/controllers/workspace.controller.js";

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  cookies: [],
  clearedCookies: [],
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
  clearCookie(name, options) {
    this.clearedCookies.push({ name, options });
    return this;
  },
});

test("signup rejects an invalid email before creating an account", async () => {
  const res = createResponse();
  const controller = createAuthController();

  await controller.signup(
    {
      body: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "not-an-email",
        password: "correct horse battery",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "Enter a valid email address.");
});

test("signup rejects missing names", async () => {
  const res = createResponse();
  const controller = createAuthController();

  await controller.signup(
    {
      body: {
        lastName: "Lovelace",
        email: "ada@example.com",
        password: "correct horse battery",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "Enter your first and last name.");
});

test("signup rejects names longer than eighty characters", async () => {
  const res = createResponse();
  const controller = createAuthController();

  await controller.signup(
    {
      body: {
        firstName: "A".repeat(81),
        lastName: "Lovelace",
        email: "ada@example.com",
        password: "correct horse battery",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 400);
});

test("signup rejects passwords shorter than eight characters", async () => {
  const res = createResponse();
  const controller = createAuthController();

  await controller.signup(
    {
      body: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        password: "short",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.body.error,
    "Password must be at least 8 characters and at most 72 UTF-8 bytes.",
  );
});

test("signup rejects passwords over bcrypt's supported byte length", async () => {
  let accountCreated = false;
  const controller = createAuthController({
    UserModel: {
      findOne: async () => null,
      create: async () => {
        accountCreated = true;
      },
    },
    mailer: { sendVerificationEmail: async () => {} },
  });
  const res = createResponse();

  await controller.signup(
    {
      body: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        password: "x".repeat(73),
      },
    },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.body.error,
    "Password must be at least 8 characters and at most 72 UTF-8 bytes.",
  );
  assert.equal(accountCreated, false);
});

test("signup creates an unverified account with a normalized email", async () => {
  let createdUser;
  let verificationEmail;
  const user = { _id: "user-1", email: "ada@example.com" };
  const controller = createAuthController({
    UserModel: {
      findOne: async () => null,
      create: async (attributes) => {
        createdUser = attributes;
        return user;
      },
    },
    mailer: {
      sendVerificationEmail: async (sentUser, token) => {
        verificationEmail = { sentUser, token };
      },
      sendPasswordResetEmail: async () => {},
    },
  });
  const res = createResponse();

  await controller.signup(
    {
      body: {
        firstName: " Ada ",
        lastName: " Lovelace ",
        email: " ADA@Example.com ",
        password: "correct horse battery",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 201);
  assert.equal(createdUser.firstName, "Ada");
  assert.equal(createdUser.lastName, "Lovelace");
  assert.equal(createdUser.email, "ada@example.com");
  assert.equal(createdUser.emailVerified, false);
  assert.match(createdUser.emailVerificationTokenHash, /^[a-f0-9]{64}$/);
  assert.equal(verificationEmail.sentUser, user);
  assert.notEqual(
    verificationEmail.token,
    createdUser.emailVerificationTokenHash,
  );
  assert.match(res.body.message, /verify/i);
});

test("login blocks unverified accounts without setting a session cookie", async () => {
  const user = {
    emailVerified: false,
    matchPassword: async () => true,
  };
  const controller = createAuthController({
    UserModel: {
      findOne: () => ({ select: async () => user }),
    },
    jwtSecret: "test-secret",
  });
  const res = createResponse();

  await controller.login(
    { body: { email: "ada@example.com", password: "correct horse battery" } },
    res,
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.cookies.length, 0);
});

test("login sets an http-only session cookie for a verified user", async () => {
  const user = {
    _id: "user-1",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    emailVerified: true,
    tokenVersion: 2,
    matchPassword: async () => true,
  };
  const controller = createAuthController({
    UserModel: {
      findOne: () => ({ select: async () => user }),
    },
    jwtSecret: "test-secret",
    nodeEnv: "test",
  });
  const res = createResponse();

  await controller.login(
    { body: { email: "ada@example.com", password: "correct horse battery" } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.cookies[0].name, "jwt");
  assert.equal(res.cookies[0].options.httpOnly, true);
  assert.equal(res.cookies[0].options.sameSite, "lax");
  assert.equal(res.cookies[0].options.secure, false);
  assert.equal(jwt.verify(res.cookies[0].value, "test-secret").tokenVersion, 2);
});

test("logout expires the session cookie", async () => {
  const controller = createAuthController({ nodeEnv: "production" });
  const res = createResponse();

  await controller.logout({}, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.clearedCookies[0].name, "jwt");
  assert.equal(res.clearedCookies[0].options.secure, true);
  assert.equal("maxAge" in res.clearedCookies[0].options, false);
});

test("email verification accepts a valid token and clears it", async () => {
  const token = "verification-token";
  const user = {
    emailVerified: false,
    save: async () => {},
  };
  const controller = createAuthController({
    UserModel: {
      findOne: async (query) => {
        assert.equal(
          query.emailVerificationTokenHash,
          createHash("sha256").update(token).digest("hex"),
        );
        return user;
      },
    },
  });
  const res = createResponse();

  await controller.verifyEmail({ body: { token } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(user.emailVerified, true);
  assert.equal(user.emailVerificationTokenHash, undefined);
});

test("password reset updates the password and invalidates existing sessions", async () => {
  const user = {
    password: "old password",
    tokenVersion: 3,
    save: async () => {},
  };
  const controller = createAuthController({
    UserModel: {
      findOne: () => ({ select: async () => user }),
    },
  });
  const res = createResponse();

  await controller.resetPassword(
    { body: { token: "reset-token", password: "new secure password" } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(user.password, "new secure password");
  assert.equal(user.tokenVersion, 4);
  assert.equal(user.passwordResetTokenHash, undefined);
  assert.equal(res.clearedCookies[0].name, "jwt");
});

test("password recovery uses the same response for unknown emails", async () => {
  const controller = createAuthController({
    UserModel: { findOne: async () => null },
  });
  const res = createResponse();

  await controller.forgotPassword({ body: { email: "ada@example.com" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(
    res.body.message,
    "If an account exists for that email, we sent instructions.",
  );
});

test("workspace creation assigns the current user as owner and member", async () => {
  let createdAttributes;
  const controller = createWorkspaceController({
    WorkspaceModel: {
      create: async (attributes) => {
        createdAttributes = attributes;
        return { _id: "workspace-1", ...attributes };
      },
    },
  });
  const res = createResponse();

  await controller.create(
    { body: { name: "  Ada's team " }, user: { _id: "user-1" } },
    res,
  );

  assert.equal(res.statusCode, 201);
  assert.equal(createdAttributes.name, "Ada's team");
  assert.equal(createdAttributes.owner, "user-1");
  assert.deepEqual(createdAttributes.members, [
    { user: "user-1", role: "owner" },
  ]);
});

test("workspace creation rejects names outside the supported length", async () => {
  const controller = createWorkspaceController({
    WorkspaceModel: {
      create: async () => {
        throw new Error("Must not create a workspace.");
      },
    },
  });
  const res = createResponse();

  await controller.create(
    { body: { name: "x" }, user: { _id: "user-1" } },
    res,
  );

  assert.equal(res.statusCode, 400);
});

test("workspace list returns only records found for the signed-in member", async () => {
  let query;
  const workspaces = [{ _id: "workspace-1", name: "Analytical Engine" }];
  const controller = createWorkspaceController({
    WorkspaceModel: {
      find: (filter) => {
        query = filter;
        return { sort: async () => workspaces };
      },
    },
  });
  const res = createResponse();

  await controller.list({ user: { _id: "user-1" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(query, { "members.user": "user-1" });
  assert.deepEqual(res.body.workspaces, workspaces);
});

test("session middleware rejects requests without an authentication cookie", async () => {
  const middleware = createProtectRoute({
    UserModel: {
      findById: async () => {
        throw new Error("Must not load a user.");
      },
    },
    jwtSecret: "test-secret",
  });
  const res = createResponse();
  let continued = false;

  await middleware({ cookies: {} }, res, () => {
    continued = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(continued, false);
});

test("session middleware rejects unverified users", async () => {
  const token = jwt.sign({}, "test-secret", { subject: "user-1" });
  const middleware = createProtectRoute({
    UserModel: {
      findById: async () => ({ _id: "user-1", emailVerified: false }),
    },
    jwtSecret: "test-secret",
  });
  const res = createResponse();
  let continued = false;

  await middleware({ cookies: { jwt: token } }, res, () => {
    continued = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(continued, false);
});
