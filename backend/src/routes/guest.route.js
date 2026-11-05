import express from "express";
import { guestController } from "../controllers/guest.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/start", guestController.start);
router.post("/verify", guestController.verify);
router.post("/upgrade", protectRoute, guestController.upgrade);

export default router;
