import { Schema } from "mongoose";

import { ImporterState } from "../../tools/importers/types";

export const ImporterStateSchema = new Schema<ImporterState>(
  {
    type: { type: String, required: true },
    total: { type: Number, required: true },
    current: { type: Number, default: 0 },
    metadata: {},
    user: { type: Schema.Types.ObjectId, ref: "User" },
    scheduledFor: { type: Date },
    status: {
      type: String,
      enum: [
        "scheduled",
        "starting",
        "progress",
        "success",
        "failure",
        "failure-removed",
        "cancelled",
      ],
      default: "progress",
    },
  },
  { timestamps: true },
);
