import assert from "node:assert/strict";
import test from "node:test";
import { createProjectController } from "../src/controllers/project.controller.js";
import { createTaskController } from "../src/controllers/task.controller.js";
import { createRequireWorkspaceMember } from "../src/middlewares/workspace.middleware.js";

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const ownerRequest = {
  user: { _id: "000000000000000000000001" },
  workspace: {
    _id: "000000000000000000000010",
    members: [
      { user: "000000000000000000000001", role: "owner" },
      { user: "000000000000000000000002", role: "member" },
    ],
  },
  params: {
    workspaceId: "000000000000000000000010",
    projectId: "000000000000000000000020",
    taskId: "000000000000000000000030",
  },
};

test("project creation scopes project to current workspace", async () => {
  let attributes;
  const controller = createProjectController({
    ProjectModel: {
      create: async (value) => {
        attributes = value;
        return { _id: "project-1", ...value };
      },
    },
  });
  const res = createResponse();

  await controller.create(
    { ...ownerRequest, body: { name: "  Website  ", description: " Launch " } },
    res,
  );

  assert.equal(res.statusCode, 201);
  assert.deepEqual(attributes, {
    workspace: ownerRequest.workspace._id,
    name: "Website",
    description: "Launch",
  });
});

test("project list and deletion stay scoped to the current workspace", async () => {
  let listFilter;
  let deleteFilter;
  const controller = createProjectController({
    ProjectModel: {
      find: (filter) => {
        listFilter = filter;
        return { sort: async () => [{ _id: "project-1" }] };
      },
      findOneAndDelete: async (filter) => {
        deleteFilter = filter;
        return { tasks: [] };
      },
    },
  });
  const listRes = createResponse();
  const deleteRes = createResponse();

  await controller.list(ownerRequest, listRes);
  await controller.remove(ownerRequest, deleteRes);

  assert.deepEqual(listFilter, { workspace: ownerRequest.workspace._id });
  assert.deepEqual(deleteFilter, {
    _id: ownerRequest.params.projectId,
    workspace: ownerRequest.workspace._id,
  });
  assert.equal(deleteRes.statusCode, 200);
});

