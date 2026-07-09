import { CircularProgress } from "@mui/material";
import { ReactNode, useEffect } from "react";
import { useSelector } from "react-redux";

import {
  selectServerChecked,
  selectServerReady,
} from "../../services/redux/modules/server/selector";
import { checkReady } from "../../services/redux/modules/server/thunk";
import { useAppDispatch } from "../../services/redux/tools";
import Text from "../Text";

import s from "./index.module.css";

const POLL_INTERVAL_MS = 3000;

interface BootGateProps {
  children: ReactNode;
}

export default function BootGate({ children }: BootGateProps) {
  const dispatch = useAppDispatch();
  const checked = useSelector(selectServerChecked);
  const ready = useSelector(selectServerReady);

  useEffect(() => {
    if (ready) {
      return undefined;
    }
    dispatch(checkReady());
    const interval = setInterval(() => {
      dispatch(checkReady());
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [dispatch, ready]);

  // Wait for the first readiness check to resolve before rendering anything, to
  // avoid flashing the app before we know the server is booting.
  if (!checked || !ready) {
    return (
      <div className={s.root}>
        <CircularProgress />
        <Text element="h1" size="pagetitle">
          The server is booting up
        </Text>
        <Text className={s.explain} size="normal">
          Your Spotify is getting ready by sanitizing its database. This screen
          will disappear automatically once the server is ready.
        </Text>
      </div>
    );
  }

  return children;
}
