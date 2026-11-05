import express from "express";
import { config } from "../lib/config.js";
import { authController } from "../controllers/auth.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();
const {
  signup,
  login,
  completeAuth0Login,
  logout,
  requestEmailVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
  currentUser,
} = authController;

const startProviderLogin = (connection) => async (req, res, next) => {
  if (typeof res.oidc?.login !== "function") {
    console.log("req", req.oidc);
    return res.status(503).json({ error: "Social sign-in is not configured." });
  }

  try {
    await res.oidc.login({
      authorizationParams: { connection },
      returnTo: "/api/auth/signed-in",
    });
  } catch (error) {
    return next(error);
  }
};

router.post("/signup", signup);
router.post("/login", login);
router.get("/google", startProviderLogin("google-oauth2"));
router.get("/github", startProviderLogin("github"));
router.get("/logout", logout);
router.post("/logout", logout);
router.get("/signed-in", async (req, res) => {
  if (!req.oidc?.user) {
    return res.status(401).json({ error: "Authentication required." });
  }
  return completeAuth0Login(req.oidc.user, res);
});
router.get("/signed-out", (_req, res) => res.redirect(config.envs.appUrl));
router.post("/request-email-verification", requestEmailVerification);
router.post("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", protectRoute, currentUser);

export default router;
