import { api } from "../../../apis/api";
import { myAsyncThunk } from "../../tools";

export const checkReady = myAsyncThunk<boolean, void>(
  "@server/check-ready",
  async () => {
    const { data } = await api.ready();
    return data.ready;
  },
);
