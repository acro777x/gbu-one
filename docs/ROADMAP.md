# Roadmap

Rule: take the first unchecked task, finish it (typecheck + lint + tests), tick it, commit, repeat. Blocked items go to `OPEN_QUESTIONS.md` and you continue with a mock.

## Phase 0 — Setup
- [x] Verify `docs/design-refs/` has the 3 images; clone Nuvio to `../ref/nuvio-mobile` (read-only) and note what you learned about its bottom bar in `docs/qa/nuvio-notes.md`
- [x] Create Expo + TS project, Expo Router, ESLint, Prettier, Jest, `.env.example`, `.gitignore` (includes `.env`, `/ref`)
- [x] Theme tokens, fonts, UI kit skeleton (see `UI_SPEC.md`)
- [x] CI workflow: typecheck, lint, tests

## Phase 1 — Shell, animation, auth, onboarding (first milestone)
- [x] Motion tokens + six text components (TypeWriter, WordReveal, LetterRise, ShimmerText, CountUp, ScrambleText) + `/dev/motion` playground (see `ANIMATION_SPEC.md`)
- [x] Build brand vector assets from `assets/brand/source/` (trace, simplify, overlay check in `docs/qa/logo-overlay.png`), icon set, mono, adaptive icon (see `LOGO_BRIEF.md`)
- [x] `LogoMark` + `AnimatedLogo` from the final traced mark (ring draw, dome rise, "1" scale, ripple, code glow, loading rotation); Poppins Bold wordmark; reserved `<OfficialSeal />` slot
- [x] Splash sequence with native handoff, 2.3s cap, skip and warm-start variant
- [x] Bootstrap loading screen, skeleton shimmer, custom pull-to-refresh, button loading morph
- [x] `FloatingTabBar` matching `signal-bloom.png` (capsule, glass, avatar tab, glow, animation)
- [x] Splash + 3-slide onboarding
- [x] Login screen: roll number + password, Create account, Continue as guest
- [x] Supabase auth wiring + guest mode + "Create account" bottom sheet for gated features
- [x] Class setup flow (school → programme → semester → section)
- [x] Profile screen with preferences, guest variant, delete account
- [x] Screenshots vs references in `docs/qa/`

## Phase 2 — Timetable
- [x] `TimetableProvider` interface + mock + canonical schema
- [x] Timetable screen (day/week/compact), skeleton/empty/error/offline
- [x] Next-class card with countdown + progress bar on Home
- [x] Snapshot + diff engine with unit tests
- [x] Central timetable store (`timetableStore.ts`) with 6-hour TTL AsyncStorage caching & request deduplication
- [ ] Push for timetable changes; "Changed" chips in UI — UI chips + local change detection ship today; **only the server-side dispatch (worker diff → FCM push for timetable changes) is outstanding.** Notices push dispatch is already shipped (`worker/pushSender.ts`, `.github/workflows/worker-cron.yml`)
- [x] Real provider (`samay.mygbu.in/api.php` with legacy `mygbu.in/schd/api.php` fallback, then mock fallback)

## Phase 3 — Notices
- [x] Worker: fetch + parse main notices and exams portal, idempotent inserts (Supabase upsert keyed on `source_id`, `.github/workflows/worker-cron.yml` on a 15-minute schedule, soft-404 guard, GBU TLS tolerance, `worker/run.ts` entrypoint)
- [ ] Attachment download, OCR for images and scanned PDFs, store raw text (OCR provider + content-hash dedupe shipped in `worker/ocrService.ts`; per-file download/extract pipeline still to build)
- [x] Notices screen: search, removable chips, virtualized FlatList, detail screen, official portal viewer
- [x] Hero carousel on Home from top notices (with useIsFocused pause)
- [x] Persistent notification preferences in Profile (`@gbu_one_notify_*`)

## Phase 4 — PYQ
- [ ] Cloud Storage buckets & backend moderation queue
- [x] Browse flow: school → programme code → semester → subject, plus search
- [x] Virtualized 2-column FlatList Grid UI with multi-select and honest cloud sync status
- [x] Upload flow + student moderation disclaimers
- [x] Report button, copyright/takedown note, Trending row

## Phase 5 — Exams, results, deadlines, calendar
- [x] Exam hub: date sheet for my programme, revision alerts, countdown, admit card reminder
- [x] Result finder (on-device PDF text search for roll number)
- [x] Deadline tracker with local reminders
- [x] Academic calendar + holidays parsed into virtualized FlatList view with official PDF link
- [x] Manual attendance tracker (local battery card)

## Phase 6 — Polish and release
- [x] Performance pass (cold start, 60Hz Android GPU optimization, elevation cleanup on GlassCard & FloatingTabBar)
- [x] List virtualisation (Notices, PYQ, Mail, Calendar)
- [x] Streamlined 1.7s splash with UI-thread TypeWriter & 512px native splash mark
- [x] Supabase client config (`src/lib/supabase.ts`) + Create Account bottom sheet in login
- [x] Error reporting without PII, privacy policy page, About/disclaimer
- [ ] Android release build (EAS / production keystore)
- [ ] Student survey results reviewed; update priorities

## Later ideas (do not build without owner approval)
Hindi UI, home-screen widgets, faculty directory, hostel/mess notices, incubation links.
