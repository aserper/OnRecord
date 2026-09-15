import { Button } from "@mui/material";
import { useState } from "react";
import { useSelector } from "react-redux";

import Dialog from "../../../components/Dialog";
import LoadingButton from "../../../components/LoadingButton";
import TitleCard from "../../../components/TitleCard";
import { selectAccounts } from "../../../services/redux/modules/admin/selector";
import { deleteUser } from "../../../services/redux/modules/admin/thunk";
import { useAppDispatch } from "../../../services/redux/tools";
import SettingLine from "../SettingLine";

import s from "./index.module.css";

export default function DeleteUser() {
  const dispatch = useAppDispatch();
  const accounts = useSelector(selectAccounts);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [beingDeleted, setBeingDeleted] = useState<string | null>(null);

  const askDelete = (id: string) => {
    setBeingDeleted(id);
    setOpen(true);
  };

  const doDelete = async () => {
    if (!beingDeleted) {
      return;
    }
    setLoading(true);
    await dispatch(deleteUser({ id: beingDeleted }));
    setLoading(false);
    setOpen(false);
  };

  return (
    <TitleCard title="Delete accounts">
      <Dialog
        title="Delete this account?"
        onClose={() => setOpen(false)}
        open={open}>
        This permanently deletes the account and its listening history. This
        cannot be undone.
        <div className={s.button}>
          <LoadingButton
            loading={loading}
            onClick={doDelete}
            color="error"
            variant="contained">
            Delete account
          </LoadingButton>
        </div>
      </Dialog>
      {accounts.map((user) => (
        <SettingLine
          key={user.id}
          left={user.username}
          right={
            <Button onClick={() => askDelete(user.id)}>Delete account</Button>
          }
        />
      ))}
    </TitleCard>
  );
}
