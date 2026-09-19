import {
  createContext,
  ReactNode,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSelector } from "react-redux";

import { selectUser } from "./redux/modules/user/selector";

export const DESIGN_WORLDS = [
  { id: "atlas", label: "Atlas", shortLabel: "A" },
  { id: "programme", label: "Programme", shortLabel: "P" },
  { id: "darkroom", label: "Darkroom", shortLabel: "D" },
  { id: "standard", label: "Standard", shortLabel: "S" },
  { id: "vinyl", label: "Vinyl", shortLabel: "V" },
  { id: "marquee", label: "Marquee", shortLabel: "M" },
  { id: "gallery", label: "Gallery", shortLabel: "G" },
] as const;

/** Identity art for each theme, shown in the Settings theme picker. */
export const DESIGN_WORLD_ART: Record<
  DesignWorld,
  { src: string; description: string }
> = {
  atlas: {
    src: "/themes/atlas.jpg",
    description: "Vintage atlases with a brass magnifying glass",
  },
  programme: {
    src: "/themes/programme.jpg",
    description: "Swiss-print concert programmes",
  },
  darkroom: {
    src: "/themes/darkroom.jpg",
    description: "A film darkroom under an amber safelight",
  },
  standard: {
    src: "/themes/standard.jpg",
    description: "Studio speakers with soft indigo light",
  },
  vinyl: {
    src: "/themes/vinyl.jpg",
    description: "A vinyl record on dark walnut",
  },
  marquee: {
    src: "/themes/marquee.jpg",
    description: "A brass theater marquee at night",
  },
  gallery: {
    src: "/themes/gallery.jpg",
    description: "A framed artwork in a bright gallery",
  },
};

export type DesignWorld = (typeof DESIGN_WORLDS)[number]["id"];

interface DesignWorldContextValue {
  world: DesignWorld;
  setWorld: (world: DesignWorld) => void;
}

const DesignWorldContext = createContext<DesignWorldContextValue | null>(null);
const STORAGE_PREFIX = "onrecord:design-world";
// The product was renamed from Your Spotify; keep reading stored preferences.
const LEGACY_STORAGE_PREFIX = "your-spotify:design-world";

function readStoredWorld(storageKey: string): string | null {
  return (
    localStorage.getItem(storageKey) ??
    localStorage.getItem(
      storageKey.replace(STORAGE_PREFIX, LEGACY_STORAGE_PREFIX),
    )
  );
}

function isDesignWorld(value: string | null): value is DesignWorld {
  return DESIGN_WORLDS.some((world) => world.id === value);
}

export function DesignWorldProvider({ children }: { children: ReactNode }) {
  const user = useSelector(selectUser);
  const storageKey = `${STORAGE_PREFIX}:${user?._id ?? "guest"}`;
  const [world, setWorldState] = useState<DesignWorld>(() => {
    const stored = readStoredWorld(storageKey);
    return isDesignWorld(stored) ? stored : "atlas";
  });

  useEffect(() => {
    const stored = readStoredWorld(storageKey);
    if (isDesignWorld(stored)) {
      setWorldState(stored);
    } else {
      setWorldState((currentWorld) => {
        localStorage.setItem(storageKey, currentWorld);
        return currentWorld;
      });
    }
  }, [storageKey]);

  useEffect(() => {
    document.body.dataset.designWorld = world;
  }, [world]);

  const setWorld = useCallback(
    (nextWorld: DesignWorld) => {
      setWorldState(nextWorld);
      localStorage.setItem(storageKey, nextWorld);
    },
    [storageKey],
  );

  const value = useMemo(() => ({ world, setWorld }), [setWorld, world]);

  return (
    <DesignWorldContext.Provider value={value}>
      {children}
    </DesignWorldContext.Provider>
  );
}

export function useDesignWorld() {
  const context = useContext(DesignWorldContext);
  if (!context) {
    throw new Error("useDesignWorld must be used inside DesignWorldProvider");
  }
  return context;
}
