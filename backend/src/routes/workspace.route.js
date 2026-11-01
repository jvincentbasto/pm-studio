import express from "express";
import { workspaceController } from "../controllers/workspace.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protectRoute, workspaceController.list);
router.post("/", protectRoute, workspaceController.create);

export default router;
