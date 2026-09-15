import TitleCard from "../../../components/TitleCard";
import { SpotifyMe } from "../../../services/types";
import SettingLine from "../SettingLine";

interface SpotifyAccountInfosProps {
  spotifyAccount: SpotifyMe;
}

export default function SpotifyAccountInfos({
  spotifyAccount,
}: SpotifyAccountInfosProps) {
  return (
    <TitleCard title="Linked Spotify account">
      <SettingLine left="Spotify ID" right={spotifyAccount.id} />
      <SettingLine left="Email" right={spotifyAccount.email} />
      <SettingLine left="Plan" right={spotifyAccount.product} />
    </TitleCard>
  );
}
