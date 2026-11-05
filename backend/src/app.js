import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { auth } from "express-openid-connect";
import { config } from "./lib/config.js";
import authRoutes from "./routes/auth.route.js";
import workspaceRoutes from "./routes/workspace.route.js";
import projectRoutes from "./routes/project.route.js";
import guestRoutes from "./routes/guest.route.js";

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

const auth0Settings = [
  config.envs.auth0IssuerBaseUrl,
  config.envs.auth0ClientId,
  config.envs.auth0ClientSecret,
  config.envs.auth0SessionSecret,
];
if (auth0Settings.some(Boolean) && auth0Settings.some((value) => !value)) {
  throw new Error("Set all AUTH0_* settings to enable provider sign-in.");
}
if (auth0Settings.every(Boolean)) {
  app.use(
    auth({
      issuerBaseURL: config.envs.auth0IssuerBaseUrl,
      baseURL: config.envs.backendUrl,
      clientID: config.envs.auth0ClientId,
      clientSecret: config.envs.auth0ClientSecret,
      secret: config.envs.auth0SessionSecret,
      authRequired: false,
      authorizationParams: {
        response_type: "code",
        scope: "openid profile email",
      },
      routes: {
        login: false,
        logout: false,
        callback: "/api/auth/callback",
      },
    }),
  );
}

app.get("/api", (_req, res) => {
  res.status(200).json({ success: true });
});
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/workspaces", projectRoutes);
app.use("/api/guest", guestRoutes);

export default app;
