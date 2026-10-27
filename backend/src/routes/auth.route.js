import express from "express";
import { userController } from "../controllers/auth.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();
const { signup, login, logout,  } = userController;

// main
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
// refreshTokenHandler

//
// requestEmailVerification
// verifyEmail

//
// forgotPassword
// resetPassword

export default router;
