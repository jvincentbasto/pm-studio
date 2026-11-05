export const guestResourceLimit = 10;

export const reserveGuestResource = (WorkspaceModel, workspaceId, field) =>
  WorkspaceModel.findOneAndUpdate(
    {
      _id: workspaceId,
      $expr: {
        $lt: [{ $ifNull: [`$${field}`, 0] }, guestResourceLimit],
      },
    },
    { $inc: { [field]: 1 } },
    { new: true },
  );

export const releaseGuestResource = async (
  WorkspaceModel,
  workspaceId,
  field,
  amount = 1,
) => {
  try {
    await WorkspaceModel.updateOne(
      { _id: workspaceId },
      { $inc: { [field]: -amount } },
    );
  } catch (error) {
    console.error("Could not release a guest resource limit.", error?.name);
  }
};
