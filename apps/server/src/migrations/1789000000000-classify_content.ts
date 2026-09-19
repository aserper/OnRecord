import { backfillContentClassification } from "../spotify/backfillClassification";
import { startMigration } from "../tools/migrations";

export async function up() {
  startMigration("classify existing content");
  return backfillContentClassification();
}
