import { Types } from "mongoose";

import { TrackedPlaylistModel } from "../Models";
import { TrackedPlaylist } from "../schemas/trackedPlaylist";

export async function getTrackedPlaylistsForUser(
  ownerId: string,
): Promise<TrackedPlaylist[]> {
  return TrackedPlaylistModel.find({ owner: new Types.ObjectId(ownerId) })
    .sort({ lastChangedAt: -1, updatedAt: -1 })
    .lean<TrackedPlaylist[]>();
}

export async function removeTrackedPlaylist(
  ownerId: string,
  id: string,
): Promise<boolean> {
  if (!Types.ObjectId.isValid(id)) {
    return false;
  }
  const result = await TrackedPlaylistModel.deleteOne({
    _id: new Types.ObjectId(id),
    owner: new Types.ObjectId(ownerId),
  });
  return result.deletedCount > 0;
}
