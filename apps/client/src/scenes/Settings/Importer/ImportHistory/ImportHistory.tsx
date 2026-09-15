import { CircularProgress } from "@mui/material";
import { useSelector } from "react-redux";

import Text from "../../../../components/Text";
import ThreePoints from "../../../../components/ThreePoints";
import { DateFormatter } from "../../../../services/date";
import { selectImportStates } from "../../../../services/redux/modules/import/selector";
import {
  cancelScheduledImport,
  cleanupImport,
  startImportPrivacy,
} from "../../../../services/redux/modules/import/thunk";
import { ImporterStateStatus } from "../../../../services/redux/modules/import/types";
import { useAppDispatch } from "../../../../services/redux/tools";
import { compact } from "../../../../services/tools";
import SettingLine from "../../SettingLine";

import s from "./index.module.css";

const statusToString: Record<ImporterStateStatus, string> = {
  scheduled: "Scheduled",
  starting: "Preparing",
  "failure-removed": "Failed; cleanup requested",
  failure: "Failed",
  progress: "In progress",
  success: "Completed",
  cancelled: "Cancelled",
};

export default function ImportHistory() {
  const dispatch = useAppDispatch();
  const imports = useSelector(selectImportStates);

  const cleanImport = async (id: string) => {
    dispatch(cleanupImport(id)).catch(console.error);
  };

  const onImport = async (id: string) => {
    await dispatch(startImportPrivacy({ id }));
  };

  const cancelImport = async (id: string) => {
    await dispatch(cancelScheduledImport(id));
  };

  if (!imports) {
    return <CircularProgress />;
  }

  return (
    <div className={s.importhistory}>
      <Text element="h3" size="big">
        Import history
      </Text>
      {imports.map((st) => (
        <SettingLine
          key={st._id}
          left={
            <Text size="normal">
              Uploaded {DateFormatter.listenedAt(new Date(st.createdAt))}
              <Text className={s.importertype} size="normal">
                {st.type === "privacy"
                  ? "Account data"
                  : "Extended streaming history"}
              </Text>
              {st.status === "scheduled" && st.scheduledFor && (
                <Text className={s.scheduledtime} size="normal">
                  Starts {new Date(st.scheduledFor).toLocaleString()}
                </Text>
              )}
            </Text>
          }
          right={
            <div className={s.right}>
              <Text size="normal">
                {statusToString[st.status]} ({st.current}/{st.total})
              </Text>
              <ThreePoints
                items={compact([
                  st.status === "failure"
                    ? { label: "Retry", onClick: () => onImport(st._id) }
                    : undefined,
                  st.status === "failure"
                    ? {
                        label: "Delete uploaded files",
                        onClick: () => cleanImport(st._id),
                        style: "destructive",
                      }
                    : undefined,
                  st.status === "scheduled"
                    ? {
                        label: "Cancel scheduled import",
                        onClick: () => cancelImport(st._id),
                        style: "destructive",
                      }
                    : undefined,
                ])}
              />
            </div>
          }
        />
      ))}
    </div>
  );
}
