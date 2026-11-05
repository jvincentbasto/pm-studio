import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { createAuthController } from "../src/controllers/auth.controller.js";
import { createProtectRoute } from "../src/middlewares/auth.middleware.js";
import { createWorkspaceController } from "../src/controllers/workspace.controller.js";
import User from "../src/models/User.js";
import authRoutes from "../src/routes/auth.route.js";

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
  redirect(url) {
    this.redirectUrl = url;
    this.statusCode = 302;
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

test("Auth0 login creates a verified provider account for a new user", async () => {
  let createdAttributes;
  const controller = createAuthController({
    UserModel: {
      findOne: async () => null,
      create: async (attributes) => {
        createdAttributes = attributes;
        return {
          _id: "user-google-1",
          ...attributes,
        };
      },
    },
    jwtSecret: "test-secret",
    nodeEnv: "test",
  });
  const res = createResponse();

  await controller.completeAuth0Login(
    {
      sub: "google-oauth2|google-123",
      email: "grace@example.com",
      email_verified: true,
      given_name: "Grace",
      family_name: "Hopper",
    },
    res,
  );

  assert.equal(res.statusCode, 302);
  assert.equal(res.redirectUrl, "http://localhost:3000");
  assert.equal(createdAttributes.emailVerified, true);
  assert.equal(createdAttributes.authProviders[0].provider, "google");
  assert.equal(
    createdAttributes.authProviders[0].providerId,
    "google-oauth2|google-123",
  );
  assert.equal(jwt.verify(res.cookies[0].value, "test-secret").sub, "user-google-1");
});

test("Auth0 login links a verified provider identity to an existing account", async () => {
  const user = {
    _id: "user-existing-1",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    emailVerified: true,
    authProviders: [],
    save: async function () {
      return this;
    },
  };
  const controller = createAuthController({
    UserModel: {
      findOne: async (query) => {
        if (query && query.email === "ada@example.com") return user;
        return null;
      },
    },
    jwtSecret: "test-secret",
    nodeEnv: "test",
  });
  const res = createResponse();

  await controller.completeAuth0Login(
    {
      sub: "google-oauth2|google-456",
      email: "ada@example.com",
      email_verified: true,
      given_name: "Ada",
      family_name: "Lovelace",
    },
    res,
  );

  assert.equal(res.statusCode, 302);
  assert.equal(res.redirectUrl, "http://localhost:3000");
  assert.equal(user.authProviders[0].provider, "google");
  assert.equal(
    user.authProviders[0].providerId,
    "google-oauth2|google-456",
  );
});

test("Auth0 login upgrades an active Guest account without changing its identity", async () => {
  const guest = {
    _id: "guest-1",
    firstName: "Guest",
    lastName: "Member",
    email: "demo@example.com",
    emailVerified: true,
    accountType: "guest",
    guestExpiresAt: new Date(Date.now() + 86400000),
    authProviders: [],
    save: async function () {
      return this;
    },
  };
  const controller = createAuthController({
    UserModel: {
      findOne: async (query) =>
        query.email === "demo@example.com" ? guest : null,
      findOneAndUpdate: async (_filter, update) => {
        Object.assign(guest, update.$set);
        delete guest.guestExpiresAt;
        guest.authProviders.push(update.$push.authProviders);
        return guest;
      },
    },
    jwtSecret: "test-secret",
    nodeEnv: "test",
  });
  const res = createResponse();

  await controller.completeAuth0Login(
    {
      sub: "google-oauth2|guest-google",
      email: guest.email,
      email_verified: true,
      given_name: "Ada",
      family_name: "Lovelace",
    },
    res,
  );

  assert.equal(guest._id, "guest-1");
  assert.equal(guest.accountType, "regular");
  assert.equal(guest.guestExpiresAt, undefined);
  assert.equal(guest.authProviders[0].provider, "google");
  assert.equal(res.statusCode, 302);
});

test("Auth0 login rejects an identity linked to a different email", async () => {
  const otherUser = {
    _id: "user-other-1",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "other@example.com",
    emailVerified: true,
    authProviders: [
      {
        provider: "github",
        providerId: "github-789",
      },
    ],
  };
  const controller = createAuthController({
    UserModel: {
      findOne: async (query) => {
        if (
          query?.authProviders?.$elemMatch?.provider === "github" &&
          query.authProviders.$elemMatch.providerId === "github|github-789"
        ) {
          return otherUser;
        }
        return null;
      },
    },
    jwtSecret: "test-secret",
    nodeEnv: "test",
  });
  const res = createResponse();

  await assert.rejects(
    controller.completeAuth0Login(
      {
        sub: "github|github-789",
        email: "ada@example.com",
        email_verified: true,
      },
      res,
    ),
    { message: "This identity is already linked to another account." },
  );
});

test("Auth0 login rejects unverified email before looking up an account", async () => {
  let accountLookedUp = false;
  const controller = createAuthController({
    UserModel: {
      findOne: async () => {
        accountLookedUp = true;
        return null;
      },
    },
  });
  const res = createResponse();

  await assert.rejects(
    controller.completeAuth0Login(
      {
        sub: "google-oauth2|unverified",
        email: "ada@example.com",
        email_verified: false,
      },
      res,
    ),
    { message: "Verify your email before signing in." },
  );

  assert.equal(accountLookedUp, false);
  assert.equal(res.cookies.length, 0);
});

test("Google and GitHub routes start Auth0 login with their response context", async () => {
  const loginOptions = [];
  const app = express();
  app.use((_req, res, next) => {
    res.oidc = {
      login: async (options) => {
        loginOptions.push(options);
        res.status(302).end();
      },
    };
    next();
  });
  app.use("/api/auth", authRoutes);
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const provider of ["google", "github"]) {
      const response = await fetch(`${origin}/api/auth/${provider}`, {
        redirect: "manual",
      });
      assert.equal(response.status, 302);
    }

    assert.deepEqual(
      loginOptions.map(({ authorizationParams, returnTo }) => ({
        connection: authorizationParams.connection,
        returnTo,
      })),
      [
        {
          connection: "google-oauth2",
          returnTo: "/api/auth/signed-in",
        },
        { connection: "github", returnTo: "/api/auth/signed-in" },
      ],
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
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

test("passwordless provider users cannot authenticate with a password", async () => {
  const user = new User({
    firstName: "Grace",
    lastName: "Hopper",
    email: "grace@example.com",
    emailVerified: true,
    authProviders: [{ provider: "google", providerId: "google-oauth2|123" }],
  });

  assert.equal(await user.matchPassword("any password"), false);
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

test("logout clears the app cookie and ends the Auth0 session", async () => {
  const controller = createAuthController({ nodeEnv: "production" });
  const res = createResponse();
  let returnTo;
  res.oidc = {
    logout: async (options) => {
      returnTo = options.returnTo;
    },
  };

  await controller.logout({}, res);

  assert.equal(returnTo, "/api/auth/signed-out");
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
  const workspaces = [
    {
      _id: "workspace-1",
      name: "Analytical Engine",
      owner: "owner-1",
      members: [{ user: "user-1", role: "member" }],
      invitations: [{ _id: "invite-1", email: "secret@example.com" }],
    },
  ];
  const controller = createWorkspaceController({
    WorkspaceModel: {
      find: (filter) => {
        query = filter;
        return {
          sort: () => ({
            populate: async () => workspaces,
          }),
        };
      },
    },
  });
  const res = createResponse();

  await controller.list({ user: { _id: "user-1" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(query, { "members.user": "user-1" });
  assert.deepEqual(res.body.workspaces, [
    {
      id: "workspace-1",
      name: "Analytical Engine",
      owner: "owner-1",
      members: [{ id: "user-1", role: "member" }],
      invitations: [],
    },
  ]);
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

test("session middleware rejects expired guest accounts", async () => {
  const token = jwt.sign({}, "test-secret", { subject: "guest-1" });
  const middleware = createProtectRoute({
    UserModel: {
      findById: async () => ({
        _id: "guest-1",
        emailVerified: true,
        accountType: "guest",
        guestExpiresAt: new Date(Date.now() - 1000),
      }),
    },
    jwtSecret: "test-secret",
  });
  const res = createResponse();
  let continued = false;

  await middleware({ cookies: { jwt: token } }, res, () => {
    continued = true;
  });

  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /guest access has expired/i);
  assert.equal(continued, false);
});

test("session middleware explains when cleaned-up guest data is gone", async () => {
  const token = jwt.sign({ accountType: "guest" }, "test-secret", {
    subject: "guest-1",
  });
  const middleware = createProtectRoute({
    UserModel: { findById: async () => null },
    jwtSecret: "test-secret",
  });
  const res = createResponse();

  await middleware({ cookies: { jwt: token } }, res, () => {});

  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /guest access has expired/i);
});
