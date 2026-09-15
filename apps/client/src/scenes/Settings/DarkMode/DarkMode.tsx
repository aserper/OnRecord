import TitleCard from "../../../components/TitleCard";
import SettingLine from "../SettingLine";
import DarkModeSwitch from "./DarkModeSwitch";

export default function DarkMode() {
  return (
    <TitleCard title="Color mode">
      <SettingLine left="Mode" right={<DarkModeSwitch />} />
    </TitleCard>
  );
}
