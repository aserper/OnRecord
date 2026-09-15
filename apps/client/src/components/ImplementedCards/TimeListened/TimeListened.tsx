import { Skeleton } from "@mui/material";
import clsx from "clsx";
import { useSelector } from "react-redux";

import { api } from "../../../services/apis/api";
import { useAPI } from "../../../services/hooks/hooks";
import { selectRawIntervalDetail } from "../../../services/redux/modules/user/selector";
import {
  getLastPeriod,
  getPercentMore,
  msToMinutes,
} from "../../../services/stats";
import { Timesplit } from "../../../services/types";
import Text from "../../Text";
import TitleCard from "../../TitleCard";
import { ImplementedCardProps } from "../types";

import s from "../index.module.css";

interface TimeListenedProps extends ImplementedCardProps {}

export default function TimeListened({ className }: TimeListenedProps) {
  const { interval } = useSelector(selectRawIntervalDetail);
  const result = useAPI(
    api.timePer,
    interval.start,
    interval.end,
    Timesplit.all,
  );
  const lastPeriod = getLastPeriod(interval.start, interval.end);
  const resultOld = useAPI(
    api.timePer,
    lastPeriod.start,
    lastPeriod.end,
    Timesplit.all,
  );

  if (!result || !resultOld) {
    return (
      <TitleCard title="Listening time" className={className}>
        <div className={s.root}>
          <Text size="normal">
            <Skeleton width={50} />
          </Text>
          <Text size="normal">
            <Skeleton width={200} />
          </Text>
        </div>
      </TitleCard>
    );
  }

  const count = result[0]?.count ?? 0;
  const oldCount = resultOld[0]?.count ?? 0;

  const percentMore = getPercentMore(oldCount, count);

  return (
    <TitleCard title="Listening time" className={className} fade>
      <div className={s.root}>
        <Text element="span" size="huge">
          {msToMinutes(count)} min
        </Text>
        <Text size="normal">
          <Text
            size="normal"
            element="strong"
            className={clsx({
              [s.more]: percentMore >= 0,
              [s.less]: percentMore < 0,
            })}>
            {percentMore > 0 ? "+" : ""}
            {percentMore}%
          </Text>
          <Text element="span" size="normal">
            &nbsp; vs. previous period
          </Text>
        </Text>
      </div>
    </TitleCard>
  );
}
