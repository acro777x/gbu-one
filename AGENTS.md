# AGENTS.md — Rules for the coding agent

You are building **GBU One** , a student app for Gautam Buddha University (GBU), Greater Noida. Read every file in `/docs` before writing code. Work autonomously, but follow these rules.

## Read order
1. `docs/PROJECT_BRIEF.md` — what and why
2. `docs/UI_SPEC.md` — how it must look (source of truth for visuals)
3. `docs/SCREENS_AUTH.md` — login, onboarding, profile
   `docs/LOGO_BRIEF.md` — FINAL logo, colours, typography, vector build task, seal rules
   `docs/ANIMATION_SPEC.md` — splash, logo animation, loading, text effects
4. `docs/ARCHITECTURE.md`, `docs/DATA_SOURCES.md`, `docs/NOTIFICATIONS.md`
5. `docs/ROADMAP.md` — pick the next unchecked task, finish it, tick it, repeat

## Stack (fixed unless the owner changes it)
- Expo (React Native) + TypeScript (strict), Expo Router
- State: Zustand; data fetching: TanStack Query; local storage: expo-sqlite + MMKV
- Backend: Supabase (auth for the app account, Postgres, Storage for PYQ files)
- Push: Firebase Cloud Messaging via expo-notifications
- Scraper/worker: Node + TypeScript in `/worker`, run by GitHub Actions cron

## Design references (MUST do before building any UI)
1. The owner's 3 reference images are in `docs/design-refs/` (adverse-casino.png, n99-beauty.png, signal-bloom.png). Open and study them. If missing, stop and ask the owner to add them.
2. Clone the Nuvio mobile repo as a **read-only visual reference**:
   ```
   git clone https://github.com/NuvioMedia/NuvioMobile.git ../ref/nuvio-mobile
   ```
   Keep it OUTSIDE this repo (or in a git-ignored `/ref`). Study its bottom navigation, tab animations, hero carousel, cards and spacing. Run it if you can and compare screenshots.
3. **License rule:** Nuvio is GPL-3.0. Do NOT copy or translate its source code into this app. Reproduce the *look and behavior* only, written from scratch. Never commit `/ref`.
4. After building each screen, compare it side by side with the reference images and fix differences (radius, blur, spacing, type scale, active-tab capsule). Save comparison screenshots in `docs/qa/`.

## Hard rules
- **Logo is final.** Do not redesign or recolour it. Reproduce it from `assets/brand/source/` per `docs/LOGO_BRIEF.md`. Do not ship the raw transparent PNG (it has artifacts). App icon is the mark only, no wordmark.
- **Never redraw, generate or alter the official GBU seal.** Reserve the slot; the owner supplies the official vector later.
- **Never** commit secrets. All keys, API base URLs and credentials go in `.env` (git-ignored); keep `.env.example` updated.
- **Never** store a student's university password on our server or in logs. See `docs/SCREENS_AUTH.md`.
- The owner's timetable API details are NOT in these docs. Use the adapter interface in `DATA_SOURCES.md` with a mock first, then ask the owner for the real endpoint format.
- Scrape only public pages, with a polite rate (see `DATA_SOURCES.md`). Identify the worker with a clear User-Agent.
- Guest mode must work without any account. Features needing identity show a friendly sign-in sheet, not an error.
- Offline-first: every main screen renders from cache, then refreshes.
- Accessibility: min touch target 44pt, contrast AA on dark theme, support dynamic text sizes.

## Working style
- Small commits, conventional messages (`feat:`, `fix:`, `chore:`).
- After each roadmap task: run typecheck + lint + tests, then update `docs/ROADMAP.md`.
- If a requirement is ambiguous or blocked (missing API details, missing images), write the question in `docs/OPEN_QUESTIONS.md`, proceed with a mock, and continue.
- Do not add features not in the docs without noting them in `OPEN_QUESTIONS.md`.

## Definition of done (per feature)
Works offline, has loading/empty/error states, matches UI_SPEC, typed, tested for logic (diffing, parsing, classification), and runs on Android and iOS.
