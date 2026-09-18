import { SystemUpdateAlt as UpdateIcon } from "@mui/icons-material";
import { Tooltip } from "@mui/material";

import {
  buildDisplay,
  BuildInfo,
  VersionResponse,
} from "../../../services/buildInfo";

import s from "./index.module.css";

interface BuildVersionProps {
  backend?: VersionResponse | null;
  frontend?: BuildInfo | null;
}

export default function BuildVersion({
  backend,
  frontend = typeof __BUILD_INFO__ === "undefined" ? null : __BUILD_INFO__,
}: BuildVersionProps) {
  const build = buildDisplay(frontend, backend);
  return (
    <div className={s.versionwrapper}>
      <div className={s.versionrow}>
        <Tooltip title={build.details} describeChild>
          <span className={s.version} tabIndex={0} aria-label={build.details}>
            {build.releaseUrl ? (
              <a
                href={build.releaseUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`OnRecord release ${build.versionLabel} (opens in a new tab)`}>
                {build.versionLabel}
              </a>
            ) : (
              build.versionLabel
            )}
            {" · "}
            {build.commitUrl ? (
              <a
                href={build.commitUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`OnRecord commit ${frontend?.commit} (opens in a new tab)`}>
                {build.commitLabel}
              </a>
            ) : (
              build.commitLabel
            )}
            {build.dirty && " · dirty"}
          </span>
        </Tooltip>
        {build.updateUrl && (
          <Tooltip title="An OnRecord update is available">
            <a
              className={s.update}
              href={build.updateUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="View OnRecord update (opens in a new tab)">
              <UpdateIcon fontSize="small" />
            </a>
          </Tooltip>
        )}
      </div>
      <div aria-live="polite">
        {build.mismatch && (
          <Tooltip
            title={`Your browser and server are running different builds. Refresh to load the current interface. Server: ${backend?.version}, ${backend?.commit}, ${backend?.channel}. If this persists, the server deployment may be mixed.`}
            describeChild>
            <button
              type="button"
              className={s.refresh}
              onClick={() => window.location.reload()}>
              Build changed — refresh
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
