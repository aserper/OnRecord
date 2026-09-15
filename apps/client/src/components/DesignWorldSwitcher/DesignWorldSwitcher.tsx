import { DESIGN_WORLDS, useDesignWorld } from "../../services/designWorld";

import s from "./index.module.css";
import clsx from "clsx";


export default function DesignWorldSwitcher({ compact = false }: { compact?: boolean }) {
  const { world, setWorld } = useDesignWorld();

  return (
    <div className={clsx(s.root, { [s.compact]: compact })} aria-label="Interface design" role="group">
      <span className={s.label}>View</span>
      <div className={s.options}>
        {DESIGN_WORLDS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={option.id === world ? s.active : undefined}
            aria-pressed={option.id === world}
            title={`${option.label} design`}
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
