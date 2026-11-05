import Workspace from "../models/Workspace.js";

export const createRequireWorkspaceMember =
  ({ WorkspaceModel = Workspace } = {}) =>
  async (req, res, next) => {
    try {
      const workspace = await WorkspaceModel.findOne({
        _id: req.params.workspaceId,
        "members.user": req.user._id,
      });
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found." });
      }

      req.workspace = workspace;
      return next();
    } catch (error) {
      console.error("Could not verify workspace membership.", error?.name);
      return res.status(500).json({ error: "Could not load the workspace." });
    }
  };

export const requireWorkspaceMember = createRequireWorkspaceMember();
