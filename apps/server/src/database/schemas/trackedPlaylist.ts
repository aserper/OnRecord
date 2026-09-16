import { Schema, Types } from "mongoose";

export interface PlaylistTrackChangeItem {
  id: string;
  name: string;
  artists: string[];
}

export interface PlaylistChange {
  detectedAt: Date;
  added: PlaylistTrackChangeItem[];
  removed: PlaylistTrackChangeItem[];
}

export interface TrackedPlaylist {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  spotifyId: string;
  name: string;
  imageUrl?: string;
  trackCount: number;
  /** Ordered snapshot of unique track ids at the last successful check. */
  trackIds: string[];
  lastCheckedAt?: Date;
  lastChangedAt?: Date;
  lastError?: string;
  /** Oldest first, capped to the 50 most recent changes. */
  changes: PlaylistChange[];
}

export const MAX_STORED_CHANGES = 50;

export const TrackedPlaylistSchema = new Schema<TrackedPlaylist>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    spotifyId: { type: String, required: true },
    name: { type: String, required: true },
    imageUrl: { type: String },
    trackCount: { type: Number, required: true, default: 0 },
    trackIds: { type: [String], required: true, default: [] },
    lastCheckedAt: { type: Date },
    lastChangedAt: { type: Date },
    lastError: { type: String },
    changes: { type: [], default: [] },
  },
  { timestamps: true },
);

TrackedPlaylistSchema.index({ owner: 1, spotifyId: 1 }, { unique: true });
TrackedPlaylistSchema.index({ owner: 1, lastChangedAt: -1 });
