import express from "express";
import { projectController } from "../controllers/project.controller.js";
import { taskController } from "../controllers/task.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";
import { requireWorkspaceMember } from "../middlewares/workspace.middleware.js";

const router = express.Router();
const authorizeWorkspace = [protectRoute, requireWorkspaceMember];

router.get(
  "/:workspaceId/projects",
  ...authorizeWorkspace,
  projectController.list,
);
router.post(
  "/:workspaceId/projects",
  ...authorizeWorkspace,
  projectController.create,
);
router.patch(
  "/:workspaceId/projects/:projectId",
  ...authorizeWorkspace,
  projectController.update,
);
router.delete(
  "/:workspaceId/projects/:projectId",
  ...authorizeWorkspace,
  projectController.remove,
);
router.get(
  "/:workspaceId/projects/:projectId/tasks",
  ...authorizeWorkspace,
  taskController.list,
);
router.post(
  "/:workspaceId/projects/:projectId/tasks",
  ...authorizeWorkspace,
  taskController.create,
);
router.patch(
  "/:workspaceId/projects/:projectId/tasks/:taskId",
  ...authorizeWorkspace,
  taskController.update,
);
router.delete(
  "/:workspaceId/projects/:projectId/tasks/:taskId",
  ...authorizeWorkspace,
  taskController.remove,
);

export default router;
