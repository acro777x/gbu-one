# GBU One UI Audit and Repair Record

## Executive finding

The previous source was visually inconsistent because it was dark-mode artwork spread across otherwise reusable components. The theme file existed, but most surfaces, borders, placeholders, shadows, and gradients were hard-coded. A light theme could therefore never render correctly. The logo animation also attempted to reveal filled polygon paths with SVG stroke dashes; that is not a valid way to animate this mark and caused broken geometry.

## Repair priorities

### P0 — repaired

- Replaced the dark-only token system with a light-first semantic palette.
- Removed dark-only backgrounds from app screens and shared UI components.
- Changed root status-bar treatment to `dark-content` and delayed native splash hiding until fonts are ready.
- Rebuilt `GlassCard` around white/light-muted surfaces, accessible borders, restrained shadows, and an orange accent glow.
- Reworked the floating tab bar for a white dock, visible active capsule, readable labels, and lower shadow intensity.
- Replaced the broken logo path-stroking animation with a whole-mark animation. The original mark is now always rendered by `LogoMark`; only opacity, scale, glow, and a tiny rotation are animated.
- Removed the duplicate splash completion callback, which previously called `onFinish` twice.
- Removed the home screen's unconditional fake timetable-change state. The banner now appears only when the fetched slot is actually marked changed.

### P1 — source-wide corrections applied

- Converted hard-coded dark surfaces such as `#161618`, `#0F0F11`, and `#202024` to semantic light surfaces.
- Converted white-alpha borders and dividers to dark-alpha borders suitable for a light background.
- Converted placeholder colors to `textTertiary`.
- Preserved orange, success, warning, and danger meaning while reducing neon/glow treatment.
- Kept bottom content padding so the floating tab bar does not obscure the last card.

## Visual rules going forward

- Light mode is the default product experience.
- Use `theme.colors.bg` for page backgrounds, `surface` for cards, `surfaceMuted` for inputs and secondary wells, and `borderGlass` for standard borders.
- Use one primary accent orange. Do not introduce a new orange for individual screens.
- Cards are solid and elevated, not opaque dark glass.
- A card must not carry both a heavy border and a heavy glow unless it represents an urgent state.
- Empty, loading, error, and offline states must be explicit and actionable.
- No feature state may be hard-coded as changed, live, unread, or urgent unless it comes from the data model.
- Logo paths are brand assets, not animation primitives. Animate the finished mark, never reconstruct it with dash offsets.

## Remaining product-level risks

The supplied archive contains no `package.json`, Expo config, Babel config, TypeScript config, or lockfile, so this archive cannot be built in isolation. It is a source patch to be applied to the original Expo project. The mock services are still mock services; production notices, PYQ moderation, push delivery, and timetable API authentication must be connected in the host project.
