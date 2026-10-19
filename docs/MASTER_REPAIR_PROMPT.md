# Master Repair Prompt — GBU One

Apply the supplied repaired source to the real Expo React Native project. Treat the repaired source as the baseline, not as a reason to reintroduce the previous dark-only UI.

## Non-negotiable visual direction

Build GBU One as a calm, light-first student utility. The page background is a cool near-white, cards are white with fine grey borders, and the orange brand accent is reserved for primary actions, active navigation, important notices, and timetable changes. Dark mode may be added later through the same semantic tokens, but it must not be the default and it must not be implemented by scattering hard-coded colours through screens.

The Nuvio reference is a navigation and interaction reference only. Do not copy its GPL source. Use the floating pill dock pattern, but keep GBU One's information architecture: Home, Timetable, Notices, PYQ, and Profile.

## Apply in this order

1. Copy `src/lib/theme.ts`, `src/components/ui/GlassCard.tsx`, `src/components/ui/FloatingTabBar.tsx`, `src/components/brand/AnimatedLogo.tsx`, `src/components/brand/SplashScreenView.tsx`, and `app/_layout.tsx` first.
2. Apply the light-theme screen sweep from the repaired `app/` and `src/components/ui/` files.
3. Preserve the existing real project configuration, dependencies, routing, stores, and API adapters. Do not invent a new backend while applying this UI patch.
4. Verify every route opens with the light page background and does not show a dark card, dark placeholder, or white-on-white label.
5. Verify the logo is visually identical before and after animation. The mark may fade, scale, glow, and rotate by a very small amount; its geometry must never be drawn with stroke dashes.
6. Verify the splash callback fires once and only once.
7. Verify the home timetable-change banner is data-driven and is not shown merely because the screen mounted.

## Acceptance criteria

The default experience must be light, readable, and coherent on login, onboarding, home, timetable, notices, PYQ, profile, exams, calendar, mail, class setup, and about screens. Every pressable control must have at least a 44-point touch target. Inputs must use the semantic tertiary placeholder color. Cards must use the shared elevation language. The floating dock must not cover content or render low-contrast labels. Loading, empty, and offline states must remain understandable on a white surface.

Run the host project's normal typecheck, lint, and Expo start commands after copying the files. This archive deliberately does not include the host project's package metadata, so those checks must run in the actual project rather than in this source-only handoff.
