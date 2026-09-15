import s from "./index.module.css";

/** The Codex-designed listening-history mark inherits the current theme's ink. */
export default function Brand() {
  return (
    <span className={s.root}>
      <span className={s.symbol} aria-hidden="true" />
      <span>OnRecord</span>
    </span>
  );
}