test("project update rejects an invalid name without changing data", async () => {
  let updated = false;
  const controller = createProjectController({
    ProjectModel: {
      findOneAndUpdate: async () => {
        updated = true;
      },
    },
  });
  const res = createResponse();

  await controller.update(
    { ...ownerRequest, body: { name: " " } },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(updated, false);
});

test("project update rejects null values before writing", async () => {
  let updated = false;
  const controller = createProjectController({
    ProjectModel: {
      findOneAndUpdate: async () => {
        updated = true;
      },
    },
  });
  const res = createResponse();

  await controller.update(
    { ...ownerRequest, body: { name: null } },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(updated, false);
});

test("guest project creation stops at ten workspace projects", async () => {
  let projectCreated = false;
  const controller = createProjectController({
    WorkspaceModel: {
      findOneAndUpdate: async () => null,
    },
    ProjectModel: {
      create: async () => {
        projectCreated = true;
      },
    },
  });
  const res = createResponse();

  await controller.create(
    {
      ...ownerRequest,
      user: { ...ownerRequest.user, accountType: "guest" },
      body: { name: "Another project" },
    },
    res,
  );

  assert.equal(res.statusCode, 429);
  assert.match(res.body.error, /10 projects/i);
  assert.equal(projectCreated, false);
});

test("deleting a guest project releases its project and task slots", async () => {
  const updates = [];
  const controller = createProjectController({
    WorkspaceModel: {
      updateOne: async (...args) => updates.push(args),
    },
    ProjectModel: {
      findOneAndDelete: async () => ({ tasks: [{}, {}] }),
    },
  });
  const res = createResponse();

  await controller.remove(
    {
      ...ownerRequest,
      user: { ...ownerRequest.user, accountType: "guest" },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    updates.map(([, update]) => update.$inc),
    [{ guestProjectCount: -1 }, { guestTaskCount: -2 }],
  );
});

test("task creation uses project and workspace and accepts a workspace assignee", async () => {
  let filter;
  let update;
  const controller = createTaskController({
    ProjectModel: {
      findOneAndUpdate: async (projectFilter, projectUpdate) => {
        filter = projectFilter;
        update = projectUpdate;
        return {
          tasks: [{ _id: "task-1", ...update.$push.tasks }],
        };
      },
    },
  });
  const res = createResponse();

  await controller.create(
    {
      ...ownerRequest,
      body: {
        title: "Build home page",
        status: "Todo",
        assignee: "000000000000000000000002",
        dueDate: "2026-12-01",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 201);
  assert.deepEqual(filter, {
    _id: ownerRequest.params.projectId,
    workspace: ownerRequest.workspace._id,
  });
  assert.deepEqual(update, {
    $push: {
      tasks: {
        title: "Build home page",
        description: "",
        status: "Todo",
        assignee: "000000000000000000000002",
        dueDate: new Date("2026-12-01"),
      },
    },
  });
});

test("task creation rejects assignees outside the workspace", async () => {
  let taskCreated = false;
  const controller = createTaskController({
    ProjectModel: {
      findOneAndUpdate: async () => {
        taskCreated = true;
      },
    },
  });
  const res = createResponse();

  await controller.create(
    {
      ...ownerRequest,
      body: { title: "Build home page", assignee: "000000000000000000000003" },
    },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(taskCreated, false);
});

test("guest task creation stops at ten workspace tasks", async () => {
  let taskCreated = false;
  const controller = createTaskController({
    WorkspaceModel: {
      findOneAndUpdate: async () => null,
    },
    ProjectModel: {
      findOneAndUpdate: async () => {
        taskCreated = true;
      },
    },
  });
  const res = createResponse();

  await controller.create(
    {
      ...ownerRequest,
      user: { ...ownerRequest.user, accountType: "guest" },
      body: { title: "Another task" },
    },
    res,
  );

  assert.equal(res.statusCode, 429);
  assert.match(res.body.error, /10 tasks/i);
  assert.equal(taskCreated, false);
});

test("deleting a guest task releases its task slot", async () => {
  const updates = [];
  const task = { _id: ownerRequest.params.taskId };
  const controller = createTaskController({
    WorkspaceModel: {
      updateOne: async (...args) => updates.push(args),
    },
    ProjectModel: {
      findOneAndUpdate: async () => ({ tasks: { id: () => task } }),
    },
  });
  const res = createResponse();

  await controller.remove(
    {
      ...ownerRequest,
      user: { ...ownerRequest.user, accountType: "guest" },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(updates[0][1].$inc, { guestTaskCount: -1 });
});

test("task update scopes the task and rejects assignees outside the workspace", async () => {
  let updated = false;
  const controller = createTaskController({
    ProjectModel: {
      findOneAndUpdate: async () => {
        updated = true;
      },
    },
  });
  const res = createResponse();

  await controller.update(
    {
      ...ownerRequest,
      body: { assignee: "000000000000000000000003" },
    },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(updated, false);
});

test("task update permits only the four Kanban statuses", async () => {
  let updated = false;
  const controller = createTaskController({
    ProjectModel: {
      findOneAndUpdate: async () => {
        updated = true;
      },
    },
  });
  const res = createResponse();

  await controller.update(
    { ...ownerRequest, body: { status: "Blocked" } },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(updated, false);
});

test("task list, update, and deletion are scoped to the current project", async () => {
  let listFilter;
  let updateFilter;
  let updateValues;
  let updateOptions;
  let deleteFilter;
  let deleteValues;
  const task = { _id: ownerRequest.params.taskId, status: "Todo" };
  const controller = createTaskController({
    ProjectModel: {
      findOne: (filter) => {
        listFilter = filter;
        return { populate: async () => ({ tasks: [task] }) };
      },
      findOneAndUpdate: (filter, update, options) => {
        if (update.$set) {
          updateFilter = filter;
          updateValues = update;
          updateOptions = options;
          return {
            populate: async () => ({
              tasks: { id: () => ({ ...task, status: "Done" }) },
            }),
          };
        }
        deleteFilter = filter;
        deleteValues = update;
        return Promise.resolve({ tasks: { id: () => task } });
      },
    },
  });
  const listRes = createResponse();
  const updateRes = createResponse();
  const deleteRes = createResponse();

  await controller.list(ownerRequest, listRes);
  await controller.update(
    { ...ownerRequest, body: { status: "Done" } },
    updateRes,
  );
  await controller.remove(ownerRequest, deleteRes);

  assert.deepEqual(listFilter, {
    _id: ownerRequest.params.projectId,
    workspace: ownerRequest.workspace._id,
  });
  assert.deepEqual(updateFilter, {
    _id: ownerRequest.params.projectId,
    workspace: ownerRequest.workspace._id,
    tasks: { $elemMatch: { _id: ownerRequest.params.taskId } },
  });
  assert.deepEqual(updateValues, {
    $set: { "tasks.$[task].status": "Done" },
  });
  assert.deepEqual(updateOptions.arrayFilters, [
    { "task._id": ownerRequest.params.taskId },
  ]);
  assert.deepEqual(deleteFilter, {
    _id: ownerRequest.params.projectId,
    workspace: ownerRequest.workspace._id,
  });
  assert.deepEqual(deleteValues, {
    $pull: { tasks: { _id: ownerRequest.params.taskId } },
  });
  assert.equal(updateRes.statusCode, 200);
  assert.equal(deleteRes.statusCode, 200);
});

test("workspace access middleware denies Guests that are not members", async () => {
  const middleware = createRequireWorkspaceMember({
    WorkspaceModel: {
      findOne: async (filter) => {
        assert.deepEqual(filter, {
          _id: ownerRequest.params.workspaceId,
          "members.user": "guest-user",
        });
        return null;
      },
    },
  });
  const res = createResponse();
  let nextCalled = false;

  await middleware(
    { ...ownerRequest, user: { _id: "guest-user", accountType: "guest" } },
    res,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 404);
  assert.equal(nextCalled, false);
});
