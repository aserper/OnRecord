import { RootState } from "../..";

export const selectServerChecked = (state: RootState) => state.server.checked;
export const selectServerReady = (state: RootState) => state.server.ready;
