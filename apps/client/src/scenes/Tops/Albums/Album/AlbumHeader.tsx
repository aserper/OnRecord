import { GridRowWrapper } from "../../../../components/Grid";
import Text from "../../../../components/Text";
import { useMobile } from "../../../../services/hooks/hooks";
import { useAlbumGrid } from "./AlbumGrid";

import s from "./index.module.css";

export default function AlbumHeader() {
  const [isMobile] = useMobile();
  const albumGrid = useAlbumGrid();

  const columns = [
    { ...albumGrid.cover, node: <div /> },
    { ...albumGrid.title, node: <Text size="normal">Album name</Text> },
    { ...albumGrid.count, node: <Text size="normal">Count</Text> },
    {
      ...albumGrid.total,
      node: !isMobile && (
        <Text size="normal" className="center">
          Total
        </Text>
      ),
    },
  ];

  return <GridRowWrapper columns={columns} className={s.header} />;
}
