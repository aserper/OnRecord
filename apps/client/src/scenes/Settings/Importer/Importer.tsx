import {
  CircularProgress,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import Text from "../../../components/Text";
import TitleCard from "../../../components/TitleCard";
import { selectImportStates } from "../../../services/redux/modules/import/selector";
import { getImports } from "../../../services/redux/modules/import/thunk";
import { ImporterStateType } from "../../../services/redux/modules/import/types";
import { useAppDispatch } from "../../../services/redux/tools";
import FullPrivacy from "./FullPrivacy";
import ImportHistory from "./ImportHistory";
import Privacy from "./Privacy";

import s from "./index.module.css";

const ImportTypeToComponent: Record<ImporterStateType, any> = {
  privacy: { label: "Account data", component: Privacy },
  "full-privacy": {
    label: "Extended streaming history",
    component: FullPrivacy,
  },
};

const REFRESH_IF_RUNNING_INTERVAL = 2000;

export default function Importer() {
  const dispatch = useAppDispatch();
  const imports = useSelector(selectImportStates);
  const [importType, setImportType] = useState<ImporterStateType>(
    ImporterStateType.privacy,
  );

  // eslint-disable-next-line react-no-manual-memo/no-hook-memo
  const fetch = useCallback(
    (force = false) => dispatch(getImports(force)).catch(console.error),
    [dispatch],
  );

  useEffect(() => {
    fetch().catch(console.error);
  }, [fetch]);

  const running = imports?.find((st) =>
    ["starting", "progress"].includes(st.status),
  );
  const scheduled = imports?.some((st) => st.status === "scheduled");
  const Component = importType
    ? ImportTypeToComponent[importType].component
    : null;

  const shouldRefresh = Boolean(running || scheduled);

  const timeout = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (!shouldRefresh) {
      return;
    }
    async function refresh() {
      await fetch(true).catch(console.error);
      timeout.current = setTimeout(
        refresh,
        running ? REFRESH_IF_RUNNING_INTERVAL : 30_000,
      );
    }

    timeout.current = setTimeout(
      async () => {
        await refresh();
      },
      running ? REFRESH_IF_RUNNING_INTERVAL : 30_000,
    );

    return () => clearTimeout(timeout.current);
  }, [fetch, running, shouldRefresh]);

  if (!imports) {
    return <CircularProgress />;
  }

  return (
    <TitleCard title="Import data">
      <Text className={s.intro} size="normal">
        Upload your Spotify export and import it now or schedule it for later.
      </Text>
      <div>
        {running && (
          <div>
            <Text className={s.progress} size="normal">
              {running.status === "starting"
                ? "Preparing scheduled import"
                : `Importing ${running.current} of ${running.total}`}
            </Text>
            <LinearProgress
              style={{ width: "100%" }}
              variant="determinate"
              value={
                running.total > 0 ? (running.current / running.total) * 100 : 0
              }
            />
          </div>
        )}
      </div>
      {!running && (
        <div>
          <FormControl className={s.selectimport}>
            <InputLabel id="import-type-select">Import type</InputLabel>
            <Select
              labelId="import-type-select"
              value={importType}
              label="Import type"
              onChange={(ev) =>
                setImportType(ev.target.value as ImporterStateType)
              }>
              {Object.values(ImporterStateType).map((typ) => (
                <MenuItem value={typ} key={typ}>
                  {ImportTypeToComponent[typ].label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {Component && <Component />}
        </div>
      )}
      {imports.length > 0 && <ImportHistory />}
    </TitleCard>
  );
}
