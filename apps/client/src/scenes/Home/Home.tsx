import { useSelector } from "react-redux";

import Header from "../../components/Header";
import History from "../../components/History";
import ArtistsListened from "../../components/ImplementedCards/ArtistsListened";
import BestArtist from "../../components/ImplementedCards/BestArtist";
import BestSong from "../../components/ImplementedCards/BestSong";
import SongsListened from "../../components/ImplementedCards/SongsListened";
import TimeListened from "../../components/ImplementedCards/TimeListened";
import ListeningRepartition from "../../components/ImplementedCharts/ListeningRepartition";
import TimeListenedPer from "../../components/ImplementedCharts/TimeListenedPer";
import { selectUser } from "../../services/redux/modules/user/selector";

import s from "./index.module.css";

export default function Home() {
  const user = useSelector(selectUser);

  if (!user) {
    return null;
  }

  return (
    <div className={s.root}>
      <Header
        title={`Your listening, ${user.username}`}
        tinyTitle="Your listening"
        subtitle="Follow the music behind every pattern in the selected period"
      />
      <main className={s.dashboard}>
        <section className={s.songs} aria-label="Songs listened">
          <SongsListened />
        </section>
        <section className={s.time} aria-label="Time listened">
          <TimeListened />
        </section>
        <section className={s.artists} aria-label="Artists listened">
          <ArtistsListened />
        </section>
        <section className={s.timeline} aria-label="Listening over time">
          <TimeListenedPer className={s.chart} />
        </section>
        <section className={s.bestartist} aria-label="Most listened artist">
          <BestArtist />
        </section>
        <section className={s.repartition} aria-label="Listening distribution">
          <ListeningRepartition className={s.chart} />
        </section>
        <section className={s.bestsong} aria-label="Most listened song">
          <BestSong />
        </section>
        <section className={s.history} aria-label="Listening history">
          <History />
        </section>
      </main>
    </div>
  );
}
