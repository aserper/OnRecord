import { GridRowWrapper } from "../../../../components/Grid";
import Text from "../../../../components/Text";
import { useMobile } from "../../../../services/hooks/hooks";
import { useTrackGrid } from "./TrackGrid";

import s from "./index.module.css";

export default function TrackHeader() {
  const [isMobile, isTablet] = useMobile();

  const trackGrid = useTrackGrid();

  const columns = [
    { ...trackGrid.cover, node: <div aria-label="cover" /> },
    {
      ...trackGrid.title,
      node: (
        <Text element="div" size="normal">
          Track
        </Text>
      ),
    },
    {
      ...trackGrid.album,
      node: !isTablet && (
        <Text element="div" size="normal">
          Album
        </Text>
      ),
    },
    {
      ...trackGrid.duration,
      node: !isMobile && (
        <Text element="div" size="normal">
          Duration
        </Text>
      ),
    },
    {
      ...trackGrid.count,
      node: (
        <div className={s.count}>
          <Text element="div" size="normal">
            Plays
          </Text>
        </div>
      ),
    },
    {
      ...trackGrid.total,
      node: !isMobile && (
        <div className={s.total}>
          <Text element="div" size="normal">
            Listening time
          </Text>
        </div>
      ),
    },
    {
      ...trackGrid.options,
      node: !isMobile && <div aria-label="option-menu" />,
    },
  ];

  return <GridRowWrapper columns={columns} className={s.header} />;
}
