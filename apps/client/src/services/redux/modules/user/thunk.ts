import { api } from "../../../apis/api";
import { DateFormatter } from "../../../date";
import { myAsyncThunk } from "../../tools";
import { alertMessage } from "../message/reducer";
import { selectIsPublic } from "./selector";
import { DarkModeType, User } from "./types";

export const checkLogged = myAsyncThunk<User | null, void>(
  "@user/checklogged",
  async () => {
    try {
      const { data } = await api.me();
      if (data.status) {
        if (data.user.isGuest) {
          DateFormatter.setCurrentUsedDateFormat("default");
        } else {
          DateFormatter.setCurrentUsedDateFormat(data.user.settings.dateFormat);
        }
        return data.user;
      } else {
        return null;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  },
);

export const changeUsername = myAsyncThunk<void, string>(
  "@user/change-username",
  async (newName, tapi) => {
    try {
      await api.rename(newName);
      tapi.dispatch(
        alertMessage({
          level: "success",
          message: `Account renamed to ${newName}`,
        }),
      );
    } catch (e) {
      console.error(e);
      tapi.dispatch(
        alertMessage({
          level: "error",
          message: `Could not rename the account to ${newName}.`,
        }),
      );
      throw e;
    }
  },
);

export const generateNewPublicToken = myAsyncThunk<string, void>(
  "@user/generate-public-token",
  async (_, tapi) => {
    try {
      const { data: token } = await api.generatePublicToken();
      return token;
    } catch (e) {
      console.error(e);
      tapi.dispatch(
        alertMessage({
          level: "error",
          message: "Could not create a public link.",
        }),
      );
      throw e;
    }
  },
);

export const deletePublicToken = myAsyncThunk<string, void>(
  "@user/delete-public-token",
  async (_, tapi) => {
    try {
      const { data: token } = await api.deletePublicToken();
      return token;
    } catch (e) {
      console.error(e);
      tapi.dispatch(
        alertMessage({
          level: "error",
          message: "Could not revoke the public link.",
        }),
      );
      throw e;
    }
  },
);

export const setDarkMode = myAsyncThunk<void, DarkModeType>(
  "@user/set-dark-mode",
  async (payload, tapi) => {
    const isPublic = selectIsPublic(tapi.getState());

    try {
      if (!isPublic) {
        await api.setSetting("darkMode", payload);
      }
    } catch (e) {
      console.error(e);
      tapi.dispatch(
        alertMessage({
          level: "error",
          message: "Could not save your color preference.",
        }),
      );
      throw e;
    }
  },
);

export const playTrack = myAsyncThunk<void, string>(
  "@user/play-track",
  async (payload, tapi) => {
    try {
      await api.play(payload);
    } catch (e: any) {
      const reason = e?.response?.data?.reason;
      if (reason === "NO_ACTIVE_DEVICE") {
        tapi.dispatch(
          alertMessage({
            level: "info",
            message:
              "No active Spotify player. Open Spotify on a device and try again.",
          }),
        );
      } else if (reason === "PREMIUM_REQUIRED") {
        tapi.dispatch(
          alertMessage({
            level: "error",
            message: "Spotify Premium is required to play tracks here.",
          }),
        );
      } else {
        console.error(e);
        tapi.dispatch(
          alertMessage({
            level: "error",
            message: "Could not play this track.",
          }),
        );
      }
    }
  },
);

export const blacklistArtist = myAsyncThunk<void, string>(
  "@user/blacklist-artist",
  async (payload, tapi) => {
    try {
      await api.blacklistArtist(payload);
      await tapi.dispatch(checkLogged());
    } catch (e) {
      console.error(e);
      tapi.dispatch(
        alertMessage({
          level: "error",
          message: "Could not exclude this artist.",
        }),
      );
    }
  },
);

export const unblacklistArtist = myAsyncThunk<void, string>(
  "@user/unblacklist-artist",
  async (payload, tapi) => {
    try {
      await api.unblacklistArtist(payload);
      await tapi.dispatch(checkLogged());
    } catch (e) {
      console.error(e);
      tapi.dispatch(
        alertMessage({
          level: "error",
          message: "Could not include this artist.",
        }),
      );
    }
  },
);
