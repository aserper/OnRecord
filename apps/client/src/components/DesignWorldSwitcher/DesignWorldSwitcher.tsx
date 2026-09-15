import clsx from "clsx";

import { DESIGN_WORLDS, useDesignWorld } from "../../services/designWorld";

import s from "./index.module.css";

export default function DesignWorldSwitcher({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { world, setWorld } = useDesignWorld();

  return (
    <div
      className={clsx(s.root, { [s.compact]: compact })}
      aria-label="Theme"
      role="group">
      <span className={s.label}>Theme</span>
      <div className={s.options}>
        {DESIGN_WORLDS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={option.id === world ? s.active : undefined}
            aria-pressed={option.id === world}
            title={`${option.label} theme`}
            aria-label={`${option.label} theme`}
            onClick={() => setWorld(option.id)}>
            <span className={s.full}>{option.label}</span>
            <span className={s.short} aria-hidden="true">
              {option.shortLabel}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
