import { MenuItem, Select } from "@mui/material";
import { useSelector } from "react-redux";

import { selectDarkMode } from "../../../../services/redux/modules/user/selector";
import { setDarkMode } from "../../../../services/redux/modules/user/thunk";
import { DarkModeType } from "../../../../services/redux/modules/user/types";
import { useAppDispatch } from "../../../../services/redux/tools";

export default function DarkModeSwitch() {
  const dispatch = useAppDispatch();
  const dark = useSelector(selectDarkMode);

  const changeDarkMode = (mode: DarkModeType) => {
    dispatch(setDarkMode(mode));
  };

  return (
    <Select
      variant="standard"
      value={dark}
      onChange={(ev) => changeDarkMode(ev.target.value as DarkModeType)}>
      <MenuItem value="follow">System</MenuItem>
      <MenuItem value="dark">Dark</MenuItem>
      <MenuItem value="light">Light</MenuItem>
    </Select>
  );
}
