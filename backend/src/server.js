import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import { utils } from "./lib/utils.js";
import { connectDB } from "./lib/db.js";

import authRoutes from "./routes/auth.route.js";

//
const { isProduction, envFile } = utils.getEnvFilename();

//
dotenv.config({ path: envFile, override: true });
const PORT = process.env.PORT;
const __dirname = path.resolve();

const app = express();
app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true, // allow frontend to send cookies
  })
);
app.use(express.json());
app.use(cookieParser());

// routes
app.get("/api", async (req, res) => {
  res.status(200).json({ success: true });
});
app.use("/api/auth", authRoutes);

// production setup
// if (isProduction) {
//   app.use(express.static(path.join(__dirname, "../frontend/dist")));

//   app.get(/.*/, (req, res) => {
//     res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
//   });
// }

app.listen(PORT, () => {
  // console.log("Environment", isProduction);
  console.log(`Server running on http://localhost:${PORT}`);
  connectDB();
});
