import { Button, Checkbox, MenuItem, Select } from "@mui/material";
import { useState } from "react";
import { useSelector } from "react-redux";

import Header from "../../../components/Header";
import { IntervalSelector } from "../../../components/IntervalSelector";
import { ITooltip } from "../../../components/iTooltip/iTooltip";
import Text from "../../../components/Text";
import { useNavigateAndSearch } from "../../../services/hooks/hooks";
import {
  detailIntervalToQuery,
  IntervalDetail,
  presetIntervals,
} from "../../../services/intervals";
import { AdminAccount } from "../../../services/redux/modules/admin/reducer";
import { selectAccounts } from "../../../services/redux/modules/admin/selector";
import { selectUser } from "../../../services/redux/modules/user/selector";
import { CollaborativeMode } from "../../../services/types";
import { AFFINITY_PREFIX } from "./types";

import s from "./index.module.css";

export default function Affinity() {
  const navigate = useNavigateAndSearch();
  const user = useSelector(selectUser);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState(CollaborativeMode.MINIMA);
  const [statType, setStatType] = useState("songs");
  const [dataInterval, setDataInterval] = useState<IntervalDetail>(
    presetIntervals[1],
  );
  const accounts = useSelector(selectAccounts);

  const add = (account: AdminAccount) => {
    const newSet = new Set(ids);
    if (newSet.has(account.id)) {
      newSet.delete(account.id);
    } else {
      newSet.add(account.id);
    }
    setIds(newSet);
  };

  const compute = () => {
    navigate(`/collaborative/top/${statType}/${mode}`, {
      ids: Array.from(ids).join(","),
      ...detailIntervalToQuery(dataInterval, AFFINITY_PREFIX),
    });
  };

  const content = (
    <div>
      <p>
        Listening share is the proportion of each user’s plays for a track,
        artist, or album in the selected date range.
      </p>
      <ul>
        <li>
          <strong>Average share</strong> ranks by the average listening share
          across selected users.
        </li>
        <li>
          <strong>Minimum share</strong> ranks by the lowest listening share
          among selected users.
        </li>
      </ul>
    </div>
  );

  return (
    <div className={s.root}>
      <Header
        hideInterval
        title={
          <div className={s.title}>
            Affinity <ITooltip content={content} />
          </div>
        }
        subtitle="Compare listening habits with other users."
      />
      <div className={s.content}>
        <div>
          <div className={s.accountselection}>
            <Text element="h2" className={s.section} size="big">
              Users
            </Text>
            {accounts.map((account) => (
              <button
                type="button"
                key={account.id}
                className={s.account}
                onClick={() => add(account)}>
                <Text size="normal">{account.username}</Text>
                <Checkbox
                  checked={ids.has(account.id) || account.id === user?._id}
                  disabled={account.id === user?._id}
                  disableRipple
                  disableTouchRipple
                  disableFocusRipple
                />
              </button>
            ))}
          </div>
          <div className={s.modeselection}>
            <Text element="h2" className={s.section} size="big">
              Ranking method
            </Text>
            <Select
              variant="standard"
              value={mode}
              onChange={(ev) => setMode(ev.target.value as CollaborativeMode)}>
              <MenuItem value={CollaborativeMode.MINIMA}>
                Minimum share
              </MenuItem>
              <MenuItem value={CollaborativeMode.AVERAGE}>
                Average share
              </MenuItem>
            </Select>
          </div>
          <div className={s.typeselection}>
            <Text element="h2" className={s.section} size="big">
              Compare by
            </Text>
            <Select
              variant="standard"
              value={statType}
              onChange={(ev) => setStatType(ev.target.value)}>
              <MenuItem value="songs">Tracks</MenuItem>
              <MenuItem value="albums">Albums</MenuItem>
              <MenuItem value="artists">Artists</MenuItem>
            </Select>
          </div>
          <div className={s.timeselection}>
            <Text element="h2" className={s.section} size="big">
              Date range
            </Text>
            <IntervalSelector
              forceTiny
              value={dataInterval}
              onChange={setDataInterval}
              selectType="standard"
            />
          </div>
          <Button
            onClick={compute}
            variant="contained"
            disabled={ids.size === 0}>
            Compare listening
          </Button>
        </div>
      </div>
    </div>
  );
}
