import { MenuItem, Select } from "@mui/material";
import { useSelector } from "react-redux";

import Text from "../../../components/Text";
import TitleCard from "../../../components/TitleCard";
import { changeStatUnit } from "../../../services/redux/modules/settings/thunk";
import { selectStatMeasurement } from "../../../services/redux/modules/user/selector";
import { useAppDispatch } from "../../../services/redux/tools";
import SettingLine from "../SettingLine";

import s from "./index.module.css";

const units = [
  { name: "Plays", value: "number" },
  { name: "Listening time", value: "duration" },
];

export function StatMeasurement() {
  const dispatch = useAppDispatch();
  const statMeasurement = useSelector(selectStatMeasurement);

  const handleChangeStatMeasurement = (
    newStatUnit: string | null | undefined,
  ) => {
    if (newStatUnit !== "number" && newStatUnit !== "duration") {
      return;
    }
    dispatch(changeStatUnit(newStatUnit ?? "number")).catch(console.error);
  };

  return (
    <TitleCard title="Ranking preference">
      <Text element="span" className={s.marginbottom} size="normal">
        Rank tracks, artists, and albums by plays or listening time.
      </Text>
      <SettingLine
        left="Rank by"
        right={
          <Select
            variant="standard"
            value={statMeasurement}
            onChange={(ev) => handleChangeStatMeasurement(ev.target.value)}>
            {units.map((unit) => (
              <MenuItem key={unit.value} value={unit.value}>
                {unit.name}
              </MenuItem>
            ))}
          </Select>
        }
      />
    </TitleCard>
  );
}
