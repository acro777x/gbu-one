# Prompt for Antigravity — Animation work (also covered by START_PROMPT.md)

You are building the animation system for **GBU One**, the official all-in-one app of Gautam Buddha University (GBU), Greater Noida. The app brings together notices, timetable, exams, results, PYQs and deadlines. Its feel is dark, cinematic, premium and calm (see `docs/design-refs/signal-bloom.png` for the bottom bar and hero style, and the Nuvio mobile clone in `../ref/nuvio-mobile` as a read-only motion reference; GPL-3.0, so never copy its code).

**The logo is FINAL** (`docs/LOGO_BRIEF.md`; source art in `assets/brand/source/`). First build the clean vector mark from the approved image (with the overlay check), then animate it. Do not redesign or recolour it, and never draw or alter the official university seal.

## Do this
1. Read `AGENTS.md`, then `docs/UI_SPEC.md` and `docs/ANIMATION_SPEC.md` fully.
2. Install and configure `react-native-reanimated` 3, `react-native-svg`, `expo-haptics`, `expo-splash-screen` (add Skia only if needed).
3. Create `src/lib/motion.ts` with the tokens from the spec.
4. Build the text components in `src/components/motion/`: `TypeWriter`, `WordReveal`, `LetterRise`, `ShimmerText`, `CountUp`, `ScrambleText` (UI-thread worklets, Reduce Motion aware, full text exposed to screen readers).
5. Build `src/components/brand/LogoMark.tsx` from the traced final mark plus an `AnimatedLogo`: ring ribbons stroke-draw in opposite directions, dome and finial rise, "1" scales in, one ripple, glow as a separate animated layer, slow ring rotation for loading (see "Logo-specific motion" in the spec). Wordmark is live Poppins Bold text.
6. Build the **splash sequence** (logo draw → wordmark `LetterRise` + shimmer → tagline `TypeWriter` "Everything GBU. One app." → handoff to Home) with a seamless native splash handoff and a 2.3s cap, tap-to-skip, and a short variant for warm starts.
7. Build the **bootstrap loading screen** (breathing logo, shimmering progress line, cycling status text with `WordReveal`), shown only when no cache exists; skeleton shimmer, custom pull-to-refresh, and button loading morph.
8. Wire the tab bar capsule, bottom sheet, toast and card-press motions from the spec.
9. Add a hidden `/dev/motion` playground screen to preview every animation with speed controls.
10. Record screen captures into `docs/qa/` and write `docs/qa/perf-notes.md` (frame rate on a low-end Android, cold-start impact).

## Rules
- Everything on the UI thread; target 60fps on a mid-range Android; never delay Home beyond the 2.3s splash cap.
- Respect Reduce Motion and accessibility as written in the spec.
- No secrets, no new features outside the docs; unknowns go to `docs/OPEN_QUESTIONS.md`.
- Small commits with conventional messages; run typecheck, lint and tests after each task; tick `docs/ROADMAP.md`.

## When done
Stop and show me the recordings, the `/dev/motion` screen, and the logo overlay check. 
