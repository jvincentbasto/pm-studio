import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import Project from "../models/Project.js";

export const createExpiredGuestCleanup = ({
  UserModel = User,
  WorkspaceModel = Workspace,
  ProjectModel = Project,
  now = () => new Date(),
} = {}) => async () => {
  await UserModel.updateMany(
    {
      accountType: "guest",
      $or: [
        { guestExpiresAt: { $lte: now() } },
        {
          emailVerified: false,
          guestTokenExpiresAt: { $lte: now() },
        },
      ],
    },
    {
      $set: { accountType: "expired" },
      $unset: { guestTokenHash: 1, guestTokenExpiresAt: 1 },
    },
  );
  const expiredUsers = await UserModel.find({ accountType: "expired" }, "_id");
  if (!expiredUsers.length) return;

  const userIds = expiredUsers.map(({ _id }) => _id);
  const workspaces = await WorkspaceModel.find(
    { owner: { $in: userIds } },
    "_id",
  );
  const workspaceIds = workspaces.map(({ _id }) => _id);
  if (workspaceIds.length) {
    await ProjectModel.deleteMany({ workspace: { $in: workspaceIds } });
    await WorkspaceModel.deleteMany({ _id: { $in: workspaceIds } });
  }
  await WorkspaceModel.updateMany(
    { "members.user": { $in: userIds } },
    { $pull: { members: { user: { $in: userIds } } } },
  );
  await UserModel.deleteMany({
    _id: { $in: userIds },
    accountType: "expired",
  });
};

export const cleanupExpiredGuests = createExpiredGuestCleanup();
