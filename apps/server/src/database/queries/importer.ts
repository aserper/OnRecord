import {
  ImporterState,
  ImporterStateFromType,
  ImporterStateStatus,
  ImporterStateType,
} from "../../tools/importers/types";
import { ImporterStateModel } from "../Models";

export const createImporterState = (
  userId: string,
  state: Omit<ImporterState, "_id" | "user">,
) =>
  ImporterStateModel.create({ user: userId, ...state } as Omit<
    ImporterState,
    "_id" | "user"
  >);

export const setImporterStateStatus = (
  id: string,
  status: ImporterStateStatus,
) => ImporterStateModel.findByIdAndUpdate(id, { status });
export const startImporterState = (id: string, total: number) =>
  ImporterStateModel.findByIdAndUpdate(id, { status: "progress", total });

export const getDueScheduledImports = (now = new Date()) =>
  ImporterStateModel.find({
    status: "scheduled",
    scheduledFor: { $lte: now },
  }).sort({ scheduledFor: 1 });

export const claimScheduledImport = (id: string) =>
  ImporterStateModel.findOneAndUpdate(
    { _id: id, status: "scheduled", scheduledFor: { $lte: new Date() } },
    { status: "starting" },
    { new: true },
  );
export const cancelScheduledImporterState = (id: string) =>
  ImporterStateModel.findOneAndUpdate(
    { _id: id, status: "scheduled" },
    { status: "cancelled" },
    { new: true },
  );

export const getImporterState = <T extends ImporterStateType>(id: string) =>
  ImporterStateModel.findById<ImporterStateFromType<T>>(id);

export const setImporterStateMetadata = <T extends ImporterState["metadata"]>(
  id: string,
  metadata: T,
) => ImporterStateModel.findByIdAndUpdate(id, { metadata }, { new: true });

export const setImporterStateCurrent = (id: string, current: number) =>
  ImporterStateModel.findByIdAndUpdate(id, { current });

export const getUserImporterState = async (userId: string) =>
  ImporterStateModel.find({ user: userId }).sort({ createdAt: -1 });

export const fixRunningImportsAtStart = () =>
  ImporterStateModel.updateMany(
    { status: { $in: ["starting", "progress"] } },
    { status: "failure" },
  );
