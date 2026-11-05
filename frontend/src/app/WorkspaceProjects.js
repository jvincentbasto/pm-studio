"use client";

import { useCallback, useEffect, useState } from "react";

const statuses = ["Backlog", "Todo", "In Progress", "Done"];
const inputClass =
  "w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30";
const buttonClass =
  "rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-60";
const idOf = (item) => item?.id ?? item?._id;

function taskDraft(task) {
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    assignee:
      typeof task.assignee === "object"
        ? (idOf(task.assignee) ?? "")
        : (task.assignee ?? ""),
    dueDate: task.dueDate
      ? new Date(task.dueDate).toISOString().slice(0, 10)
      : "",
  };
}

function TaskCard({ task, members, busy, onSave, onDelete }) {
  const [draft, setDraft] = useState(() => taskDraft(task));
  const setField = (field) => (event) =>
    setDraft((current) => ({ ...current, [field]: event.target.value }));
  const assignee = members.find((member) => member.id === draft.assignee);
  const assigneeName = assignee
    ? [assignee.firstName, assignee.lastName].filter(Boolean).join(" ") ||
      assignee.email
    : "";

  useEffect(() => setDraft(taskDraft(task)), [task]);

  return (
    <article className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-3">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(idOf(task), draft);
        }}
      >
        <div>
          <label
            className="mb-1 block text-xs text-slate-300"
            htmlFor={`task-title-${idOf(task)}`}
          >
            Task title
          </label>
          <input
            className={inputClass}
            id={`task-title-${idOf(task)}`}
            maxLength={120}
            onChange={setField("title")}
            required
            value={draft.title}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs text-slate-300"
            htmlFor={`task-description-${idOf(task)}`}
          >
            Description
          </label>
          <textarea
            className={inputClass}
            id={`task-description-${idOf(task)}`}
            maxLength={2000}
            onChange={setField("description")}
            rows={2}
            value={draft.description}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs text-slate-300"
            htmlFor={`task-status-${idOf(task)}`}
          >
            Task status
          </label>
          <select
            className={inputClass}
            id={`task-status-${idOf(task)}`}
            onChange={setField("status")}
            value={draft.status}
          >
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="mb-1 block text-xs text-slate-300"
            htmlFor={`task-assignee-${idOf(task)}`}
          >
            Assignee
          </label>
          <select
            className={inputClass}
            id={`task-assignee-${idOf(task)}`}
            onChange={setField("assignee")}
            value={draft.assignee}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {[member.firstName, member.lastName]
                  .filter(Boolean)
                  .join(" ") || member.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="mb-1 block text-xs text-slate-300"
            htmlFor={`task-due-date-${idOf(task)}`}
          >
            Due date
          </label>
          <input
            className={inputClass}
            id={`task-due-date-${idOf(task)}`}
            onChange={setField("dueDate")}
            type="date"
            value={draft.dueDate}
          />
        </div>
        <div className="flex justify-between gap-2">
          <button
            className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            Save task
          </button>
          <button
            className="text-sm text-rose-300 underline underline-offset-2"
            disabled={busy}
            onClick={() => onDelete(idOf(task))}
            type="button"
          >
            Delete task
          </button>
        </div>
      </form>
      {assigneeName && (
        <p className="text-xs text-slate-400">Assigned to {assigneeName}</p>
      )}
    </article>
  );
}

