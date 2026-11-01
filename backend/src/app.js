import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./routes/auth.route.js";
import workspaceRoutes from "./routes/workspace.route.js";

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get("/api", (_req, res) => {
  res.status(200).json({ success: true });
});
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);

export default app;
