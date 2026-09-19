import { readFile, unlink } from "fs/promises";

import { z } from "zod";

import {
  addTrackIdsToUser,
  getCloseTrackId,
  storeFirstListenedAtIfLess,
} from "../../database";
import { setImporterStateCurrent } from "../../database/queries/importer";
import { Infos } from "../../database/schemas/info";
import { RecentlyPlayedTrack } from "../../database/schemas/track";
import { User } from "../../database/schemas/user";
import {
  getTracksAlbumsArtists,
  storeTrackAlbumArtist,
} from "../../spotify/dbTools";
import { classifySuppliedPlays } from "../../spotify/exclusions";
import { SpotifyAPI } from "../apis/spotifyApi";
import { isPodcastHistoryRecord } from "../classification/podcasts";
import { logger } from "../logger";
import { minOfArray, retryPromise } from "../misc";
import { Unpack } from "../types";
import { getFromCacheString, setToCacheString } from "./cache";
import {
  markMissingFromSpotify,
  partitionCachedIds,
  storeCatalogForCache,
} from "./catalogCache";
import { FullPrivacyImporterState, HistoryImporter } from "./types";

/**
 * Extended streaming history rows.
 *
 * Podcast, audiobook and video rows carry null (or missing) track metadata:
 * `spotify_track_uri`, `master_metadata_track_name` and
 * `master_metadata_album_artist_name` may each be null, while
 * `spotify_episode_uri` / `episode_name` / `audiobook_title` are populated.
 * Every field is optional and nullable so those rows are parsed and then
 * skipped instead of failing validation for the whole import.
 */
export const fullPrivacyFileSchema = z.array(
  z.object({
    ts: z.string().optional(),
    ms_played: z.number().optional(),
    spotify_track_uri: z.string().nullish(),
    master_metadata_track_name: z.string().nullish(),
    master_metadata_album_artist_name: z.string().nullish(),
    primary_artist_name: z.string().nullish(),
    episode_name: z.string().nullish(),
    episode_show_name: z.string().nullish(),
    spotify_episode_uri: z.string().nullish(),
    audiobook_title: z.string().nullish(),
    audiobook_uri: z.string().nullish(),
    audiobook_chapter_title: z.string().nullish(),
  }),
);

export type FullPrivacyItem = Unpack<z.infer<typeof fullPrivacyFileSchema>>;

export class FullPrivacyImporter implements HistoryImporter<"full-privacy"> {
  private id: string;

  /** Tracks answered from the stored catalog instead of Spotify. */
  private cachedHits = 0;

  private userId: string;

  private elements: FullPrivacyItem[] | null;

  private currentItem: number;

  private spotifyApi: SpotifyAPI;

  constructor(user: User) {
    this.id = "";
    this.userId = user._id.toString();
    this.elements = null;
    this.currentItem = 0;
    this.spotifyApi = new SpotifyAPI(this.userId);
  }

  static idFromSpotifyURI = (uri: string) => uri.split(":")[2];

  search = async (spotifyIds: string[]) => {
    if (spotifyIds.length === 0) {
      return [];
    }
    const res = await retryPromise(
      () => this.spotifyApi.getTracksBatched(spotifyIds),
      10,
      30,
    );
    return res;
  };

