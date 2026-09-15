import { TimelapseOutlined } from "@mui/icons-material";
import { CircularProgress, Grid } from "@mui/material";

import Header from "../../components/Header";
import IdealImage from "../../components/IdealImage";
import ImageTwoLines from "../../components/ImageTwoLines";
import InlineArtist from "../../components/InlineArtist";
import InlineTrack from "../../components/InlineTrack";
import Text from "../../components/Text";
import TitleCard from "../../components/TitleCard";
import { AlbumStatsResponse } from "../../services/apis/api";
import { msToDuration } from "../../services/stats";
import FirstAndLast from "../ArtistStats/FirstAndLast";
import AlbumRank from "./AlbumRank";

import s from "./index.module.css";

interface AlbumStatsProps {
  stats: AlbumStatsResponse;
}

export default function AlbumStats({ stats }: AlbumStatsProps) {
  if (!stats) {
    return <CircularProgress />;
  }

  return (
    <div>
      <Header
        left={
          <IdealImage
            className={s.headerimage}
            images={stats.album.images}
            size={60}
            alt="Album"
          />
        }
        title={stats.album.name}
        subtitle={stats.artists.map((artist, k) => (
          <>
            <InlineArtist size="normal" artist={artist} key={artist.id} />
            {k < stats.artists.length - 1 && ", "}
          </>
        ))}
        hideInterval
      />
      <div className={s.content}>
        <div className={s.header}>
          <AlbumRank albumId={stats.album.id} />
        </div>
        <Grid
          container
          sx={{ justifyContent: "flex-start", alignItems: "flex-start" }}
          spacing={2}
          style={{ marginTop: 0 }}>
          <Grid
            container
            size={{ xs: 12, lg: 6 }}
            sx={{ justifyContent: "flex-start", alignItems: "flex-start" }}
            spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TitleCard title="Album details" contentClassName={s.context}>
                <div className={s.artists}>
                  {stats.artists.map((artist) => (
                    <ImageTwoLines
                      key={artist.id}
                      image={<IdealImage images={artist.images} size={48} />}
                      first={<InlineArtist size="normal" artist={artist} />}
                      second="Artist"
                    />
                  ))}
                </div>
                <ImageTwoLines
                  image={<TimelapseOutlined color="primary" fontSize="large" />}
                  first={`${msToDuration(
                    stats.tracks.reduce(
                      (acc, { track }) => track.duration_ms + acc,
                      0,
                    ),
                  )} (${stats.tracks.length} tracks)`}
                  second="Total duration"
                />
              </TitleCard>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FirstAndLast
                firstImages={stats.album.images}
                lastImages={stats.album.images}
                firstDate={new Date(stats.firstLast.first.played_at)}
                lastDate={new Date(stats.firstLast.last.played_at)}
                firstElement={
                  <InlineTrack
                    size="normal"
                    track={stats.firstLast.first.track}
                  />
                }
                lastElement={
                  <InlineTrack
                    size="normal"
                    track={stats.firstLast.last.track}
                  />
                }
              />
            </Grid>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <TitleCard title="Top tracks">
              {stats.tracks.map(({ track, count }, k) => (
                <div key={track.id} className={s.ml}>
                  <Text element="strong" size="big" className={s.mlrank}>
                    #{k + 1}
                  </Text>
                  <ImageTwoLines
                    image={
                      <IdealImage
                        className={s.cardimg}
                        images={stats.album.images}
                        size={48}
                        alt="album cover"
                      />
                    }
                    first={<InlineTrack size="normal" track={track} />}
                    second={`${count} plays`}
                  />
                </div>
              ))}
            </TitleCard>
          </Grid>
        </Grid>
      </div>
    </div>
  );
}
