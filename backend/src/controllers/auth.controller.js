import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import { config } from "../lib/config.js";
import { emailService } from "../lib/email.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const verificationLifetime = 24 * 60 * 60 * 1000;
const resetLifetime = 60 * 60 * 1000;
const sessionLifetime = 7 * 24 * 60 * 60 * 1000;
const genericRecoveryMessage =
  "If an account exists for that email, we sent instructions.";
const isValidEmail = (email) => email.length <= 254 && emailPattern.test(email);
const isValidPassword = (password) =>
  typeof password === "string" &&
  password.length >= 8 &&
  password.length <= 128 &&
  !bcrypt.truncates(password);

const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("hex");
const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const cookieOptions = (nodeEnv) => ({
  httpOnly: true,
  secure: nodeEnv === "production",
  sameSite: "lax",
  path: "/",
  maxAge: sessionLifetime,
});
const expiredCookieOptions = (nodeEnv) => {
  const options = cookieOptions(nodeEnv);
  delete options.maxAge;
  return options;
};

const reportError = (message, error) => {
  console.error(message, error?.name ?? "Unknown error");
};

export const authUserResponse = (user) => ({
  id: String(user._id),
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  accountType: user.accountType ?? "regular",
  ...(user.accountType === "guest" &&
    user.guestExpiresAt && {
      guestExpiresAt: user.guestExpiresAt,
    }),
});

export const issueSession = ({ user, res, jwtSecret, nodeEnv, redirectTo }) => {
  if (!jwtSecret) {
    throw new Error("JWT_SECRET_KEY is not configured.");
  }

  const token = jwt.sign(
    {
      tokenVersion: user.tokenVersion ?? 0,
      accountType: user.accountType ?? "regular",
    },
    jwtSecret,
    { subject: String(user._id), expiresIn: "7d" },
  );

  res.cookie(config.constants.jwt, token, cookieOptions(nodeEnv));
  if (redirectTo) {
    return res.redirect(redirectTo);
  }

  return res.status(200).json({
    user: authUserResponse(user),
  });
};

const normalizeName = (value, fallback = "User") => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.slice(0, 80) || fallback;
};

const upgradeGuestWithProvider = (UserModel, user, providerEntry, names = {}) =>
  UserModel.findOneAndUpdate(
    {
      _id: user._id,
      accountType: "guest",
      emailVerified: true,
      guestExpiresAt: { $gt: new Date() },
    },
    {
      $set: {
        accountType: "regular",
        firstName: names.firstName ?? user.firstName,
        lastName: names.lastName ?? user.lastName,
      },
      $unset: {
        guestExpiresAt: 1,
        guestTokenHash: 1,
        guestTokenExpiresAt: 1,
      },
      $push: { authProviders: providerEntry },
    },
    { new: true, runValidators: true },
  );

