import Workspace from "../models/Workspace.js";

export const createWorkspaceController = ({
  WorkspaceModel = Workspace,
} = {}) => {
  const list = async (req, res) => {
    try {
      const workspaces = await WorkspaceModel.find({
        "members.user": req.user._id,
      }).sort({ createdAt: 1 });
      return res.status(200).json({ workspaces });
    } catch (error) {
      console.error("Could not load workspaces.", error);
      return res.status(500).json({ error: "Could not load workspaces." });
    }
  };

  const create = async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (name.length < 2 || name.length > 80) {
      return res
        .status(400)
        .json({ error: "Workspace name must be 2 to 80 characters." });
    }

    try {
      const workspace = await WorkspaceModel.create({
        name,
        owner: req.user._id,
        members: [{ user: req.user._id, role: "owner" }],
      });
      return res.status(201).json({ workspace });
    } catch (error) {
      console.error("Could not create workspace.", error);
      return res.status(500).json({ error: "Could not create workspace." });
    }
  };

  return { list, create };
};

export const workspaceController = createWorkspaceController();
