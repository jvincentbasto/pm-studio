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

const sendLink = async ({ email, path, parameter, token, subject, action, linkLabel }) => {
  const link = new URL(path, appUrl);
  link.searchParams.set(parameter, token);
  await createTransporter().sendMail({
    from: emailFrom,
    to: email,
    subject,
    text: `${action}: ${link.toString()}`,
    html: `<p>${action}: <a href="${link.toString()}">${linkLabel ?? 'PM Studio'}</a></p>`,
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
      linkLabel: "PM Studio",
    }),
  sendGuestVerificationEmail: (user, token) =>
    sendLink({
      email: user.email,
      path: "/",
      parameter: "guest",
      token,
      subject: "Start your PM Studio guest account",
      action: "Verify your email to start your guest account",
      linkLabel: "Start your guest account",
    }),
  sendPasswordResetEmail: (user, token) =>
    sendLink({
      email: user.email,
      path: "/",
      parameter: "reset",
      token,
      subject: "Reset your PM Studio password",
      action: "Reset your password",
      linkLabel: "PM Studio",
    }),
  sendWorkspaceInvitationEmail: ({ email, token }) =>
    sendLink({
      email,
      path: "/",
      parameter: "invite",
      token,
      subject: "You have a PM Studio workspace invitation",
      action: "Accept your PM Studio workspace invitation",
      linkLabel: "Join PM Studio",
    }),
};
