import express from "express";
import { workspaceController } from "../controllers/workspace.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protectRoute, workspaceController.list);
router.post("/", protectRoute, workspaceController.create);
router.post("/invitations/accept", protectRoute, workspaceController.acceptInvitation);
router.post(
  "/:workspaceId/invitations",
  protectRoute,
  workspaceController.invite,
);
router.delete(
  "/:workspaceId/invitations/:invitationId",
  protectRoute,
  workspaceController.revokeInvitation,
);
router.delete(
  "/:workspaceId/members/:memberId",
  protectRoute,
  workspaceController.removeMember,
);

export default router;
