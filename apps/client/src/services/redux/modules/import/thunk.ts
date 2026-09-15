import { api } from "../../../apis/api";
import { myAsyncThunk } from "../../tools";
import { alertMessage } from "../message/reducer";
import { selectImportStates } from "./selector";
import { ImporterState } from "./types";

export const getImports = myAsyncThunk<
  ImporterState[] | null,
  boolean | undefined
>("@import/get", async (force, tapi) => {
  if (!force && selectImportStates(tapi.getState())) {
    return null;
  }
  const { data: imports } = await api.getImports();
  return imports;
});

export const startImportPrivacy = myAsyncThunk<
  void,
  { files?: FileList; id?: string; scheduledFor?: string }
>("@import/privacy-start", async ({ files, id, scheduledFor }, tapi) => {
  try {
    if (!id) {
      if (!files) {
        return;
      }
      const filesArray = Array.from(Array(files.length).keys())
        .map((i) => files.item(i))
        .filter((f) => f);
      await api.doImportPrivacy(filesArray as File[], scheduledFor);
    } else {
      await api.retryImport(id);
    }
    tapi.dispatch(getImports(true)).catch(console.error);
    tapi.dispatch(
      alertMessage({
        level: "success",
        message: scheduledFor
          ? `Import scheduled for ${new Date(scheduledFor).toLocaleString()}`
          : "Import started",
      }),
    );
  } catch (e: any) {
    if (e?.response?.data?.code === "ALREADY_IMPORTING") {
      tapi.dispatch(
        alertMessage({
          level: "error",
          message: "An import is already running on this account.",
        }),
      );
    } else if (e?.response?.data?.code === "IMPORT_INIT_FAILED") {
      tapi.dispatch(
        alertMessage({
          level: "error",
          message:
            "Could not start the import. Check the selected files and try again.",
        }),
      );
    }
    console.error(e);
  }
});

export const startImportFullPrivacy = myAsyncThunk<
  void,
  { files?: FileList; id?: string; scheduledFor?: string }
>("@import/full-privacy-start", async ({ files, id, scheduledFor }, tapi) => {
  try {
    if (!id) {
      if (!files) {
        return;
      }
      const filesArray = Array.from(Array(files.length).keys())
        .map((i) => files.item(i))
        .filter((f) => f);
      await api.doImportFullPrivacy(filesArray as File[], scheduledFor);
    } else {
      await api.retryImport(id);
    }
    tapi.dispatch(getImports(true)).catch(console.error);
    tapi.dispatch(
      alertMessage({
        level: "success",
        message: scheduledFor
          ? `Import scheduled for ${new Date(scheduledFor).toLocaleString()}`
          : "Import started",
      }),
    );
  } catch (e: any) {
    if (e?.response?.data?.code === "ALREADY_IMPORTING") {
      tapi.dispatch(
        alertMessage({
          level: "error",
          message: "An import is already running on this account.",
        }),
      );
    } else if (e?.response?.data?.code === "IMPORT_INIT_FAILED") {
      tapi.dispatch(
        alertMessage({
          level: "error",
          message:
            "Could not start the import. Check the selected files and try again.",
        }),
      );
    }
    console.error(e);
  }
});

export const cleanupImport = myAsyncThunk<void, string>(
  "@import/cleanup",
  async (id, tapi) => {
    try {
      await api.cleanupImport(id);
      tapi.dispatch(
        alertMessage({ level: "success", message: "Import cleaned up" }),
      );
      tapi.dispatch(getImports(true)).catch(console.error);
    } catch {
      tapi.dispatch(
        alertMessage({
          level: "error",
          message: "Could not clean up the import.",
        }),
      );
    }
  },
);

export const cancelScheduledImport = myAsyncThunk<void, string>(
  "@import/cancel-scheduled",
  async (id, tapi) => {
    try {
      await api.cancelScheduledImport(id);
      tapi.dispatch(
        alertMessage({
          level: "success",
          message: "Scheduled import cancelled",
        }),
      );
      tapi.dispatch(getImports(true)).catch(console.error);
    } catch {
      tapi.dispatch(
        alertMessage({
          level: "error",
          message:
            "Could not cancel the scheduled import. Refresh to check its status.",
        }),
      );
    }
  },
);