  storeItems = async (userId: string, items: RecentlyPlayedTrack[]) => {
    const { tracks, albums, artists } = await getTracksAlbumsArtists(
      userId,
      items.map((it) => it.track),
    );
    await storeTrackAlbumArtist({ tracks, albums, artists });
    const classifications = await classifySuppliedPlays(items);
    const finalInfos: Omit<Infos, "owner">[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]!;
      const date = new Date(item.played_at);
      const duplicate = await getCloseTrackId(
        this.userId.toString(),
        item.track.id,
        date,
        60,
      );
      const currentImportDuplicate = finalInfos.find(
        (e) => Math.abs(e.played_at.getTime() - date.getTime()) <= 60 * 1000,
      );
      if (duplicate.length > 0 || currentImportDuplicate) {
        logger.info(
          `${item.track.name} - ${item.track.artists[0]?.name} was duplicate`,
        );
        continue;
      }
      const [primaryArtist] = item.track.artists;
      if (!primaryArtist) {
        continue;
      }
      const reasons = classifications[i] ?? [];
      finalInfos.push({
        played_at: date,
        id: item.track.id,
        primaryArtistId: primaryArtist.id,
        albumId: item.track.album.id,
        artistIds: item.track.artists.map((e) => e.id),
        durationMs: item.track.duration_ms,
        ...(reasons.length > 0 ? { blacklistedBy: reasons } : {}),
      });
    }
    await setImporterStateCurrent(this.id, this.currentItem + 1);
    await addTrackIdsToUser(this.userId.toString(), finalInfos);
    const min = minOfArray(finalInfos, (info) => info.played_at.getTime());
    if (min) {
      const minInfo = finalInfos[min.minIndex];
      if (minInfo) {
        await storeFirstListenedAtIfLess(this.userId, minInfo.played_at);
      }
    }
  };

  initWithJSONContent = async (content: any[]) => {
    const value = fullPrivacyFileSchema.safeParse(content);
    if (value.success) {
      this.elements = value.data;
      return content;
    }
    logger.error(
      "If you submitted the right files and this error comes up, please open an issue with the following logs at https://github.com/aserper/OnRecord",
      JSON.stringify(value.error.issues, null, " "),
    );
    return null;
  };

  initWithFiles = async (filePaths: string[]) => {
    const files = await Promise.all(filePaths.map((f) => readFile(f)));
    const filesContent = files.map((f) => JSON.parse(f.toString()));

    const totalContent = filesContent.reduce<FullPrivacyItem[]>((acc, curr) => {
      acc.push(...curr);
      return acc;
    }, []);

    if (!(await this.initWithJSONContent(totalContent))) {
      return false;
    }

    return true;
  };

  init = async (
    existingState: FullPrivacyImporterState | null,
    filePaths: string[],
  ) => {
    try {
      this.currentItem = existingState?.current ?? 0;
      const success = await this.initWithFiles(filePaths);
      if (success) {
        return { total: this.elements!.length };
      }
    } catch (e) {
      logger.error(e);
    }
    return null;
  };

  /**
   * Resolves ids to tracks, answering from the persistent catalog first.
   *
   * OnRecord already stores every track, album and artist it has seen, and
   * that metadata does not change, so a re-import must not re-download it.
   * Only ids the database cannot answer are requested from Spotify, and the
   * results are written back so the next run is cheaper still.
   */
  checkIdsToSearch = async (
    idsToSearch: Record<string, string[]>,
    items: RecentlyPlayedTrack[],
    force = false,
  ) => {
    const ids = Object.keys(idsToSearch);
    if (ids.length < 45 && !force) {
      return idsToSearch;
    }

    const { cached, uncached } = await partitionCachedIds(ids);
    this.cachedHits += cached.size;

    for (const id of ids) {
      const track = cached.get(id);
      if (!track) {
        continue;
      }
      const playedAt = idsToSearch[id];
      if (!playedAt) {
        continue;
      }
      setToCacheString(this.userId.toString(), id, { exists: true, track });
      playedAt.forEach((pa) => {
        items.push({ track, played_at: pa });
      });
    }

    if (uncached.length > 0) {
      const searchedItems = await this.search(uncached);
      const fetched = searchedItems.filter(
        (item): item is NonNullable<typeof item> => item !== undefined,
      );
      await storeCatalogForCache(fetched);
      for (const [index, searchedItem] of searchedItems.entries()) {
        const id = uncached[index];
        if (!id) {
          continue;
        }
        if (searchedItem === undefined) {
          setToCacheString(this.userId.toString(), id, { exists: false });
          markMissingFromSpotify(id);
          continue;
        }
        const playedAt = idsToSearch[searchedItem.id];
        if (!playedAt) {
          logger.error(
            "Cannot add item",
            searchedItem.id,
            "no played_at found",
          );
          continue;
        }
        setToCacheString(this.userId.toString(), searchedItem.id, {
          exists: true,
          track: searchedItem,
        });
        playedAt.forEach((pa) => {
          items.push({ track: searchedItem, played_at: pa });
        });
        logger.info(
          `Adding ${searchedItem.name} - ${searchedItem.artists[0]?.name} from data`,
        );
      }
    }

    idsToSearch = {};
    return idsToSearch;
  };

  run = async (id: string) => {
    this.id = id;
    let items: RecentlyPlayedTrack[] = [];
    // Id of song to played_at
    let idsToSearch: Record<string, string[]> = {};
    if (!this.elements) {
      return false;
    }
    let skippedPodcasts = 0;
    for (let i = this.currentItem; i < this.elements.length; i += 1) {
      this.currentItem = i;
      logger.info(`Importing... (${i}/${this.elements.length})`);
      const content = this.elements[i]!;
      if (isPodcastHistoryRecord(content)) {
        skippedPodcasts += 1;
        continue;
      }
      if (
        !content.spotify_track_uri ||
        !content.master_metadata_track_name ||
        !content.master_metadata_album_artist_name
      ) {
        continue;
      }
      const msPlayed = content.ms_played ?? 0;
      if (msPlayed < 30 * 1000) {
        // If track was played for less than 30 seconds
        logger.info(
          `Track ${content.master_metadata_track_name} - ${
            content.master_metadata_album_artist_name
          } was passed, only listened for ${Math.floor(
            msPlayed / 1000,
          )} seconds`,
        );
        continue;
      }
      const playedAt = content.ts ?? "";
      const spotifyId = FullPrivacyImporter.idFromSpotifyURI(
        content.spotify_track_uri,
      );
      if (!spotifyId) {
        logger.warn(
          `Could not get spotify id from uri: ${content.spotify_track_uri}`,
        );
        continue;
      }
      const item = getFromCacheString(this.userId.toString(), spotifyId);
      if (!item) {
        const arrayOfPlayedAt = idsToSearch[spotifyId] ?? [];
        arrayOfPlayedAt.push(playedAt);
        idsToSearch[spotifyId] = arrayOfPlayedAt;
        idsToSearch = await this.checkIdsToSearch(idsToSearch, items);
      } else if (item.exists) {
        items.push({ track: item.track, played_at: playedAt });
      }
      if (items.length >= 20) {
        await this.storeItems(this.userId, items);
        items = [];
      }
    }
    await this.checkIdsToSearch(idsToSearch, items, true);
    if (items.length > 0) {
      await this.storeItems(this.userId, items);
      items = [];
    }
    if (skippedPodcasts > 0) {
      logger.info(
        `Skipped ${skippedPodcasts} podcast/audiobook entries from the export`,
      );
    }
    logger.info(
      `Import finished: ${this.cachedHits} catalog entries reused from the database (no Spotify request)`,
    );
    return true;
  };

  cleanup = async (filePaths: string[]) => {
    await Promise.all(filePaths.map((f) => unlink(f)));
  };
}
