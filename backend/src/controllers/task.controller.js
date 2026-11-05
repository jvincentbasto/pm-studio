import Project from "../models/Project.js";
import Workspace from "../models/Workspace.js";
import {
  releaseGuestResource,
  reserveGuestResource,
} from "../lib/guest-limits.js";

const statuses = ["Backlog", "Todo", "In Progress", "Done"];
const validTaskFields = ({ title, description, status, dueDate }) =>
  (title === undefined ||
    (typeof title === "string" &&
      title.trim().length > 0 &&
      title.trim().length <= 120)) &&
  (description === undefined ||
    (typeof description === "string" && description.length <= 2000)) &&
  (status === undefined || statuses.includes(status)) &&
  (dueDate === undefined ||
    dueDate === null ||
    (typeof dueDate === "string" && !Number.isNaN(Date.parse(dueDate))));

const projectFilter = (req) => ({
  _id: req.params.projectId,
  workspace: req.workspace._id,
});
const isWorkspaceMember = (workspace, userId) =>
  workspace.members.some(
    (member) => String(member.user?._id ?? member.user) === String(userId),
  );
const normalizeTask = (task) => ({
  title: task.title,
  description: task.description,
  status: task.status,
  assignee: task.assignee ?? null,
  dueDate: task.dueDate ?? null,
});

export const createTaskController = ({
  ProjectModel = Project,
  WorkspaceModel = Workspace,
} = {}) => {
  const list = async (req, res) => {
    try {
      const project = await ProjectModel.findOne(projectFilter(req))
        .populate("tasks.assignee", "firstName lastName email");
      if (!project) {
        return res.status(404).json({ error: "Project not found." });
      }
      return res.status(200).json({ tasks: project.tasks });
    } catch (error) {
      console.error("Could not load project tasks.", error?.name);
      return res.status(500).json({ error: "Could not load project tasks." });
    }
  };

  const create = async (req, res) => {
    const body = req.body ?? {};
    if (!validTaskFields(body) || typeof body.title !== "string") {
      return res.status(400).json({ error: "Enter valid task details." });
    }

    const assignee = body.assignee || null;
    if (assignee && !isWorkspaceMember(req.workspace, assignee)) {
      return res
        .status(400)
        .json({ error: "Assignee must belong to this workspace." });
    }

    let reserved = false;
    try {
      if (req.user.accountType === "guest") {
        if (
          !(await reserveGuestResource(
            WorkspaceModel,
            req.workspace._id,
            "guestTaskCount",
          ))
        ) {
          return res.status(429).json({
            error: "Guest limit reached: 10 tasks. Upgrade to keep going.",
          });
        }
        reserved = true;
      }

      const updatedProject = await ProjectModel.findOneAndUpdate(
        projectFilter(req),
        {
          $push: {
            tasks: {
              ...normalizeTask({
                title: body.title.trim(),
                description: body.description?.trim() ?? "",
                status: body.status ?? "Backlog",
                assignee,
                dueDate: body.dueDate ? new Date(body.dueDate) : null,
              }),
            },
          },
        },
        { new: true, runValidators: true },
      );
      const task = updatedProject?.tasks.at(-1);
      if (!task) {
        if (reserved) {
          await releaseGuestResource(
            WorkspaceModel,
            req.workspace._id,
            "guestTaskCount",
          );
        }
        return res.status(404).json({ error: "Project not found." });
      }
      return res.status(201).json({ task });
    } catch (error) {
      if (reserved) {
        await releaseGuestResource(
          WorkspaceModel,
          req.workspace._id,
          "guestTaskCount",
        );
      }
      console.error("Could not create task.", error?.name);
      return res.status(500).json({ error: "Could not create the task." });
    }
  };

  const update = async (req, res) => {
    const body = req.body ?? {};
    const updates = {};
    for (const field of ["title", "description", "status", "dueDate", "assignee"]) {
      if (field in body) updates[field] = body[field];
    }
    if (!Object.keys(updates).length || !validTaskFields(updates)) {
      return res.status(400).json({ error: "Enter valid task details." });
    }
    if (typeof updates.title === "string") updates.title = updates.title.trim();
    if (typeof updates.description === "string") {
      updates.description = updates.description.trim();
    }
    if (updates.dueDate) updates.dueDate = new Date(updates.dueDate);
    if (updates.assignee === "") updates.assignee = null;
    if (
      updates.assignee &&
      !isWorkspaceMember(req.workspace, updates.assignee)
    ) {
      return res
        .status(400)
        .json({ error: "Assignee must belong to this workspace." });
    }
    for (const field of Object.keys(updates)) {
      updates[`tasks.$[task].${field}`] = updates[field];
      delete updates[field];
    }

    try {
      const project = await ProjectModel.findOneAndUpdate(
        {
          ...projectFilter(req),
          tasks: { $elemMatch: { _id: req.params.taskId } },
        },
        { $set: updates },
        {
          new: true,
          runValidators: true,
          arrayFilters: [{ "task._id": req.params.taskId }],
        },
      ).populate("tasks.assignee", "firstName lastName email");
      if (!project) {
        return res.status(404).json({ error: "Task not found." });
      }
      const task = project.tasks.id(req.params.taskId);
      return res.status(200).json({ task });
    } catch (error) {
      console.error("Could not update task.", error?.name);
      return res.status(500).json({ error: "Could not update the task." });
    }
  };

  const remove = async (req, res) => {
    try {
      const project = await ProjectModel.findOneAndUpdate(
        projectFilter(req),
        { $pull: { tasks: { _id: req.params.taskId } } },
      );
      if (!project) {
        return res.status(404).json({ error: "Project not found." });
      }
      if (project.tasks.id(req.params.taskId)) {
        if (req.user.accountType === "guest") {
          await releaseGuestResource(
            WorkspaceModel,
            req.workspace._id,
            "guestTaskCount",
          );
        }
        return res.status(200).json({ message: "Task deleted." });
      }
      return res.status(404).json({ error: "Task not found." });
    } catch (error) {
      console.error("Could not delete task.", error?.name);
      return res.status(500).json({ error: "Could not delete the task." });
    }
  };

  return { list, create, update, remove };
};

export const taskController = createTaskController();
