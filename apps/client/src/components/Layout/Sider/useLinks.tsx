import {
  Home,
  HomeOutlined,
  BarChart,
  BarChartOutlined,
  MusicNote,
  MusicNoteOutlined,
  Album,
  AlbumOutlined,
  Person,
  PersonOutlined,
  Settings,
  SettingsOutlined,
  ExitToApp,
  Share,
  ShareOutlined,
  Speed,
  SpeedOutlined,
  QueueMusic,
  QueueMusicOutlined,
} from "@mui/icons-material";
import { useSelector } from "react-redux";

import { selectAffinityEnabled } from "../../../services/redux/modules/settings/selector";
import { compact } from "../../../services/tools";
import { SiderCategory } from "./types";

export function useLinks() {
  const affinityEnabled = useSelector(selectAffinityEnabled);

  const result: Array<SiderCategory> = compact([
    {
      label: "General",
      items: [
        {
          label: "Overview",
          link: "/",
          icon: <HomeOutlined />,
          iconOn: <Home />,
        },
        {
          label: "Longest sessions",
          link: "/sessions",
          icon: <SpeedOutlined />,
          iconOn: <Speed />,
        },
        {
          label: "Playlists",
          link: "/playlists",
          icon: <QueueMusicOutlined />,
          iconOn: <QueueMusic />,
        },
        {
          label: "Statistics",
          link: "/all",
          icon: <BarChartOutlined />,
          iconOn: <BarChart />,
        },
      ],
    },
    {
      label: "Rankings",
      items: [
        {
          label: "Top tracks",
          link: "/top/songs",
          icon: <MusicNoteOutlined />,
          iconOn: <MusicNote />,
        },
        {
          label: "Top artists",
          link: "/top/artists",
          icon: <PersonOutlined />,
          iconOn: <Person />,
        },
        {
          label: "Top albums",
          link: "/top/albums",
          icon: <AlbumOutlined />,
          iconOn: <Album />,
        },
      ],
    },
    affinityEnabled
      ? {
          label: "Compare",
          items: [
            {
              label: "Affinity",
              link: "/collaborative/affinity",
              icon: <MusicNoteOutlined />,
              iconOn: <MusicNote />,
              restrict: "guest",
            },
          ],
        }
      : undefined,
    {
      label: "Settings",
      items: [
        {
          label: "Share this page",
          link: "/share",
          icon: <ShareOutlined />,
          iconOn: <Share />,
        },
        {
          label: "Settings",
          link: "/settings/account",
          icon: <SettingsOutlined />,
          iconOn: <Settings />,
        },
        {
          label: "Sign out",
          link: "/logout",
          icon: <ExitToApp />,
          iconOn: <ExitToApp />,
        },
      ],
    },
  ]);
  return result;
}
