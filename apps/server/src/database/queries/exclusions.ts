import { ExcludedBy } from "../schemas/info";

/**
 * Builds the exclusion predicate used by every statistics and history query.
 *
 * Play-level exclusions are recorded on each `infos` document in
 * `blacklistedBy` (manual artist blacklist plus automatic content
 * classification). Statistics automatically exclude anything excluded, and the
 * Settings toggles decide whether the automatic reasons apply, so turning a
 * filter off immediately restores previously hidden plays without any
 * migration.
 */
export interface ExclusionSettings {
  excludeChildrensMusic?: boolean | undefined;
  excludePodcasts?: boolean | undefined;
}

/** Reasons that are always excluded regardless of user preference. */
const ALWAYS_EXCLUDED: ExcludedBy[] = ["artist"];

/**
 * Returns the `blacklistedBy` predicate for the given user settings.
 * `undefined` means nothing needs to be excluded.
 */
export function excludedByPredicate(
  settings: ExclusionSettings | undefined,
): Record<string, unknown> | undefined {
  const excluded: ExcludedBy[] = [...ALWAYS_EXCLUDED];
  if (settings?.excludeChildrensMusic) {
    excluded.push("childrens-music");
  }
  if (settings?.excludePodcasts) {
    excluded.push("podcast");
  }
  return { blacklistedBy: { $nin: excluded } };
}

/**
 * Adds the exclusion predicate to an existing match object. Documents with no
 * `blacklistedBy` field are retained, because `$nin` matches missing fields.
 */
export function withExclusions<T extends Record<string, unknown>>(
  match: T,
  settings: ExclusionSettings | undefined,
): T & Record<string, unknown> {
  return { ...match, ...(excludedByPredicate(settings) ?? {}) };
}
