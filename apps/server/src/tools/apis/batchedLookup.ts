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

/**
 * Fetches fixed-size pages through independent workers while preserving the
 * original page order in the returned array. A Spotify app owns each worker,
 * so every app remains serial and independently paced while different apps
 * can make progress concurrently.
 */
export async function batchedLookupParallel<T>(
  ids: string[],
  size: number,
  workerCount: number,
  fetchPage: (pageIds: string[], workerIndex: number) => Promise<T[]>,
): Promise<T[]> {
  if (ids.length === 0) {
    return [];
  }
  const pages: string[][] = [];
  for (let start = 0; start < ids.length; start += size) {
    pages.push(ids.slice(start, start + size));
  }

  const results: T[][] = new Array(pages.length);
  let cursor = 0;
  const runWorker = async (workerIndex: number) => {
    while (cursor < pages.length) {
      const pageIndex = cursor;
      cursor += 1;
      results[pageIndex] = await fetchPage(pages[pageIndex]!, workerIndex);
    }
  };
  const activeWorkers = Math.max(1, Math.min(workerCount, pages.length));
  await Promise.all(
    Array.from({ length: activeWorkers }, (_, workerIndex) =>
      runWorker(workerIndex),
    ),
  );
  return results.flat();
}
