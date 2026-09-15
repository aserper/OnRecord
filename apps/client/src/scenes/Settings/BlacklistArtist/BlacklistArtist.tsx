import UnblacklistIcon from "@mui/icons-material/CloseRounded";
import { CircularProgress, IconButton } from "@mui/material";
import { useState } from "react";
import { useSelector } from "react-redux";

import BlacklistArtistDialog from "../../../components/BlacklistArtistDialog";
import IdealImage from "../../../components/IdealImage";
import InlineArtist from "../../../components/InlineArtist";
import ResourceSearch from "../../../components/SiderSearch";
import Text from "../../../components/Text";
import TitleCard from "../../../components/TitleCard";
import { useLoadArtists } from "../../../services/hooks/artist";
import { selectBlacklistedArtists } from "../../../services/redux/modules/user/selector";
import { compact } from "../../../services/tools";
import { Artist } from "../../../services/types";

import s from "./index.module.css";

export default function BlacklistArtist() {
  const [askedBlacklist, setAskedBlacklist] = useState<Artist | undefined>();
  const [askedUnblacklist, setAskedUnblacklist] = useState<
    Artist | undefined
  >();
  const blacklisted = useSelector(selectBlacklistedArtists);
  const { artists, loaded } = useLoadArtists(blacklisted);

  const askBlacklist = (artist: Artist) => {
    setAskedBlacklist(artist);
  };

  const askUnblacklist = (artist: Artist) => {
    setAskedUnblacklist(artist);
  };

  if (!loaded) {
    return <CircularProgress />;
  }

  const askedArtist = askedBlacklist ?? askedUnblacklist;

  return (
    <TitleCard title="Excluded artists">
      <Text element="span" className={s.marginbottom} size="normal">
        Exclude artists from your statistics and listening history. Existing
        plays are removed, and future plays are not recorded.
      </Text>
      <div className={s.root}>
        <ResourceSearch
          showShortcut={false}
          onArtistClick={askBlacklist}
          inputClassname={s.search}
        />
        {blacklisted.length === 0 && (
          <Text className={s.none} size="normal">
            No excluded artists
          </Text>
        )}
        {compact(blacklisted.map((b) => artists[b])).map((artist) => (
          <div key={artist.id} className={s.artist}>
            <IdealImage
              className={s.artistcover}
              images={artist.images}
              size={48}
              width={48}
              height={48}
              alt="artist"
            />
            <InlineArtist artist={artist} size="normal" />
            <IconButton
              className={s.unblacklist}
              aria-label="Include artist"
              onClick={() => askUnblacklist(artist)}>
              <UnblacklistIcon />
            </IconButton>
          </div>
        ))}
        <BlacklistArtistDialog
          artistId={askedArtist?.id}
          artistName={askedArtist?.name}
          blacklisted={Boolean(askedUnblacklist)}
          onClose={() => {
            setAskedBlacklist(undefined);
            setAskedUnblacklist(undefined);
          }}
        />
      </div>
    </TitleCard>
  );
}
