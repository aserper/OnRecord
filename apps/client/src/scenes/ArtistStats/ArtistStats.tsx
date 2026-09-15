import { CircularProgress, Grid } from "@mui/material";
import { useSelector } from "react-redux";

import Header from "../../components/Header";
import IdealImage from "../../components/IdealImage";
import ImageTwoLines from "../../components/ImageTwoLines";
import InlineAlbum from "../../components/InlineAlbum";
import InlineTrack from "../../components/InlineTrack";
import Text from "../../components/Text";
import TitleCard from "../../components/TitleCard";
import { ArtistStatsResponse } from "../../services/apis/api";
import { DateFormatter } from "../../services/date";
import { selectBlacklistedArtist } from "../../services/redux/modules/user/selector";
import { buildFromDateId } from "../../services/stats";
import ArtistContextMenu from "./ArtistContextMenu";
import ArtistRank from "./ArtistRank/ArtistRank";
import DayRepartition from "./DayRepartition";
import FirstAndLast from "./FirstAndLast";
import { MostListenedTracksContextMenuButton } from "./mostListenedTracksContextMenuButton/mostListenedTracksContextMenuButton";

import s from "./index.module.css";

interface ArtistStatsProps {
  artistId: string;
  stats: ArtistStatsResponse;
}

export default function ArtistStats({ artistId, stats }: ArtistStatsProps) {
  const blacklisted = useSelector(selectBlacklistedArtist(artistId));

  if (!stats) {
    return <CircularProgress />;
  }

  const [bestPeriod, secondBestPeriod] = stats.bestPeriod;

  return (
    <div>
      <Header
        left={
          <IdealImage
            className={s.headerimage}
            images={stats.artist.images}
            size={60}
            alt="Artist"
          />
        }
        right={
          <ArtistContextMenu
            artistId={stats.artist.id}
            artistName={stats.artist.name}
            blacklisted={blacklisted}
          />
        }
        title={stats.artist.name}
        subtitle={stats.artist.genres.join(", ")}
        hideInterval
      />
      <div className={s.content}>
        <div className={s.header}>
          <ArtistRank artistId={artistId} />
        </div>
        <Grid
          container
          sx={{ justifyContent: "flex-start", alignItems: "flex-start" }}
          spacing={2}
          style={{ marginTop: 0 }}>
          <Grid
            container
            size={{ xs: 12, lg: 6 }}
            spacing={2}
            sx={{ justifyContent: "flex-start", alignItems: "flex-start" }}>
            <Grid size={{ xs: 12 }}>
              <TitleCard title="Plays">
                <Text element="strong" size="big">
                  {stats.total.count}
                </Text>
              </TitleCard>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FirstAndLast
                firstImages={stats.firstLast.first.track.album.images}
                lastImages={stats.firstLast.last.track.album.images}
                firstDate={new Date(stats.firstLast.first.played_at)}
                lastDate={new Date(stats.firstLast.last.played_at)}
                firstElement={
                  <InlineTrack
                    track={stats.firstLast.first.track}
                    size="normal"
                  />
                }
                lastElement={
                  <InlineTrack
                    track={stats.firstLast.last.track}
                    size="normal"
                  />
                }
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TitleCard title="Top listening months">
                {bestPeriod && (
                  <div className={s.bestperiod}>
                    <Text element="strong" size="normal">
                      {DateFormatter.toMonthStringYear(
                        buildFromDateId(bestPeriod._id),
                      )}
                    </Text>
                    <Text size="normal">
                      {bestPeriod.count} plays (
                      {Math.floor((bestPeriod.count / bestPeriod.total) * 100)}%
                      of all plays)
                    </Text>
                  </div>
                )}
                {secondBestPeriod && (
                  <div className={s.bestperiod}>
                    <Text element="strong" size="normal">
                      {DateFormatter.toMonthStringYear(
                        buildFromDateId(secondBestPeriod._id),
                      )}
                    </Text>
                    <Text size="normal">
                      {secondBestPeriod.count} plays (
                      {Math.floor(
                        (secondBestPeriod.count / secondBestPeriod.total) * 100,
                      )}
                      % of all plays)
                    </Text>
                  </div>
                )}
              </TitleCard>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <DayRepartition
                stats={stats.dayRepartition}
                className={s.chart}
              />
            </Grid>
          </Grid>
          <Grid container size={{ xs: 12, lg: 6 }} spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TitleCard
                title="Top tracks"
                right={
                  <MostListenedTracksContextMenuButton artistId={artistId} />
                }>
                {stats.mostListened.map((ml, k) => (
                  <div key={ml.track.id} className={s.ml}>
                    <Text element="strong" className={s.mlrank} size="big">
                      #{k + 1}
                    </Text>
                    <ImageTwoLines
                      image={
                        <IdealImage
                          className={s.cardimg}
                          images={ml.track.album.images}
                          size={48}
                          alt="album cover"
                        />
                      }
                      first={<InlineTrack track={ml.track} size="normal" />}
                      second={`${ml.count} plays`}
                    />
                  </div>
                ))}
              </TitleCard>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TitleCard title="Top albums">
                {stats.albumMostListened.map((ml, k) => (
                  <div key={ml.album.id} className={s.ml}>
                    <Text element="strong" className={s.mlrank} size="big">
                      #{k + 1}
                    </Text>
                    <ImageTwoLines
                      image={
                        <IdealImage
                          className={s.cardimg}
                          images={ml.album.images}
                          size={48}
                          alt="album cover"
                        />
                      }
                      first={<InlineAlbum album={ml.album} size="normal" />}
                      second={`${ml.count} plays`}
                    />
                  </div>
                ))}
              </TitleCard>
            </Grid>
          </Grid>
        </Grid>
      </div>
    </div>
  );
}
