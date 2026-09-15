import {
  claimScheduledImport,
  getDueScheduledImports,
} from "../../database/queries/importer";
import { logger } from "../logger";
import { canUserImport, runImporter } from "./importer";

const SCHEDULER_INTERVAL_MS = 30_000;
let scheduler: NodeJS.Timeout | undefined;
let schedulerRunning = false;

export async function runDueScheduledImports(now = new Date()) {
  if (schedulerRunning) {
    return;
  }
  schedulerRunning = true;
  try {
    const due = await getDueScheduledImports(now);
    const claimedUsers = new Set<string>();
    for (const scheduled of due) {
      const userId = scheduled.user.toString();
      if (claimedUsers.has(userId) || !canUserImport(userId)) {
        continue;
      }
      const claimed = await claimScheduledImport(scheduled._id.toString());
      if (!claimed) {
        continue;
      }
      claimedUsers.add(userId);
      runImporter(
        claimed._id.toString(),
        claimed.type,
        userId,
        claimed.metadata,
        (success) => {
          if (!success) {
            logger.error(
              `Scheduled import ${claimed._id.toString()} failed to start`,
            );
          }
        },
      ).catch(logger.error);
    }
  } finally {
    schedulerRunning = false;
  }
}

export function startImportScheduler() {
  if (scheduler) {
    return;
  }
  runDueScheduledImports().catch(logger.error);
  scheduler = setInterval(
    () => runDueScheduledImports().catch(logger.error),
    SCHEDULER_INTERVAL_MS,
  );
  scheduler.unref();
}
