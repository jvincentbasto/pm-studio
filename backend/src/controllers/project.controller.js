import Project from "../models/Project.js";
import Workspace from "../models/Workspace.js";
import {
  releaseGuestResource,
  reserveGuestResource,
} from "../lib/guest-limits.js";

const validProject = ({ name, description }) =>
  typeof name === "string" &&
  name.trim().length >= 2 &&
  name.trim().length <= 80 &&
  (description === undefined ||
    (typeof description === "string" && description.length <= 1000));

const validProjectUpdate = ({ name, description }) =>
  (name === undefined ||
    (typeof name === "string" &&
      name.trim().length >= 2 &&
      name.trim().length <= 80)) &&
  (description === undefined ||
    (typeof description === "string" && description.length <= 1000));

export const createProjectController = ({
  ProjectModel = Project,
  WorkspaceModel = Workspace,
} = {}) => {
  const list = async (req, res) => {
    try {
      const projects = await ProjectModel.find({
        workspace: req.workspace._id,
      }).sort({ createdAt: 1 });
      return res.status(200).json({ projects });
    } catch (error) {
      console.error("Could not load projects.", error?.name);
      return res.status(500).json({ error: "Could not load projects." });
    }
  };

  const create = async (req, res) => {
    const { name, description } = req.body ?? {};
    if (!validProject({ name, description })) {
      return res.status(400).json({
        error: "Project name must be 2 to 80 characters; description max is 1000.",
      });
    }

    let reserved = false;
    try {
      if (req.user.accountType === "guest") {
        if (
          !(await reserveGuestResource(
            WorkspaceModel,
            req.workspace._id,
            "guestProjectCount",
          ))
        ) {
          return res.status(429).json({
            error: "Guest limit reached: 10 projects. Upgrade to keep going.",
          });
        }
        reserved = true;
      }

      const project = await ProjectModel.create({
        workspace: req.workspace._id,
        name: name.trim(),
        description: description?.trim() ?? "",
      });
      return res.status(201).json({ project });
    } catch (error) {
      if (reserved) {
        await releaseGuestResource(
          WorkspaceModel,
          req.workspace._id,
          "guestProjectCount",
        );
      }
      console.error("Could not create project.", error?.name);
      return res.status(500).json({ error: "Could not create the project." });
    }
  };

  const update = async (req, res) => {
    const body = req.body ?? {};
    const updates = {};
    if ("name" in body) updates.name = body.name;
    if ("description" in body) updates.description = body.description;
    if (!Object.keys(updates).length || !validProjectUpdate(updates)) {
      return res.status(400).json({ error: "Enter valid project details." });
    }
    if (typeof updates.name === "string") updates.name = updates.name.trim();
    if (typeof updates.description === "string") {
      updates.description = updates.description.trim();
    }

    try {
      const project = await ProjectModel.findOneAndUpdate(
        {
          _id: req.params.projectId,
          workspace: req.workspace._id,
        },
        { $set: updates },
        { new: true, runValidators: true },
      );
      if (!project) {
        return res.status(404).json({ error: "Project not found." });
      }
      return res.status(200).json({ project });
    } catch (error) {
      console.error("Could not update project.", error?.name);
      return res.status(500).json({ error: "Could not update the project." });
    }
  };

  const remove = async (req, res) => {
    try {
      const project = await ProjectModel.findOneAndDelete({
        _id: req.params.projectId,
        workspace: req.workspace._id,
      });
      if (!project) {
        return res.status(404).json({ error: "Project not found." });
      }
      if (req.user.accountType === "guest") {
        await Promise.all([
          releaseGuestResource(
            WorkspaceModel,
            req.workspace._id,
            "guestProjectCount",
          ),
          releaseGuestResource(
            WorkspaceModel,
            req.workspace._id,
            "guestTaskCount",
            project.tasks.length,
          ),
        ]);
      }
      return res.status(200).json({ message: "Project deleted." });
    } catch (error) {
      console.error("Could not delete project.", error?.name);
      return res.status(500).json({ error: "Could not delete the project." });
    }
  };

  return { list, create, update, remove };
};

export const projectController = createProjectController();
