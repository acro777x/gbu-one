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

## Phase 2 — Timetable (the headache)
- [x] `TimetableProvider` interface + mock + canonical schema
- [x] Timetable screen (day/week/compact), skeleton/empty/error/offline
- [x] Next-class card with countdown + progress bar on Home
- [x] Snapshot + diff engine with unit tests
- [x] Worker job to poll classes and write `timetable_changes`
- [x] Push for timetable changes; "Changed" chips in UI
- [x] Real provider (after owner supplies API details)

## Phase 3 — Notices
- [ ] Worker: fetch + parse main notices and exams portal, idempotent inserts
- [ ] Attachment download, OCR for images and scanned PDFs, store raw text
- [ ] Classifier, audience tagging, importance score (tests with real titles)
- [ ] Deadline extraction and thread grouping
- [ ] Notices screen: search, removable chips, bottom-sheet detail, original viewer
- [ ] Hero carousel on Home from top notices
- [ ] Push pipeline + notification preferences

## Phase 4 — PYQ
- [ ] Tables, RLS, Storage buckets
- [ ] Browse flow: school → programme code → semester → subject, plus search
- [ ] Grid UI with multi-select toast and bulk download
- [ ] Upload flow + pending status + moderation (admin screen or documented dashboard process)
- [ ] Report button, copyright/takedown note, Trending row

## Phase 5 — Exams, results, deadlines, calendar
- [ ] Exam hub: date sheet for my programme, revision alerts, countdown, admit card reminder
- [ ] Result finder (on-device PDF text search for roll number)
- [ ] Deadline tracker with local reminders
- [ ] Academic calendar + holidays parsed into a calendar view
- [ ] Manual attendance tracker (local)

## Phase 6 — Polish and release
- [ ] Performance pass (cold start, list virtualisation), accessibility pass
- [ ] Error reporting without PII, privacy policy page, About/disclaimer
- [ ] Android release build (EAS), internal testing with 10 students
- [ ] Student survey results reviewed; update priorities

## Later ideas (do not build without owner approval)
Hindi UI, home-screen widgets, faculty directory, hostel/mess notices, incubation links.
