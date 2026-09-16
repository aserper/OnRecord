/**
 * Fetches pages of ids in fixed-size batches, concatenating results in
 * request order. Callers are responsible for deduplicating ids beforehand
 * and for compacting null entries returned by the API.
 */
export async function batchedLookup<T>(
  ids: string[],
  size: number,
  fetchPage: (pageIds: string[]) => Promise<T[]>,
): Promise<T[]> {
  if (ids.length === 0) {
    return [];
  }
  const results: T[] = [];
  for (let start = 0; start < ids.length; start += size) {
    const page = ids.slice(start, start + size);
    results.push(...(await fetchPage(page)));
  }
  return results;
}

/** Maximum ids Spotify accepts per lookup request, per entity type. */
export const SPOTIFY_BATCH_SIZES = {
  tracks: 50,
  albums: 20,
  artists: 50,
} as const;