export default function WorkspaceProjects({ workspace, request }) {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [editingProject, setEditingProject] = useState(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const workspacePath = `/api/workspaces/${workspace.id}`;
  const loadProjects = useCallback(async () => {
    const body = await request(`${workspacePath}/projects`);
    setProjects(body.projects);
  }, [request, workspacePath]);

  useEffect(() => {
    loadProjects().catch((loadError) => setError(loadError.message));
  }, [loadProjects]);

  useEffect(() => {
    if (!selectedProjectId) {
      setTasks([]);
      return;
    }

    let active = true;
    request(`${workspacePath}/projects/${selectedProjectId}/tasks`)
      .then(({ tasks: currentTasks }) => {
        if (active) setTasks(currentTasks);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });
    return () => {
      active = false;
    };
  }, [request, selectedProjectId, workspacePath]);

  async function perform(action) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitProject(event) {
    event.preventDefault();
    await perform(async () => {
      if (editingProject) {
        await request(`${workspacePath}/projects/${idOf(editingProject)}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: projectName,
            description: projectDescription,
          }),
        });
        setEditingProject(null);
      } else {
        const { project } = await request(`${workspacePath}/projects`, {
          method: "POST",
          body: JSON.stringify({
            name: projectName,
            description: projectDescription,
          }),
        });
        setSelectedProjectId(idOf(project));
      }
      setProjectName("");
      setProjectDescription("");
      await loadProjects();
    });
  }

  async function deleteProject(project) {
    if (!window.confirm(`Delete "${project.name}" and its tasks?`)) return;
    await perform(async () => {
      await request(`${workspacePath}/projects/${idOf(project)}`, {
        method: "DELETE",
      });
      if (selectedProjectId === idOf(project)) setSelectedProjectId("");
      if (idOf(editingProject) === idOf(project)) setEditingProject(null);
      await loadProjects();
    });
  }

  async function submitTask(event) {
    event.preventDefault();
    await perform(async () => {
      const { task } = await request(
        `${workspacePath}/projects/${selectedProjectId}/tasks`,
        {
          method: "POST",
          body: JSON.stringify({
            title: taskTitle,
            description: taskDescription,
            assignee: taskAssignee || null,
            dueDate: taskDueDate || null,
          }),
        },
      );
      setTasks((current) => [...current, task]);
      setTaskTitle("");
      setTaskDescription("");
      setTaskAssignee("");
      setTaskDueDate("");
    });
  }

  async function updateTask(taskId, updates) {
    await perform(async () => {
      const { task } = await request(
        `${workspacePath}/projects/${selectedProjectId}/tasks/${taskId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...updates,
            assignee: updates.assignee || null,
            dueDate: updates.dueDate || null,
          }),
        },
      );
      setTasks((current) =>
        current.map((item) => (idOf(item) === taskId ? task : item)),
      );
    });
  }

  async function deleteTask(taskId) {
    if (!window.confirm("Delete this task?")) return;
    await perform(async () => {
      await request(
        `${workspacePath}/projects/${selectedProjectId}/tasks/${taskId}`,
        { method: "DELETE" },
      );
      setTasks((current) => current.filter((task) => idOf(task) !== taskId));
    });
  }

  const selectedProject = projects.find(
    (project) => idOf(project) === selectedProjectId,
  );

  return (
    <section className="space-y-4 border-t border-slate-700 pt-4">
      <h4 className="font-semibold">Projects</h4>
      <form
        className="grid gap-2 md:grid-cols-[1fr_2fr_auto]"
        onSubmit={submitProject}
      >
        <label className="sr-only" htmlFor={`project-name-${workspace.id}`}>
          Project name
        </label>
        <input
          className={inputClass}
          id={`project-name-${workspace.id}`}
          maxLength={80}
          minLength={2}
          onChange={(event) => setProjectName(event.target.value)}
          placeholder="Project name"
          required
          value={projectName}
        />
        <label
          className="sr-only"
          htmlFor={`project-description-${workspace.id}`}
        >
          Project description
        </label>
        <input
          className={inputClass}
          id={`project-description-${workspace.id}`}
          maxLength={1000}
          onChange={(event) => setProjectDescription(event.target.value)}
          placeholder="Description (optional)"
          value={projectDescription}
        />
        <button
          className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-60"
          disabled={busy}
          type="submit"
        >
          {editingProject ? "Save project" : "Create project"}
        </button>
        {editingProject && (
          <button
            className={buttonClass}
            onClick={() => {
              setEditingProject(null);
              setProjectName("");
              setProjectDescription("");
            }}
            type="button"
          >
            Cancel edit
          </button>
        )}
      </form>

      {projects.length ? (
        <ul className="flex flex-wrap gap-2">
          {projects.map((project) => (
            <li className="flex items-center gap-1" key={idOf(project)}>
              <button
                aria-pressed={selectedProjectId === idOf(project)}
                className={`rounded-lg px-3 py-2 text-sm ${
                  selectedProjectId === idOf(project)
                    ? "bg-cyan-300 font-semibold text-slate-950"
                    : "border border-slate-600 hover:bg-slate-800"
                }`}
                onClick={() => setSelectedProjectId(idOf(project))}
                type="button"
              >
                {project.name}
              </button>
              <button
                aria-label={`Edit ${project.name}`}
                className={buttonClass}
                onClick={() => {
                  setEditingProject(project);
                  setProjectName(project.name);
                  setProjectDescription(project.description ?? "");
                }}
                type="button"
              >
                Edit
              </button>
              <button
                aria-label={`Delete ${project.name}`}
                className="px-2 py-2 text-sm text-rose-300"
                disabled={busy}
                onClick={() => deleteProject(project)}
                type="button"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">
          No projects yet. Create a project to get started.
        </p>
      )}

      {selectedProject && (
        <div className="space-y-4">
          <div>
            <h5 className="text-lg font-semibold">{selectedProject.name}</h5>
            {selectedProject.description && (
              <p className="text-sm text-slate-400">
                {selectedProject.description}
              </p>
            )}
          </div>
          <form
            className="grid gap-2 md:grid-cols-2 xl:grid-cols-4"
            onSubmit={submitTask}
          >
            <label className="sr-only" htmlFor={`task-title-${workspace.id}`}>
              New task title
            </label>
            <input
              className={inputClass}
              id={`task-title-${workspace.id}`}
              maxLength={120}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder="New task title"
              required
              value={taskTitle}
            />
            <label
              className="sr-only"
              htmlFor={`task-description-${workspace.id}`}
            >
              New task description
            </label>
            <input
              className={inputClass}
              id={`task-description-${workspace.id}`}
              maxLength={2000}
              onChange={(event) => setTaskDescription(event.target.value)}
              placeholder="Description (optional)"
              value={taskDescription}
            />
            <label
              className="sr-only"
              htmlFor={`task-assignee-${workspace.id}`}
            >
              New task assignee
            </label>
            <select
              className={inputClass}
              id={`task-assignee-${workspace.id}`}
              onChange={(event) => setTaskAssignee(event.target.value)}
              value={taskAssignee}
            >
              <option value="">Unassigned</option>
              {workspace.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {[member.firstName, member.lastName]
                    .filter(Boolean)
                    .join(" ") || member.email}
                </option>
              ))}
            </select>
            <label
              className="sr-only"
              htmlFor={`task-due-date-${workspace.id}`}
            >
              New task due date
            </label>
            <input
              className={inputClass}
              id={`task-due-date-${workspace.id}`}
              onChange={(event) => setTaskDueDate(event.target.value)}
              type="date"
              value={taskDueDate}
            />
            <button
              className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-60 md:col-span-2 xl:col-span-4"
              disabled={busy}
              type="submit"
            >
              Add task
            </button>
          </form>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statuses.map((status) => (
              <section
                aria-label={`${status} tasks`}
                className="min-w-0 space-y-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3"
                key={status}
              >
                <h6 className="font-semibold">{status}</h6>
                {tasks
                  .filter((task) => task.status === status)
                  .map((task) => (
                    <TaskCard
                      busy={busy}
                      key={idOf(task)}
                      members={workspace.members}
                      onDelete={deleteTask}
                      onSave={updateTask}
                      task={task}
                    />
                  ))}
              </section>
            ))}
          </div>
        </div>
      )}

      {error && (
        <output
          aria-live="polite"
          className="block rounded-lg border border-red-400/50 bg-red-950/40 px-3 py-2 text-sm text-red-200"
        >
          {error}
        </output>
      )}
    </section>
  );
}
