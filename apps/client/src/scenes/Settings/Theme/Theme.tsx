import clsx from "clsx";

import Text from "../../../components/Text";
import TitleCard from "../../../components/TitleCard";
import {
  DESIGN_WORLD_ART,
  DESIGN_WORLDS,
  useDesignWorld,
} from "../../../services/designWorld";

import s from "./index.module.css";

/**
 * Theme picker using each theme's identity art.
 *
 * Every theme carries a photographed identity so the choice reads as a visual
 * one rather than a list of names; the active theme is marked with its own
 * accent so the picker itself follows the selected design system.
 */
export default function Theme() {
  const { world, setWorld } = useDesignWorld();

  return (
    <TitleCard title="Theme">
      <Text element="span" className={s.marginbottom} size="normal">
        Choose the design system used across OnRecord. Your choice is saved for
        this account on this browser.
      </Text>

      <div className={s.grid} role="group" aria-label="Theme">
        {DESIGN_WORLDS.map((option) => {
          const art = DESIGN_WORLD_ART[option.id];
          const active = option.id === world;
          return (
            <button
              key={option.id}
              type="button"
              className={clsx(s.option, { [s.active]: active })}
              aria-pressed={active}
              aria-label={`${option.label} theme`}
              title={art.description}
              onClick={() => setWorld(option.id)}>
              <span className={s.frame}>
                <img className={s.art} src={art.src} alt="" loading="lazy" />
                <span className={s.badge} aria-hidden="true">
                  {option.shortLabel}
                </span>
              </span>
              <span className={s.name}>{option.label}</span>
            </button>
          );
        })}
      </div>
    </TitleCard>
  );
}
