import { Button, CircularProgress } from "@mui/material";
import { ReactNode, useId, useMemo, useState } from "react";

import Text from "../../../components/Text";
import {
  startImportFullPrivacy,
  startImportPrivacy,
} from "../../../services/redux/modules/import/thunk";
import { ImporterStateType } from "../../../services/redux/modules/import/types";
import { useAppDispatch } from "../../../services/redux/tools";

import s from "./index.module.css";

interface ImportUploadFormProps {
  type: ImporterStateType;
  expectedPrefix: string;
  children: ReactNode;
}

function toLocalInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultSchedule() {
  const date = new Date();
  date.setSeconds(0, 0);
  if (date.getHours() >= 2) {
    date.setDate(date.getDate() + 1);
  }
  date.setHours(2, 0, 0, 0);
  return toLocalInputValue(date);
}

export default function ImportUploadForm({
  type,
  expectedPrefix,
  children,
}: ImportUploadFormProps) {
  const dispatch = useAppDispatch();
  const inputId = useId();
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [timing, setTiming] = useState<"now" | "scheduled">("scheduled");
  const [scheduledFor, setScheduledFor] = useState(defaultSchedule);

  const selectedFiles = useMemo(
    () => (files ? Array.from(files) : []),
    [files],
  );
  const wrongFiles = selectedFiles.some(
    (file) => !file.name.startsWith(expectedPrefix),
  );
  const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;
  const invalidSchedule =
    timing === "scheduled" &&
    (!scheduledDate || scheduledDate.getTime() <= Date.now());

  const onImport = async () => {
    if (!files || wrongFiles || invalidSchedule) {
      return;
    }
    setLoading(true);
    const action =
      type === ImporterStateType.privacy
        ? startImportPrivacy
        : startImportFullPrivacy;
    await dispatch(
      action({
        files,
        scheduledFor:
          timing === "scheduled" ? scheduledDate!.toISOString() : undefined,
      }),
    );
    setLoading(false);
  };

  return (
    <div className={s.uploadform}>
      <div className={s.guidance}>{children}</div>

      <div className={s.uploadstep}>
        <Text element="h3" size="big">
          1. Choose export files
        </Text>
        <input
          accept=".json,application/json"
          id={inputId}
          multiple
          type="file"
          className={s.hiddeninput}
          onChange={(event) => setFiles(event.target.files)}
        />
        <label className={s.filepicker} htmlFor={inputId}>
          <span className={s.filepickerlabel}>Select JSON files</span>
          <span className={s.filepickerhint}>
            Up to 50 files, 20 MB each. Expected prefix: {expectedPrefix}
          </span>
        </label>
        {selectedFiles.length > 0 && (
          <div className={s.fileselection} aria-live="polite">
            <strong>
              {selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"}{" "}
              selected
            </strong>
            <ul>
              {selectedFiles.map((file) => (
                <li key={`${file.name}-${file.size}`}>{file.name}</li>
              ))}
            </ul>
          </div>
        )}
        {wrongFiles && (
          <Text className={s.alert} size="normal">
            One or more files do not start with {expectedPrefix}. Remove them
            before continuing.
          </Text>
        )}
      </div>

      <fieldset className={s.schedule}>
        <legend>2. Choose when to import</legend>
        <label className={s.timingoption}>
          <input
            type="radio"
            name={`${inputId}-timing`}
            checked={timing === "scheduled"}
            onChange={() => setTiming("scheduled")}
          />
          <span>
            <strong>Schedule for off-hours</strong>
            <small>
              Recommended for large exports so normal Spotify use gets priority.
            </small>
          </span>
        </label>
        {timing === "scheduled" && (
          <label className={s.datetime}>
            <span>Start date and time</span>
            <input
              type="datetime-local"
              value={scheduledFor}
              min={toLocalInputValue(new Date(Date.now() + 60_000))}
              onChange={(event) => setScheduledFor(event.target.value)}
            />
            <small>
              Uses this browser’s local timezone. The server stores the
              equivalent UTC time.
            </small>
          </label>
        )}
        <label className={s.timingoption}>
          <input
            type="radio"
            name={`${inputId}-timing`}
            checked={timing === "now"}
            onChange={() => setTiming("now")}
          />
          <span>
            <strong>Start now</strong>
            <small>
              Best for small exports. Import requests are paced to protect login
              traffic.
            </small>
          </span>
        </label>
      </fieldset>

      {invalidSchedule && (
        <Text className={s.alert} size="normal">
          Choose a start time in the future.
        </Text>
      )}

      <div className={s.submitrow}>
        <Button
          variant="contained"
          disabled={
            selectedFiles.length === 0 ||
            wrongFiles ||
            invalidSchedule ||
            loading
          }
          onClick={onImport}>
          {timing === "scheduled" ? "Schedule import" : "Start import"}
        </Button>
        {loading && <CircularProgress size={20} />}
        {timing === "scheduled" && scheduledDate && !invalidSchedule && (
          <Text size="normal">
            Scheduled for {scheduledDate.toLocaleString()}
          </Text>
        )}
      </div>
    </div>
  );
}
