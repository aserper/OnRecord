import { MenuItem, Select } from "@mui/material";
import { useSelector } from "react-redux";

import Text from "../../../components/Text";
import TitleCard from "../../../components/TitleCard";
import { changeTimezone } from "../../../services/redux/modules/settings/thunk";
import { selectTimezone } from "../../../services/redux/modules/user/selector";
import { useAppDispatch } from "../../../services/redux/tools";
import SettingLine from "../SettingLine";
import { timezones } from "./timezones";

import s from "./index.module.css";

export default function Timezone() {
  const dispatch = useAppDispatch();
  const currentTimezone = useSelector(selectTimezone);

  const handleChangeTimezone = (newTimezone: string | null | undefined) => {
    if (newTimezone === "follow") {
      newTimezone = null;
    }
    dispatch(changeTimezone(newTimezone)).catch(console.error);
  };

  return (
    <TitleCard title="Time zone">
      <Text element="span" className={s.marginbottom} size="normal">
        Choose the time zone used to group your listening activity.
      </Text>
      <SettingLine
        left="Time zone"
        right={
          <Select
            variant="standard"
            value={currentTimezone}
            onChange={(ev) => handleChangeTimezone(ev.target.value)}>
            <MenuItem value="follow">Server time zone</MenuItem>
            {timezones.map((timezone) => (
              <MenuItem key={timezone} value={timezone}>
                {timezone}
              </MenuItem>
            ))}
          </Select>
        }
      />
    </TitleCard>
  );
}
