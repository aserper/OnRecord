import { Types } from "mongoose";

import { getUserFromField } from "../../database";
import {
  cancelScheduledImporterState,
  createImporterState,
  getImporterState,
  startImporterState,
  setImporterStateStatus,
} from "../../database/queries/importer";
import { User } from "../../database/schemas/user";
import { logger } from "../logger";
import { Metrics } from "../metrics";
import { clearCache } from "./cache";
import { FullPrivacyImporter } from "./full_privacy";
import { PrivacyImporter } from "./privacy";
import {
  HistoryImporter,
  ImporterStateFromType,
  ImporterStateType,
} from "./types";

const importers: {
  [typ in ImporterStateType]: (user: User) => HistoryImporter<typ>;
} = {
  privacy: (user: User) => new PrivacyImporter(user),
  "full-privacy": (user: User) => new FullPrivacyImporter(user),
} as const;

const userImporters: { [userId: string]: HistoryImporter<any> | null } = {};

export function canUserImport(userId: string) {
  return !(userId in userImporters);
}
export async function cleanupImport(existingStateId: string) {
  const importState = await getImporterState(existingStateId);
  if (!importState) {
    return;
  }
  const { type, status } = importState;
  if (status !== "failure") {
    return;
  }
  await setImporterStateStatus(existingStateId, "failure-removed");
  const instanceClass = importers[type];
  if (!instanceClass) {
    return;
  }
  const user = await getUserFromField("_id", importState.user, false);
  if (!user) {
    return;
  }
  const instance = instanceClass(user);
  try {
    await instance.cleanup(importState.metadata);
  } catch {
    // nothing
  }
}

export async function runImporter<T extends ImporterStateType>(
  existingStateId: string | null,
  name: T,
  userId: string,
  requiredInitData: ImporterStateFromType<T>["metadata"],
  initDone: (success: boolean) => void,
) {
  if (userId in userImporters) {
    return initDone(false);
  }
  userImporters[userId] = null;
  const user = await getUserFromField("_id", new Types.ObjectId(userId), true);
  if (!user) {
    logger.error(`User with id ${userId} was not found`);
    Metrics.importsTotal
      .labels({ status: "failure", user: userId, type: name })
      .inc();
    if (existingStateId) {
      await setImporterStateStatus(existingStateId, "failure");
    }
    delete userImporters[userId];
    return initDone(false);
  }
  const importerClass = importers[name];
  if (!importerClass) {
    logger.error(`${name} importer was not found`);
    Metrics.importsTotal
      .labels({ status: "failure", user: userId, type: name })
      .inc();
    if (existingStateId) {
      await setImporterStateStatus(existingStateId, "failure");
    }
    delete userImporters[userId];
    return initDone(false);
  }
  if (!user.accessToken || !user.refreshToken) {
    logger.error(`User ${user.username} has no accessToken or no refreshToken`);
    Metrics.importsTotal
      .labels({ status: "failure", user: userId, type: name })
      .inc();
    if (existingStateId) {
      await setImporterStateStatus(existingStateId, "failure");
    }
    delete userImporters[userId];
    return initDone(false);
  }
  const instance = importerClass(user) as unknown as HistoryImporter<T>;
  userImporters[userId] = instance;
  clearCache(userId);
  let existingState: ImporterStateFromType<T> | null = null;
  try {
    if (existingStateId) {
      existingState = (await getImporterState<T>(existingStateId)) ?? null;
    }
    const initedMetadata = await instance.init(existingState, requiredInitData);
    if (!initedMetadata) {
      if (existingState) {
        await cleanupImport(existingState._id.toString());
      }
      return initDone(false);
    }
    if (existingState) {
      await startImporterState(
        existingState._id.toString(),
        initedMetadata.total,
      );
    }
    if (!existingState) {
      const data = {
        type: name,
        current: 0,
        total: initedMetadata.total,
        metadata: requiredInitData,
        status: "progress",
      } as ImporterStateFromType<T>;
      existingState = (await createImporterState(
        userId,
        data,
      )) as any as ImporterStateFromType<T>;
    }
    initDone(true);
    await instance.run(existingState._id.toString());
    await instance.cleanup(requiredInitData);
    await setImporterStateStatus(existingState._id.toString(), "success");
    Metrics.importsTotal
      .labels({ status: "success", user: userId, type: name })
      .inc();
  } catch (e) {
    if (existingState) {
      await setImporterStateStatus(existingState._id.toString(), "failure");
      Metrics.importsTotal
        .labels({ status: "failure", user: userId, type: name })
        .inc();
    }
    logger.error(e);
    logger.error(
      "This import failed, but metadata is kept so that you can retry it later in the settings",
    );
  } finally {
    clearCache(userId);
    delete userImporters[userId];
  }
}

export async function scheduleImporter<T extends ImporterStateType>(
  name: T,
  userId: string,
  requiredInitData: ImporterStateFromType<T>["metadata"],
  scheduledFor: Date,
) {
  const user = await getUserFromField("_id", new Types.ObjectId(userId), true);
  const importerClass = importers[name];
  if (!user || !importerClass || !user.accessToken || !user.refreshToken) {
    return null;
  }

  const instance = importerClass(user) as unknown as HistoryImporter<T>;
  const initialized = await instance.init(null, requiredInitData);
  if (!initialized) {
    await instance.cleanup(requiredInitData).catch(() => undefined);
    return null;
  }

  return createImporterState(userId, {
    type: name,
    current: 0,
    total: initialized.total,
    metadata: requiredInitData,
    status: "scheduled",
    scheduledFor,
  } as ImporterStateFromType<T>);
}

export async function cancelScheduledImport(existingStateId: string) {
  const importState = await cancelScheduledImporterState(existingStateId);
  if (!importState) {
    return false;
  }
  const importerClass = importers[importState.type];
  const user = await getUserFromField("_id", importState.user, false);
  if (!importerClass || !user) {
    return false;
  }
  await importerClass(user).cleanup(importState.metadata);
  return true;
}
