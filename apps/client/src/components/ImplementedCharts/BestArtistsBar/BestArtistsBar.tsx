import { Tooltip as MuiTooltip } from "@mui/material";
import { PureComponent, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

import { api, DEFAULT_ITEMS_TO_LOAD } from "../../../services/apis/api";
import { useAPI, useResizeDebounce } from "../../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../../services/redux/modules/user/selector";
import { getAtLeastImage } from "../../../services/tools";
import { Artist } from "../../../services/types";
import ChartCard from "../../ChartCard";
import Bar from "../../charts/Bar";
import Tooltip from "../../Tooltip";
import { TitleFormatter } from "../../Tooltip/Tooltip";
import LoadingImplementedChart from "../LoadingImplementedChart";
import { ImplementedChartProps } from "../types";

interface BestArtistsBarProps extends ImplementedChartProps {}

const tooltipTitle: TitleFormatter<unknown[]> = ({ x }) => `Rank ${x + 1}`;

const svgImgSize = 32;
class ImageAxisTick extends PureComponent<{
  x: number;
  y: number;
  payload: { index: number };
  artists: Artist[];
}> {
  render() {
    const { x, y, payload, artists } = this.props;

    const artist = artists[payload.index];

    if (!artist) {
      return null;
    }

    return (
      <Link to={`/artist/${artist.id}`}>
        <MuiTooltip title={artist.name}>
          <g transform={`translate(${x - svgImgSize / 2},${y})`}>
            <clipPath id="yoyo">
              <circle
                r={svgImgSize / 2}
                cx={svgImgSize / 2}
                cy={svgImgSize / 2}
              />
            </clipPath>
            <image
              width={svgImgSize}
              height={svgImgSize}
              href={getAtLeastImage(artist.images, svgImgSize)}
              clipPath="url(#yoyo)"
            />
          </g>
        </MuiTooltip>
      </Link>
    );
  }
}

export default function BestArtistsBar({ className }: BestArtistsBarProps) {
  const { interval } = useSelector(selectRawIntervalDetail);
  const ref = useRef<HTMLDivElement>(null);
  const [displayNb, setDisplayNb] = useState(10);
  const result = useAPI(
    api.getBestArtists,
    interval.start,
    interval.end,
    DEFAULT_ITEMS_TO_LOAD,
    0,
  );

  const compute = (width: number) => {
    setDisplayNb(Math.floor((width || 500) / 50));
  };

  useResizeDebounce(compute, ref);

  const data =
    result?.slice(0, displayNb).map((r, k) => ({ x: k, y: r.count })) ?? [];

  const tooltipValue = (payload: any) => {
    const dataValue = result?.[payload.x];
    if (!dataValue) {
      return "";
    }
    return `${dataValue.artist.name}: ${dataValue.count} plays`;
  };

  if (!result) {
    return (
      <LoadingImplementedChart title="Top artists" className={className} />
    );
  }

  return (
    <ChartCard ref={ref} title="Top artists" className={className}>
      <Bar
        data={data}
        customTooltip={<Tooltip title={tooltipTitle} value={tooltipValue} />}
        // @ts-expect-error this is fine
        customXTick={<ImageAxisTick artists={result.map((r) => r.artist)} />}
      />
    </ChartCard>
  );
}
