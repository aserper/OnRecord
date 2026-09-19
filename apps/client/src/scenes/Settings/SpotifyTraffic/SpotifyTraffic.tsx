import { CircularProgress } from "@mui/material";
import { useSelector } from "react-redux";

import Text from "../../../components/Text";
import TitleCard from "../../../components/TitleCard";
import { api } from "../../../services/apis/api";
import { formatBytes, formatCount, formatPercent } from "../../../services/format";
import { useAPI } from "../../../services/hooks/hooks";
import { selectIsPublic } from "../../../services/redux/modules/user/selector";
import SettingLine from "../SettingLine";

import s from "./index.module.css";

export default function SpotifyTraffic() {
  const summary = useAPI(api.getTrafficSummary);
  const isPublic = useSelector(selectIsPublic);

  // Guests see the public dashboard, which has no personal traffic accounting.
  if (isPublic) {
    return null;
  }

  if (!summary) {
    return (
      <TitleCard title="Spotify traffic">
        <CircularProgress />
      </TitleCard>
    );
  }

  const hasData = summary.totalRequests > 0 || summary.totalCacheHits > 0;

  return (
    <TitleCard title="Spotify traffic">
      <Text element="span" className={s.marginbottom} size="normal">
        How much metadata OnRecord downloaded from Spotify, and how much it
        reused from its own database instead of requesting it again.
      </Text>

      {!hasData && (
        <Text element="span" size="normal">
          No Spotify traffic recorded yet. Totals accumulate as listening is
          refreshed and history is imported.
        </Text>
      )}

      {hasData && (
        <>
          <SettingLine
            left="Downloaded"
            right={`${formatBytes(summary.totalBytes)} in ${formatCount(
              summary.totalRequests,
            )} requests`}
          />
          <SettingLine
            left="Reused from database"
            right={`${formatCount(summary.totalCacheHits)} catalog entries`}
          />
          <SettingLine
            left="Cache hit rate"
            right={formatPercent(summary.cacheHitRate)}
          />
          <SettingLine
            left="Estimated download avoided"
            right={formatBytes(summary.estimatedBytesAvoided)}
          />
          <SettingLine
            left="Average response"
            right={formatBytes(summary.avgBytesPerRequest)}
          />

          <Text element="span" className={s.note} size="small">
            Avoided size is estimated from the average response, because a
            cached lookup never downloads anything to measure. Hit rate counts
            catalog lookups only.
          </Text>

          {summary.byClient.length > 1 && (
            <>
              <Text element="strong" className={s.section} size="normal">
                By request source
              </Text>
              <div className={s.list}>
                {summary.byClient.map((client) => (
                  <div key={client.client} className={s.row}>
                    <Text element="span" size="normal">
                      {client.client}
                    </Text>
                    <span className={s.meta}>
                      <Text element="span" size="small">
                        {formatCount(client.requests)} requests
                      </Text>
                      <Text element="span" size="small">
                        {formatBytes(client.bytes)}
                      </Text>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {summary.days.length > 1 && (
            <>
              <Text element="strong" className={s.section} size="normal">
                Recent days
              </Text>
              <div className={s.list}>
                {summary.days.slice(0, 7).map((day) => (
                  <div key={day.date} className={s.row}>
                    <Text element="span" size="normal">
                      {day.date}
                    </Text>
                    <span className={s.meta}>
                      <Text element="span" size="small">
                        {formatCount(day.requests)} requests
                      </Text>
                      <Text element="span" size="small">
                        {formatBytes(day.bytes)}
                      </Text>
                      <Text element="span" size="small">
                        {formatCount(day.cacheHits)} reused
                      </Text>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </TitleCard>
  );
}
