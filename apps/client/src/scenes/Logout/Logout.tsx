import { CircularProgress } from "@mui/material";
import { useEffect } from "react";

import Text from "../../components/Text";
import { api } from "../../services/apis/api";
import { useNavigate } from "../../services/hooks/useNavigate";
import { logout } from "../../services/redux/modules/user/reducer";
import { useAppDispatch } from "../../services/redux/tools";
import { LocalStorage, REMEMBER_ME_KEY } from "../../services/storage";

export default function Logout() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function dologout() {
      dispatch(logout());
      try {
        await api.logout();
      } catch (e) {
        console.error(e);
      }
      LocalStorage.delete(REMEMBER_ME_KEY);
      navigate("/login");
    }
    dologout().catch(console.error);
  }, [navigate, dispatch]);

  return (
    <div>
      <Text element="h3" size="big">
        Signing out
      </Text>
      <CircularProgress />
    </div>
  );
}
