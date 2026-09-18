import clsx from "clsx";
import { useContext } from "react";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";

import { useShareLink } from "../../../services/hooks/hooks";
import { useNavigate } from "../../../services/hooks/useNavigate";
import { alertMessage } from "../../../services/redux/modules/message/reducer";
import { selectBuildInfo } from "../../../services/redux/modules/settings/selector";
import { selectUser } from "../../../services/redux/modules/user/selector";
import { useAppDispatch } from "../../../services/redux/tools";
import { Album, Artist, Track } from "../../../services/types";
import SiderSearch from "../../SiderSearch";
import { LayoutContext } from "../LayoutContext";
import BuildVersion from "./BuildVersion";
import SiderCategory from "./SiderCategory/SiderCategory";
import SiderTitle from "./SiderTitle";
import { useLinks } from "./useLinks";

import s from "./index.module.css";

interface SiderProps {
  className?: string;
  isDrawer?: boolean;
}

export default function Sider({ className, isDrawer }: SiderProps) {
  const dispatch = useAppDispatch();
  const layoutContext = useContext(LayoutContext);
  const user = useSelector(selectUser);
  const navigate = useNavigate();
  const location = useLocation();

  function goToArtist(artist: Artist) {
    navigate(`/artist/${artist.id}`);
    layoutContext.closeDrawer();
  }

  function goToTrack(track: Track) {
    navigate(`/song/${track.id}`);
    layoutContext.closeDrawer();
  }

  function goToAlbum(album: Album) {
    navigate(`/album/${album.id}`);
    layoutContext.closeDrawer();
  }

  function copyCurrentPage() {
    if (!user?.publicToken) {
      dispatch(
        alertMessage({
          level: "error",
          message: "Create a public link in Settings → Account before sharing.",
        }),
      );
      return;
    }
    dispatch(
      alertMessage({ level: "info", message: "Public page link copied." }),
    );
  }

  const toCopy = useShareLink();

  const buildInfo = useSelector(selectBuildInfo);

  const links = useLinks();

  if (!user) {
    return null;
  }

  return (
    <div className={clsx(s.root, className, { [s.drawer]: isDrawer })}>
      <div className={s.title}>
        <SiderTitle />
      </div>
      <SiderSearch
        showShortcut
        onTrackClick={goToTrack}
        onAlbumClick={goToAlbum}
        onArtistClick={goToArtist}
      />
      <nav>
        {links.map((category) => (
          <SiderCategory
            key={category.label}
            user={user}
            pathname={location.pathname}
            onCopy={copyCurrentPage}
            toCopy={toCopy ?? ""}
            category={category}
          />
        ))}
      </nav>
      <BuildVersion backend={buildInfo} />
    </div>
  );
}