export const createAuthController = ({
  UserModel = User,
  mailer = emailService,
  jwtSecret = config.envs.jwtSecret,
  nodeEnv = config.envs.nodeEnv,
} = {}) => {
  const signup = async (req, res) => {
    const { firstName, lastName, password } = req.body ?? {};
    const email = normalizeEmail(req.body?.email);

    if (
      typeof firstName !== "string" ||
      !firstName.trim() ||
      firstName.trim().length > 80 ||
      typeof lastName !== "string" ||
      !lastName.trim() ||
      lastName.trim().length > 80
    ) {
      return res.status(400).json({ error: "Enter your first and last name." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    if (!isValidPassword(password)) {
      return res
        .status(400)
        .json({
          error: "Password must be at least 8 characters and at most 72 UTF-8 bytes.",
        });
    }

    try {
      const existingUser = await UserModel.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          error: "An account with that email already exists.",
        });
      }

      const token = newToken();
      const user = await UserModel.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email,
        password,
        emailVerified: false,
        emailVerificationTokenHash: hashToken(token),
        emailVerificationExpiresAt: new Date(Date.now() + verificationLifetime),
      });

      try {
        await mailer.sendVerificationEmail(user, token);
      } catch (error) {
        reportError("Could not send verification email.", error);
        return res.status(503).json({
          error:
            "Account created, but verification email could not be sent. Request a new email.",
        });
      }

      return res.status(201).json({
        message: "Check your email to verify your account.",
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          error: "An account with that email already exists.",
        });
      }
      reportError("Account signup failed.", error);
      return res.status(500).json({ error: "Could not create your account." });
    }
  };

  const requestEmailVerification = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    try {
      const user = await UserModel.findOne({ email });
      if (user && !user.emailVerified) {
        const token = newToken();
        user.emailVerificationTokenHash = hashToken(token);
        user.emailVerificationExpiresAt = new Date(
          Date.now() + verificationLifetime,
        );
        await user.save();
        try {
          await mailer.sendVerificationEmail(user, token);
        } catch (error) {
          reportError("Could not resend verification email.", error);
        }
      }
      return res.status(200).json({ message: genericRecoveryMessage });
    } catch (error) {
      reportError("Verification email request failed.", error);
      return res.status(500).json({ error: "Could not process your request." });
    }
  };

  const verifyEmail = async (req, res) => {
    const token = req.body?.token;
    if (typeof token !== "string" || !token) {
      return res.status(400).json({ error: "Verification token is required." });
    }

    try {
      const user = await UserModel.findOne({
        emailVerificationTokenHash: hashToken(token),
        emailVerificationExpiresAt: { $gt: new Date() },
      });
      if (!user) {
        return res
          .status(400)
          .json({ error: "Verification link is invalid or expired." });
      }

      user.emailVerified = true;
      user.emailVerificationTokenHash = undefined;
      user.emailVerificationExpiresAt = undefined;
      await user.save();
      return res
        .status(200)
        .json({ message: "Email verified. You can sign in." });
    } catch (error) {
      reportError("Email verification failed.", error);
      return res.status(500).json({ error: "Could not verify your email." });
    }
  };

  const login = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!isValidEmail(email) || typeof password !== "string") {
      return res
        .status(400)
        .json({ error: "Enter a valid email and password." });
    }

    try {
      const user = await UserModel.findOne({ email }).select("+password");
      if (!user || !(await user.matchPassword(password))) {
        return res
          .status(401)
          .json({ error: "Email or password is incorrect." });
      }
      if (!user.emailVerified) {
        return res
          .status(403)
          .json({ error: "Verify your email before signing in." });
      }
      return issueSession({ user, res, jwtSecret, nodeEnv });
    } catch (error) {
      reportError("Login failed.", error);
      return res.status(500).json({ error: "Could not sign in." });
    }
  };

  const completeAuth0Login = async (claims, res) => {
    if (!jwtSecret) {
      throw new Error("JWT_SECRET_KEY is not configured.");
    }

    const [providerId, externalId] =
      typeof claims?.sub === "string" ? claims.sub.split("|", 2) : [];
    const provider = {
      "google-oauth2": "google",
      github: "github",
    }[providerId];
    const email = normalizeEmail(claims?.email);

    if (!provider || !externalId || !isValidEmail(email)) {
      throw new Error("Auth0 returned an unsupported identity.");
    }

    if (claims.email_verified !== true) {
      throw new Error("Verify your email before signing in.");
    }

    const nameParts =
      typeof claims.name === "string" ? claims.name.trim().split(/\s+/) : [];
    const providerEntry = {
      provider,
      providerId: claims.sub,
      avatarUrl: typeof claims.picture === "string" ? claims.picture : undefined,
      emailVerified: true,
    };
    const linkedUser = await UserModel.findOne({
      authProviders: {
        $elemMatch: { provider, providerId: providerEntry.providerId },
      },
    });

    if (linkedUser) {
      if (normalizeEmail(linkedUser.email) !== email) {
        throw new Error("This identity is already linked to another account.");
      }
      if (linkedUser.accountType === "guest") {
        const upgradedGuest = await upgradeGuestWithProvider(
          UserModel,
          linkedUser,
          providerEntry,
        );
        if (!upgradedGuest) throw new Error("Guest access has expired.");
        return issueSession({
          user: upgradedGuest,
          res,
          jwtSecret,
          nodeEnv,
          redirectTo: config.envs.appUrl,
        });
      }
      return issueSession({
        user: linkedUser,
        res,
        jwtSecret,
        nodeEnv,
        redirectTo: config.envs.appUrl,
      });
    }

    const firstName = normalizeName(claims.given_name ?? nameParts[0]);
    const lastName = normalizeName(claims.family_name ?? nameParts[1]);
    const accountWithEmail = await UserModel.findOne({ email });

    if (accountWithEmail) {
      if (accountWithEmail.accountType === "guest") {
        const upgradedGuest = await upgradeGuestWithProvider(
          UserModel,
          accountWithEmail,
          providerEntry,
          {
            firstName: accountWithEmail.firstName || firstName,
            lastName: accountWithEmail.lastName || lastName,
          },
        );
        if (!upgradedGuest) throw new Error("Guest access has expired.");
        return issueSession({
          user: upgradedGuest,
          res,
          jwtSecret,
          nodeEnv,
          redirectTo: config.envs.appUrl,
        });
      }
      accountWithEmail.emailVerified = true;
      accountWithEmail.firstName ||= firstName;
      accountWithEmail.lastName ||= lastName;
      accountWithEmail.authProviders = accountWithEmail.authProviders ?? [];
      accountWithEmail.authProviders.push(providerEntry);
      await accountWithEmail.save();
      return issueSession({
        user: accountWithEmail,
        res,
        jwtSecret,
        nodeEnv,
        redirectTo: config.envs.appUrl,
      });
    }

    const user = await UserModel.create({
      firstName,
      lastName,
      email,
      emailVerified: true,
      authProviders: [providerEntry],
    });
    return issueSession({
      user,
      res,
      jwtSecret,
      nodeEnv,
      redirectTo: config.envs.appUrl,
    });
  };

  const logout = async (_req, res) => {
    res.clearCookie(config.constants.jwt, expiredCookieOptions(nodeEnv));
    if (res.oidc?.logout) {
      return res.oidc.logout({ returnTo: "/api/auth/signed-out" });
    }
    return res.redirect(config.envs.appUrl);
  };

  const forgotPassword = async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    try {
      const user = await UserModel.findOne({ email });
      if (user?.emailVerified) {
        const token = newToken();
        user.passwordResetTokenHash = hashToken(token);
        user.passwordResetExpiresAt = new Date(Date.now() + resetLifetime);
        await user.save();
        try {
          await mailer.sendPasswordResetEmail(user, token);
        } catch (error) {
          reportError("Could not send password reset email.", error);
        }
      }
      return res.status(200).json({ message: genericRecoveryMessage });
    } catch (error) {
      reportError("Password recovery request failed.", error);
      return res.status(500).json({ error: "Could not process your request." });
    }
  };

  const resetPassword = async (req, res) => {
    const { token, password } = req.body ?? {};
    if (typeof token !== "string" || !token) {
      return res.status(400).json({ error: "Reset token is required." });
    }
    if (!isValidPassword(password)) {
      return res
        .status(400)
        .json({
          error: "Password must be at least 8 characters and at most 72 UTF-8 bytes.",
        });
    }

    try {
      const user = await UserModel.findOne({
        passwordResetTokenHash: hashToken(token),
        passwordResetExpiresAt: { $gt: new Date() },
      }).select("+password");
      if (!user) {
        return res
          .status(400)
          .json({ error: "Reset link is invalid or expired." });
      }

      user.password = password;
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      user.passwordResetTokenHash = undefined;
      user.passwordResetExpiresAt = undefined;
      await user.save();
      res.clearCookie(config.constants.jwt, expiredCookieOptions(nodeEnv));
      return res
        .status(200)
        .json({ message: "Password reset. Sign in again." });
    } catch (error) {
      reportError("Password reset failed.", error);
      return res.status(500).json({ error: "Could not reset your password." });
    }
  };

  const currentUser = async (req, res) =>
    res.status(200).json({
      user: authUserResponse(req.user),
    });

  return {
    signup,
    login,
    completeAuth0Login,
    logout,
    requestEmailVerification,
    verifyEmail,
    forgotPassword,
    resetPassword,
    currentUser,
  };
};

export const authController = createAuthController();
