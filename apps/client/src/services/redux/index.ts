import { configureStore } from "@reduxjs/toolkit";

import adminReducer from "./modules/admin/reducer";
import importReducer from "./modules/import/reducer";
import messageReducer from "./modules/message/reducer";
import playlistReducer from "./modules/playlist/reducer";
import serverReducer from "./modules/server/reducer";
import settingsReducer from "./modules/settings/reducer";
import userReducer from "./modules/user/reducer";

const store = configureStore({
  reducer: {
    user: userReducer,
    settings: settingsReducer,
    message: messageReducer,
    admin: adminReducer,
    import: importReducer,
    playlist: playlistReducer,
    server: serverReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;

export default store;
