# START PROMPT — paste this into Antigravity

You are the lead engineer for **GBU One**, the official all-in-one student app of Gautam Buddha University (GBU), Greater Noida. It brings notices, timetable, exams, results, PYQs and deadlines into one fast, offline-first app. The look is dark, cinematic and premium with a warm orange accent.

## Context you must know
- Stack is fixed: Expo (React Native) + TypeScript strict, Expo Router, Zustand, TanStack Query, expo-sqlite + MMKV, Supabase, Firebase push, a Node worker on GitHub Actions cron. Details in `docs/ARCHITECTURE.md`.
- The **logo and typography are FINAL** (`docs/LOGO_BRIEF.md`). Wordmark is live **Poppins Bold** ("GBU" ivory `#F8F8F6`, "One" orange `#FF6A2B`); the UI font is **Inter**. The mark is a twisted orange ring with a dome and finial and an ivory "1" at the centre. Do not redesign or recolour it.
- The approved raster art is in `assets/brand/source/`. `logo-tile-with-glow.png` is the visual ground truth. `logo-flat-raw-transparent.png` has background-removal artifacts: never ship it.
- The **official GBU seal is not part of the logo** and must never be redrawn or generated. Reserve a `<OfficialSeal />` slot (renders nothing until the owner supplies the official vector).
- Never collect, send to a server, log or store a student's university password. Guest mode must work without an account.

## Do this, in order
1. Open `AGENTS.md` and follow it exactly. Read every file in `docs/` in the order it gives.
2. Verify `docs/design-refs/` has the 3 UI reference images. Clone `https://github.com/NuvioMedia/NuvioMobile.git` to `../ref/nuvio-mobile` as a **read-only** visual reference (GPL-3.0: never copy its code; reproduce look and behaviour only; never commit `/ref`).
3. **Phase 0** from `docs/ROADMAP.md`: project setup, theme tokens, fonts (Poppins + Inter), UI kit skeleton, CI.
4. **Brand assets:** build the vector mark from `assets/brand/source/` as described in `docs/LOGO_BRIEF.md` (clean few-path SVG, ring gradient, overlay check saved to `docs/qa/logo-overlay.png`), then generate the icon set (mark-only app icon, mono, Android adaptive, splash mark, favicon). If tracing cannot pass the overlay check, use the raster fallback in `docs/ANIMATION_SPEC.md` and log why in `docs/OPEN_QUESTIONS.md`.
5. **Animation system** (`docs/ANIMATION_SPEC.md`, `ANIMATION_PROMPT.md`): motion tokens, the six text components with a `/dev/motion` playground, `AnimatedLogo` (ring draw, dome rise, "1" scale, ripple, code-driven glow, loading rotation), splash with native handoff, bootstrap loading screen, skeletons, pull-to-refresh, button loading morph.
6. **Phase 1 shell:** floating bottom bar matching `signal-bloom.png`, onboarding, login (roll number + password, Create account, Continue as guest), class setup, profile. Compare screenshots side by side with the reference images and iterate until close.
7. After every roadmap task: typecheck, lint, tests, tick the box in `docs/ROADMAP.md`, small conventional commit.
8. Anything unknown (timetable API format, OCR choice, official seal, university approval) goes to `docs/OPEN_QUESTIONS.md`; use a mock and keep going. Do not add features outside the docs.

