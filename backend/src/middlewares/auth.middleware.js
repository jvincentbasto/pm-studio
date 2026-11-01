import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { config } from "../lib/config.js";

export const createProtectRoute =
  ({ UserModel = User, jwtSecret = config.envs.jwtSecret } = {}) =>
  async (req, res, next) => {
    const token = req.cookies?.[config.constants.jwt];
    if (!token || !jwtSecret) {
      return res.status(401).json({ error: "Authentication required." });
    }

    let payload;
    try {
      payload = jwt.verify(token, jwtSecret);
    } catch {
      return res.status(401).json({ error: "Authentication required." });
    }

    try {
      const user = await UserModel.findById(payload.sub);
      if (
        !user ||
        !user.emailVerified ||
        (user.tokenVersion ?? 0) !== (payload.tokenVersion ?? 0)
      ) {
        return res.status(401).json({ error: "Authentication required." });
      }

      req.user = user;
      return next();
    } catch (error) {
      console.error("Could not verify session.", error);
      return res.status(500).json({ error: "Could not verify your session." });
    }
  };

export const protectRoute = createProtectRoute();
