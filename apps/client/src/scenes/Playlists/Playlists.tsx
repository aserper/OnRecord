import { Button, Input } from "@mui/material";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";

import Header from "../../components/Header";
import Text from "../../components/Text";
import TitleCard from "../../components/TitleCard";
import { api } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { alertMessage } from "../../services/redux/modules/message/reducer";
import { TrackedPlaylist } from "../../services/types";
import { PlaylistChangeItem } from "../../services/types";

import s from "./index.module.css";

const ERROR_TO_MESSAGE: Record<string, string> = {
  INVALID_PLAYLIST_URL: "That does not look like a Spotify playlist link.",
  PLAYLIST_ALREADY_TRACKED: "You are already tracking this playlist.",
  PLAYLIST_NOT_FOUND: "Spotify cannot find this playlist.",
  PLAYLIST_FORBIDDEN:
    "This playlist is private. Reconnect your Spotify account with playlist access.",
};

function describeChangeItem(item: PlaylistChangeItem) {
  const name = item.name || item.id;
  if (item.artists.length === 0) {
    return name;
  }
  return `${name} — ${item.artists.join(", ")}`;
}

export default function Playlists() {
  const dispatch = useDispatch();
  const [playlists, setPlaylists] = useState<TrackedPlaylist[] | null>(null);
  const [url, setUrl] = useState("");
  const [tracking, setTracking] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.getTrackedPlaylists();
      setPlaylists(data);
    } catch {
      dispatch(
        alertMessage({
          level: "error",
          message: "Could not load your tracked playlists.",
        }),
      );
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTrack = async (event: FormEvent) => {
    event.preventDefault();
    if (url.trim().length === 0 || tracking) {
      return;
    }
    setTracking(true);
    try {
      await api.trackPlaylist(url.trim());
      setUrl("");
      dispatch(alertMessage({ level: "success", message: "Playlist tracked" }));
      await load();
    } catch (error: any) {
      const code = error?.response?.data?.code as string | undefined;
      dispatch(
        alertMessage({
          level: "error",
          message:
            (code && ERROR_TO_MESSAGE[code]) ??
            "Could not track this playlist.",
        }),
      );
    } finally {
      setTracking(false);
    }
  };

  const handleRefresh = async (playlist: TrackedPlaylist) => {
    if (busyId) {
      return;
    }
    setBusyId(playlist._id);
    try {
      await api.refreshTrackedPlaylist(playlist._id);
      await load();
    } catch {
      dispatch(
        alertMessage({
          level: "error",
          message: "Could not check this playlist.",
        }),
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (playlist: TrackedPlaylist) => {
    if (busyId) {
      return;
    }
    setBusyId(playlist._id);
    try {
      await api.removeTrackedPlaylist(playlist._id);
      setPlaylists(
        (current) =>
          current?.filter((item) => item._id !== playlist._id) ?? current,
      );
      dispatch(
        alertMessage({ level: "info", message: "Stopped tracking playlist" }),
      );
    } catch {
      dispatch(
        alertMessage({
          level: "error",
          message: "Could not stop tracking this playlist.",
        }),
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={s.root}>
      <Header
        title="Playlists"
        tinyTitle="Playlists"
        subtitle="Track Spotify playlists and review what changes in them."
      />
      <main className={s.content}>
        <TitleCard title="Track a playlist">
          <form onSubmit={handleTrack} className={s.addform}>
            <Input
              placeholder="https://open.spotify.com/playlist/…"
              fullWidth
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            <Button type="submit" variant="contained" disabled={tracking}>
              Track playlist
            </Button>
          </form>
          <Text size="normal" greyed>
            OnRecord checks tracked playlists about every ten minutes and keeps
            the last 50 changes.
          </Text>
        </TitleCard>
        <div className={s.list}>
          {playlists?.length === 0 && (
            <Text size="normal" greyed>
              You are not tracking any playlist yet.
            </Text>
          )}
          {playlists?.map((playlist) => (
            <section key={playlist._id} className={s.playlist}>
              <div className={s.playlisthead}>
                {playlist.imageUrl ? (
                  <img
                    className={s.artwork}
                    src={playlist.imageUrl}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <div className={s.artwork} aria-hidden="true" />
                )}
                <div className={s.playlistmeta}>
                  <Text element="h2" size="big">
                    {playlist.name || playlist.spotifyId}
                  </Text>
                  <Text size="normal" greyed>
                    {playlist.trackCount} tracks · Checked{" "}
                    {playlist.lastCheckedAt
                      ? DateFormatter.listenedAt(
                          new Date(playlist.lastCheckedAt),
                        )
                      : "never"}
                  </Text>
                </div>
                <div className={s.actions}>
                  <Button
                    onClick={() => handleRefresh(playlist)}
                    disabled={busyId === playlist._id}>
                    Check now
                  </Button>
                  <Button
                    color="error"
                    onClick={() => handleRemove(playlist)}
                    disabled={busyId === playlist._id}>
                    Stop tracking
                  </Button>
                </div>
              </div>
              {playlist.lastError && (
                <Text size="normal" className={s.error}>
                  {playlist.lastError}
                </Text>
              )}
              {playlist.changes.length === 0 ? (
                <Text size="normal" greyed>
                  No changes since tracking started.
                </Text>
              ) : (
                <ul className={s.changes}>
                  {[...playlist.changes].reverse().map((change, index) => (
                    <li
                      key={`${change.detectedAt}-${index}`}
                      className={s.change}>
                      <Text size="normal" greyed className={s.changedate}>
                        {DateFormatter.listenedAt(new Date(change.detectedAt))}
                      </Text>
                      {change.added.length > 0 && (
                        <div className={s.changeentries}>
                          {change.added.map((item) => (
                            <Text key={`add-${item.id}`} size="normal">
                              <span className={s.added}>+</span>{" "}
                              {describeChangeItem(item)}
                            </Text>
                          ))}
                        </div>
                      )}
                      {change.removed.length > 0 && (
                        <div className={s.changeentries}>
                          {change.removed.map((item) => (
                            <Text key={`rem-${item.id}`} size="normal">
                              <span className={s.removed}>−</span>{" "}
                              <span className={s.removedname}>
                                {describeChangeItem(item)}
                              </span>
                            </Text>
                          ))}
                        </div>
                      )}
                      {change.added.length === 0 &&
                        change.removed.length === 0 && (
                          <Text size="normal" greyed>
                            Track order changed.
                          </Text>
                        )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
