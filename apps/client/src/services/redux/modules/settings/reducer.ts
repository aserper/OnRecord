import { createReducer } from "@reduxjs/toolkit";

import { VersionResponse } from "../../../buildInfo";
import { GlobalPreferences } from "../../../types";
import {
  changeRegistrations,
  enableAffinity,
  getSettings,
  getVersion,
} from "./thunk";

interface SettingsReducer {
  settings: GlobalPreferences | null;
  version: string | null;
  update: boolean;
  buildInfo: VersionResponse | null;
}

const initialState: SettingsReducer = {
  settings: null,
  version: null,
  update: false,
  buildInfo: null,
};

export default createReducer(initialState, (builder) => {
  builder.addCase(getSettings.fulfilled, (state, { payload }) => {
    state.settings = payload;
  });

  builder.addCase(changeRegistrations.fulfilled, (state, { payload }) => {
    state.settings = payload;
  });

  builder.addCase(enableAffinity.fulfilled, (state, { payload }) => {
    state.settings = payload;
  });

  builder.addCase(getVersion.fulfilled, (state, { payload }) => {
    state.buildInfo = payload;
    state.version = payload.version;
    state.update = payload.update;
  });
});
