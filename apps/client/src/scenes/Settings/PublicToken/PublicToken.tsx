import { Button } from "@mui/material";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { useSelector } from "react-redux";

import Text from "../../../components/Text";
import TitleCard from "../../../components/TitleCard";
import { alertMessage } from "../../../services/redux/modules/message/reducer";
import { selectUser } from "../../../services/redux/modules/user/selector";
import {
  deletePublicToken,
  generateNewPublicToken,
} from "../../../services/redux/modules/user/thunk";
import { useAppDispatch } from "../../../services/redux/tools";
import SettingLine from "../SettingLine";

import s from "./index.module.css";

export default function PublicToken() {
  const dispatch = useAppDispatch();
  const user = useSelector(selectUser);
  const location = window.location.origin;

  const generate = () => {
    dispatch(generateNewPublicToken());
  };

  const deleteToken = () => {
    dispatch(deletePublicToken());
  };

  const onCopy = () => {
    dispatch(alertMessage({ level: "info", message: "Public link copied" }));
  };

  if (!user) {
    return null;
  }

  const link = `${location}/?token=${user.publicToken}`;

  return (
    <TitleCard title="Public link">
      <Text element="div" className={s.disclaimer} size="normal">
        Anyone with this link can view your listening history and statistics,
        but cannot change your account. Replacing or revoking the link
        invalidates existing shared links.
      </Text>
      <SettingLine
        left="Public link"
        right={
          user.publicToken ? (
            <CopyToClipboard text={link} onCopy={onCopy}>
              <div className={s.link}>
                <Text element="div" size="normal">
                  {link}
                </Text>
              </div>
            </CopyToClipboard>
          ) : (
            "No public link"
          )
        }
      />
      <SettingLine
        left="Manage link"
        right={
          <div className={s.row}>
            <Button onClick={generate}>
              {user.publicToken ? "Replace link" : "Create link"}
            </Button>
            <Button onClick={deleteToken}>Revoke link</Button>
          </div>
        }
      />
    </TitleCard>
  );
}
