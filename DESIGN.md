# Design system

Your Spotify ships four complete interface worlds over one routing, data, and accessibility foundation. A user can change worlds without losing the current route, selected period, or application state. The preference is stored per signed-in user in local storage.

## Product direction

The interface is an archive for exploring listening patterns, not a Spotify imitation. The primary path moves from a period-level fact into artists, albums, tracks, sessions, and source history. Existing routes and behavior remain authoritative.

## Worlds

### Listening Atlas (`atlas`)

- Dark blue-black field with fine topographic contours
- Coral is the single route/highlight color
- Persistent left navigation and a wide evidence-first grid
- Charts are treated as terrain: quiet grids, thin boundaries, strong plotted routes
- Typography: Manrope

### Tour Programme (`programme`)

- Warm ivory paper with cobalt ink and orange-red annotations
- Horizontal programme-like navigation
- Divided editorial columns, oversized condensed headings, and rule-based cards
- Charts read as printed listings rather than glowing dashboards
- Typography: Barlow Condensed for display, Manrope for utility text

### Darkroom Contact Sheet (`darkroom`)

- Near-black field, monochrome artwork, and magenta exposure marks
- Narrow vertical navigation, dense asymmetric image-led compositions
- Dashed frames and square contact-sheet geometry
- Typography: Archivo with condensed utility labels

### Category Standard (`standard`)

- Restrained charcoal surfaces and violet data marks
- Familiar sidebar and balanced dashboard grid
- The conservative option: lowest visual novelty without reverting to the upstream look
- Typography: Manrope

## Shared rules

- World tokens are defined in `apps/client/src/index.css` using `body[data-design-world]`.
- Structural adaptations live beside their components in CSS modules.
- The world selector is `apps/client/src/components/DesignWorldSwitcher/`.
- World state is owned by `apps/client/src/services/designWorld.tsx`.
- Chart colors are resolved at render time from CSS custom properties.
- Album artwork remains the only Spotify-derived visual material; Spotify green is not part of the interface palette.
- Interactive controls must preserve visible focus, keyboard operation, and a minimum 44px target on narrow screens.
- Mobile reflow may simplify topology, but it must preserve each world's type, color, border, and image treatment.

## Extending the system

Add shared behavior once, then express world-specific presentation through the existing data attribute. Do not branch API calls, Redux state, routes, or business logic by world. New visualization colors should use `--chart-*`; surfaces should use `--surface-*`, `--line`, `--ink`, and `--muted` rather than literal colors.
