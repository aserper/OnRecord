import { useSelector } from "react-redux";

import { api } from "../../../services/apis/api";
import { useAPI } from "../../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../../services/redux/modules/user/selector";
import {
  buildXYData,
  formatXAxisDateTooltip,
  msToMinutes,
  useFormatXAxis,
} from "../../../services/stats";
import { DateId } from "../../../services/types";
import ChartCard from "../../ChartCard";
import Line from "../../charts/Line";
import Tooltip from "../../Tooltip";
import LoadingImplementedChart from "../LoadingImplementedChart";
import { ImplementedChartProps } from "../types";

interface TimeListenedPerProps extends ImplementedChartProps {}

export default function TimeListenedPer({ className }: TimeListenedPerProps) {
  const { interval } = useSelector(selectRawIntervalDetail);
  const result = useAPI(
    api.timePer,
    interval.start,
    interval.end,
    interval.timesplit,
  );

  const data = buildXYData(
    result?.map((r) => ({ _id: r._id as DateId, value: r.count })) ?? [],
    interval.start,
    interval.end,
  );

  const formatX = useFormatXAxis(data);
  const formatY = (value: number) => `${msToMinutes(value)}m`;
  const tooltipValue = (_: any, value: any) => `${msToMinutes(value)} minutes`;

  if (!result) {
    return (
      <LoadingImplementedChart
        title="Listening time over time"
        className={className}
      />
    );
  }

  if (result.length > 0 && result[0]?._id == null) {
    return null;
  }

  return (
    <ChartCard title="Listening time over time" className={className}>
      <Line
        data={data}
        xFormat={formatX}
        yFormat={formatY}
        customTooltip={
          <Tooltip title={formatXAxisDateTooltip} value={tooltipValue} />
        }
      />
    </ChartCard>
  );
}
