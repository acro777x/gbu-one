# AGENTS.md — Rules for the coding agent

You are building **GBU One**, a student companion app for Gautam Buddha University (GBU), Greater Noida. Work autonomously, but follow these rules strictly.

---

## Current Project Context (October 2026)

- **Test Suite**: **420 passed, 420 total across 29 test suites** (`npm test`). All unit, integration, and security tests must remain green.
- **Implementation State**: Phases 0 through 6 are fully implemented (Timetable, Notices, Class Alarms, PYQ Library & Moderation Queue, Exam Date Sheets & Results Watch, Academic Calendar, SQLite Offline Cache, Light-First UI System).
- **Open Blockers / Owner Actions**: Tracked in `docs/OPEN_QUESTIONS.md` (Supabase RLS dashboard SQL paste, EAS push setup, 103 PYQ Telegram archive file answers, and survey review).

---

## Read order
1. `README.md` — system overview, current state, and verified capabilities
2. `docs/PROJECT_BRIEF.md` — what and why
3. `docs/UI_SPEC.md` & `docs/FULL_UI_AUDIT.md` — how it must look (source of truth for visuals and light-theme tokens)
4. `docs/SCREENS_AUTH.md` — login, onboarding, profile, role-based access
5. `docs/LOGO_BRIEF.md` — FINAL logo, colours, typography, vector build task, seal rules
6. `docs/ANIMATION_SPEC.md` — splash, logo animation, loading, text effects
7. `docs/ARCHITECTURE.md`, `docs/DATA_SOURCES.md`, `docs/NOTIFICATIONS.md`, `docs/ADMIN_MODERATION.md`
8. `docs/ROADMAP.md` — pick the next unchecked task, finish it, tick it, repeat

---

## Stack (fixed unless the owner changes it)
- Expo (React Native SDK 52) + TypeScript (strict), Expo Router
- State: Zustand; data fetching: TanStack Query; local storage: expo-sqlite + MMKV (AsyncStorage fallback)
- Backend: Supabase (auth for the app account, Postgres, Storage for PYQ files)
- Push: Firebase Cloud Messaging via expo-notifications and Expo Push API
- Scraper/worker: Node + TypeScript in `/worker`, run by GitHub Actions cron

---

## Hard rules
- **Logo is final.** Do not redesign or recolour it. Reproduce it from `assets/brand/source/` per `docs/LOGO_BRIEF.md`. App icon is the mark only, no wordmark.
- **Never redraw, generate or alter the official GBU seal.** Reserve the slot `<OfficialSeal />`; the owner supplies the official vector later.
- **Never** commit secrets. All keys, API base URLs and credentials go in `.env` (git-ignored); keep `.env.example` updated.
- **Never** store, log, or forward a student's university password. See `docs/SCREENS_AUTH.md`.
- Scrape only public pages, with a polite rate (see `docs/DATA_SOURCES.md`). Identify the worker with a clear User-Agent.
- **Guest mode must work without any account.** Features needing identity show a friendly sign-in sheet, not an error.
- **Offline-first:** every main screen renders from local cache, then refreshes.
- **Accessibility:** min touch target 44pt, contrast AA on dark and light themes, support dynamic text sizes.

---

## Working style
- Small commits, conventional messages (`feat:`, `fix:`, `chore:`).
- After each task: run typecheck + lint + tests (`npm test`), then update `docs/ROADMAP.md`.
- If a requirement is ambiguous or blocked, record it in `docs/OPEN_QUESTIONS.md`, proceed with an offline fallback or mock, and continue.
- Do not add features outside the documentation without logging them in `docs/OPEN_QUESTIONS.md`.

---

## Definition of done (per feature)
Works offline, has loading/empty/error states, matches `docs/UI_SPEC.md` and `docs/FULL_UI_AUDIT.md`, fully typed, logic unit-tested, and verified on Android and iOS.
