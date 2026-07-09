import { createReducer } from "@reduxjs/toolkit";

import { checkReady } from "./thunk";

interface ServerReducer {
  // Whether the first readiness check has resolved yet.
  checked: boolean;
  // Whether the server has finished booting.
  ready: boolean;
}

const initialState: ServerReducer = { checked: false, ready: false };

export default createReducer(initialState, (builder) => {
  builder.addCase(checkReady.fulfilled, (state, { payload }) => {
    state.checked = true;
    state.ready = payload;
  });

  builder.addCase(checkReady.rejected, (state) => {
    // A failed request (server unreachable) is treated as "not ready yet".
    state.checked = true;
    state.ready = false;
  });
});
