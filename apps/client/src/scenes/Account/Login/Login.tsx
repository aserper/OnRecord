import { Checkbox } from "@mui/material";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

import Brand from "../../../components/Brand/Brand";
import Text from "../../../components/Text";
import { useNavigate } from "../../../services/hooks/useNavigate";
import { selectUser } from "../../../services/redux/modules/user/selector";
import { LocalStorage, REMEMBER_ME_KEY } from "../../../services/storage";
import { getSpotifyLogUrl } from "../../../services/tools";

import s from "../index.module.css";

export default function Login() {
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const [rememberMe, setRememberMe] = useState(
    LocalStorage.get(REMEMBER_ME_KEY) === "true",
  );

  useEffect(() => {
    if (user) {
      navigate("/");
    } else if (LocalStorage.get(REMEMBER_ME_KEY) === "true") {
      window.location.href = getSpotifyLogUrl();
    }
  }, [navigate, user]);

  const handleRememberMeClick = async () => {
    const newRememberMe = !rememberMe;
    setRememberMe(newRememberMe);
    if (newRememberMe) {
      LocalStorage.set(REMEMBER_ME_KEY, "true");
    } else {
      LocalStorage.delete(REMEMBER_ME_KEY);
    }
  };

  return (
    <main className={s.root}>
      <div className={s.artwork} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <section className={s.loginPanel} aria-labelledby="login-title">
        <div className={s.brand}>
          <Brand />
        </div>
        <Text size="pagetitle" element="h1" className={s.title}>
          <span id="login-title">Your listening history</span>
        </Text>
        <Text size="big" className={s.welcome}>
          Sign in with Spotify to view your listening history and statistics.
        </Text>
        <a className={s.link} href={getSpotifyLogUrl()}>
          Sign in with Spotify
          <span aria-hidden="true">→</span>
        </a>
        <button
          type="button"
          className={clsx("no-button", s.rememberMe)}
          onClick={handleRememberMeClick}>
          <Checkbox
            checked={rememberMe}
            disableRipple
            disableTouchRipple
            disableFocusRipple
            classes={{ root: s.check }}
          />
          <Text size="normal">Keep me signed in on this device</Text>
        </button>
      </section>
    </main>
  );
}
