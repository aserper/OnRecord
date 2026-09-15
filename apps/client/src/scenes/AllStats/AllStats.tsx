import { useSelector } from "react-redux";

import Header from "../../components/Header";
import ArtistListeningRepartition from "../../components/ImplementedCharts/ArtistListeningRepartition";
import AverageAlbumReleaseDate from "../../components/ImplementedCharts/AverageAlbumReleaseDate";
import AverageNumberArtistPer from "../../components/ImplementedCharts/AverageNumberArtistPer";
import BestArtistsBar from "../../components/ImplementedCharts/BestArtistsBar";
import BestOfHour from "../../components/ImplementedCharts/BestOfHour";
import DifferentArtistListenedPer from "../../components/ImplementedCharts/DifferentArtistListenedPer";
import ListeningRepartition from "../../components/ImplementedCharts/ListeningRepartition";
import SongsListenedPer from "../../components/ImplementedCharts/SongsListenedPer";
import TimeListenedPer from "../../components/ImplementedCharts/TimeListenedPer";
import { selectUser } from "../../services/redux/modules/user/selector";

import s from "./index.module.css";

export default function AllStats() {
  const user = useSelector(selectUser);

  if (!user) {
    return null;
  }

  const charts = [
    ["artists", <BestArtistsBar key="artists" className={s.chart} />],
    [
      "repartition",
      <ListeningRepartition key="repartition" className={s.chart} />,
    ],
    [
      "artist-share",
      <ArtistListeningRepartition key="artist-share" className={s.chart} />,
    ],
    ["hours", <BestOfHour key="hours" className={s.chart} />],
    ["songs", <SongsListenedPer key="songs" className={s.chart} />],
    ["time", <TimeListenedPer key="time" className={s.chart} />],
    [
      "discovery",
      <DifferentArtistListenedPer key="discovery" className={s.chart} />,
    ],
    ["release", <AverageAlbumReleaseDate key="release" className={s.chart} />],
    [
      "collaboration",
      <AverageNumberArtistPer key="collaboration" className={s.chart} />,
    ],
  ] as const;

  return (
    <div className={s.root}>
      <Header
        title="Listening statistics"
        subtitle="Listening patterns for the selected date range."
      />
      <main className={s.content}>
        {charts.map(([key, chart], index) => (
          <section
            key={key}
            className={index === 0 ? s.lead : undefined}
            data-chart={key}>
            {chart}
          </section>
        ))}
      </main>
    </div>
  );
}
