import nodemailer from "nodemailer";
import { config } from "./config.js";

const { appUrl, emailHost, emailPort, emailUser, emailPassword, emailFrom } =
  config.envs;

const createTransporter = () => {
  if (!emailHost || !emailFrom) {
    throw new Error("Email delivery is not configured.");
  }

  const auth =
    emailUser && emailPassword
      ? { user: emailUser, pass: emailPassword }
      : undefined;

  return nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465,
    ...(auth && { auth }),
  });
};

const sendLink = async ({ email, path, parameter, token, subject, action }) => {
  const link = new URL(path, appUrl);
  link.searchParams.set(parameter, token);
  await createTransporter().sendMail({
    from: emailFrom,
    to: email,
    subject,
    text: `${action}: ${link.toString()}`,
  });
};

export const emailService = {
  sendVerificationEmail: (user, token) =>
    sendLink({
      email: user.email,
      path: "/",
      parameter: "verify",
      token,
      subject: "Verify your PM Studio email",
      action: "Verify your email",
    }),
  sendPasswordResetEmail: (user, token) =>
    sendLink({
      email: user.email,
      path: "/",
      parameter: "reset",
      token,
      subject: "Reset your PM Studio password",
      action: "Reset your password",
    }),
};
