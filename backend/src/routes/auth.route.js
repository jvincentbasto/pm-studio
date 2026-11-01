import express from "express";
import { authController } from "../controllers/auth.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();
const {
  signup,
  login,
  logout,
  requestEmailVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
  currentUser,
} = authController;

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.post("/request-email-verification", requestEmailVerification);
router.post("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", protectRoute, currentUser);

export default router;
