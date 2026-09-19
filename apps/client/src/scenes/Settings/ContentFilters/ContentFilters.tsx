import { Chip, CircularProgress, Switch } from "@mui/material";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

import Text from "../../../components/Text";
import TitleCard from "../../../components/TitleCard";
import { api } from "../../../services/apis/api";
import { useAPI } from "../../../services/hooks/hooks";
import { changeContentFilters } from "../../../services/redux/modules/settings/thunk";
import { selectUser } from "../../../services/redux/modules/user/selector";
import { useAppDispatch } from "../../../services/redux/tools";
import SettingLine from "../SettingLine";

import s from "./index.module.css";

const REASON_LABEL: Record<string, string> = {
  genre: "Spotify genre",
  artist: "Known children's artist",
  album: "Children's album",
};

export default function ContentFilters() {
  const dispatch = useAppDispatch();
  const user = useSelector(selectUser);
  const result = useAPI(api.getChildrensMusicClassification);
  const [showAll, setShowAll] = useState(false);

  const [excludeChildrensMusic, setExcludeChildrensMusic] = useState(
    user?.settings.excludeChildrensMusic ?? false,
  );
  const [excludePodcasts, setExcludePodcasts] = useState(
    user?.settings.excludePodcasts ?? false,
  );

  // Keep local switch state in sync when the user is refreshed.
  useEffect(() => {
    setExcludeChildrensMusic(user?.settings.excludeChildrensMusic ?? false);
    setExcludePodcasts(user?.settings.excludePodcasts ?? false);
  }, [user?.settings.excludeChildrensMusic, user?.settings.excludePodcasts]);

  const loaded = result !== null;
  const items = result?.items ?? [];
  const visible = showAll ? items : items.slice(0, 8);

  const change = (next: {
    excludeChildrensMusic?: boolean;
    excludePodcasts?: boolean;
  }) => {
    dispatch(changeContentFilters(next)).catch(console.error);
  };

  return (
    <TitleCard title="Content filters">
      <Text element="span" className={s.marginbottom} size="normal">
        Hide content you do not want in your statistics and history. Nothing is
        deleted: turning a filter off restores every play.
      </Text>

      <SettingLine
        left="Children's music"
        right={
          <Switch
            checked={excludeChildrensMusic}
            slotProps={{ input: { "aria-label": "Exclude children's music" } }}
            onChange={(_, checked) => {
              setExcludeChildrensMusic(checked);
              change({ excludeChildrensMusic: checked });
            }}
          />
        }
      />
      <SettingLine
        left="Podcasts"
        right={
          <Switch
            checked={excludePodcasts}
            slotProps={{ input: { "aria-label": "Exclude podcasts" } }}
            onChange={(_, checked) => {
              setExcludePodcasts(checked);
              change({ excludePodcasts: checked });
            }}
          />
        }
      />

      <Text element="span" className={s.marginbottom} size="small">
        Children's music is detected from Spotify's own genre tags and from a
        curated list of known children's artists and albums, because Spotify
        does not tag children's content reliably. Podcasts are detected
        structurally from episode metadata.
      </Text>

      {!loaded && <CircularProgress />}

      {loaded && items.length > 0 && (
        <>
          <Text element="strong" size="normal">
            Detected children&apos;s artists ({items.length})
          </Text>
          <div className={s.list}>
            {visible.map((item) => (
              <div key={item.id} className={s.row}>
                <Text element="span" size="normal">
                  {item.name || item.id}
                </Text>
                <span className={s.meta}>
                  <Chip
                    size="small"
                    label={REASON_LABEL[item.reason] ?? item.reason}
                  />
                  <Text element="span" size="small">
                    {item.plays} {item.plays === 1 ? "play" : "plays"}
                  </Text>
                </span>
              </div>
            ))}
          </div>
          {items.length > 8 && (
            <button
              type="button"
              className={s.more}
              onClick={() => setShowAll((prev) => !prev)}>
              {showAll ? "Show fewer" : `Show all ${items.length}`}
            </button>
          )}
        </>
      )}

      {loaded && items.length === 0 && (
        <Text element="span" size="normal">
          No children&apos;s music detected in your listening.
        </Text>
      )}
    </TitleCard>
  );
}
