import { Button } from "@mui/material";

import TitleCard from "../../../components/TitleCard";
import { getSpotifyLogUrl } from "../../../services/tools";
import SettingLine from "../SettingLine";

export default function RelogToSpotify() {
  return (
    <TitleCard title="Spotify connection">
      <SettingLine
        left="Reconnect your Spotify account"
        right={
          <Button>
            <a href={getSpotifyLogUrl()}>Reconnect</a>
          </Button>
        }
      />
    </TitleCard>
  );
}
