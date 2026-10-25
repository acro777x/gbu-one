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
- [x] Push for timetable changes; "Changed" chips in UI — UI chips + local change detection ship today; **server-side dispatch shipped** (`worker/pushSender.ts` sends class-targeted timetable pushes, `worker/run.ts` diffs the polled schedule against the stored snapshot) **and the app side now registers the device** (`src/lib/pushNotifications.ts` upserts the Expo token + class key into `device_tokens`; `src/lib/pushPolicy.ts` holds the unit-tested decision logic). Live delivery needs the owner's EAS project id + FCM/APNs credentials (`docs/OPEN_QUESTIONS.md` #11, #12); without them the app logs a skip reason and runs normally. Notices push dispatch is already shipped (`worker/pushSender.ts`, `.github/workflows/worker-cron.yml`)
- [x] Real provider (`samay.mygbu.in/api.php` with legacy `mygbu.in/schd/api.php` fallback, then mock fallback)
- [x] Class picker driven by the live catalogue — the picker now reads the classes the university actually publishes (`src/features/timetable/classCatalogue.ts`, live list with the bundled `FALLBACK_CATALOGUE` as the offline fallback) and stores the exact published `SectionName`, so the timetable loads the student's own rows. Verified on device: `BCS-II A` returns its real slots (`tools/probe_class_match.ts`, `tools/emulator_class_flow.py`)
- [x] Class alarms with a pickable lead time — every class can be given a reminder 0 / 10 / 15 / 30 / 45 / 60 / 120 minutes before it starts (default 30). The rules live in `src/features/notifications/notificationPreferences.ts` with 24 unit tests, the scheduled list in AsyncStorage, and the OS notification is scheduled per slot. The timetable shows a "Class alarms" card for the selected day
- [x] Real notices in the app — the notices come from the university's own public pages (`src/features/notices/liveNotices.ts`): 245 live notices from `gbu.ac.in` and `exams.gbu.ac.in` with their real dates, categories and PDF links. The bundled sample is only the offline fallback and is labelled as a sample, so it is never passed off as a university notice (`tests/live_notice_mapping.test.ts`)
- [x] Documents open in the app — "View PDF" opens the notice, the academic calendar, the holiday list and the result sheets in the in-app viewer (`src/components/pdf/`), with a hand-off to the phone's own PDF reader as the fallback. The calendar link pointed at `exam.gbu.ac.in`, which does not resolve; the host is `exams.gbu.ac.in`
- [x] The official academic calendar — the 2026-27 calendar read from the examination portal's PDF (`worker/academicCalendar.ts` parses 24 events with their exact dates; `src/features/calendar/officialAcademicCalendar.ts` ships them so the screen is right before the backend is connected). The worker writes them to `calendar_events`. End Sem dates (14-24 Dec 2026) and Lab/Practical dates (30 Nov - 04 Dec) aligned with live examination office order, with interactive phase switcher and dynamic countdowns.
- [x] Official university gazetted holidays — 2026 university vacation list downloaded from `gbu.ac.in` (`List of Vacation-2026.pdf`), verified with Hindi office order 2470 (Diwali, Govardhan Puja, Bhaiya Dooj, Chhath Puja, Guru Nanak Jayanti, Christmas), with direct in-app PDF link.
- [x] Campus Events hub — `/events` fully accessible across the app (linked from Home Quick Hub, Calendar banner, and Profile Academic Hubs) with categorized filter tabs (Fest, Workshop, Cultural, Sports).
- [x] Interactive class alarm action categories — Snooze (+10m) and Dismiss actionable buttons configured via `Notifications.setNotificationCategoryAsync` and handled in `useClassAlarmLifecycle.ts`.
- [x] Expanded authentic PYQ repository — 39 authentic papers across all GBU schools (SOICT, SOBT, SOM, SOE, SOL) with paper details bottom sheet, batch download selection, and reporting.
- [x] The result finder points at the real thing — the per-school result sheets the examination portal publishes and the student's own portal (`gbuexam.in`, which asks for the roll number and the mobile number, so the app links out and never stores them)
- [x] The PYQ upload is never a dead end — a paper handed in without an account or without the cloud is kept on the phone (`src/features/pyq/localUploadQueue.ts`) and goes up when the library is connected
- [x] A long press opens a class in place — the class card expands with its time, room, faculty, attendance buttons and the alarm control, and the back button puts it back the way it was
- [x] The app really fetches — every query seeded itself with `initialData` and a `staleTime`, which made TanStack Query treat the seed as fresh, so the query function never ran and the app only ever showed its bundled sample. The seed is now marked stale from the start (`initialDataUpdatedAt: 0`), so the screen still paints instantly and the real data arrives right after
- [x] The icons draw again — the notice detail, the document viewer and the timetable change card used an icon font that never loaded in a release build, so every one of them was an empty box. They now draw with SVG, like the rest of the app

## Phase 3 — Notices
- [x] Worker: fetch + parse main notices and exams portal, idempotent inserts (Supabase upsert keyed on `source_id`, `.github/workflows/worker-cron.yml` on a 15-minute schedule, soft-404 guard, GBU TLS tolerance, `worker/run.ts` entrypoint)
- [x] Attachment download, OCR for images and scanned PDFs, store raw text (per-file pipeline shipped in `worker/attachmentPipeline.ts`: download once -> content-hash dedupe -> PDF text layer via `worker/pdfText.ts` (incl. `/ToUnicode` CMap decoding for subset fonts) -> OCR for images and scanned PDFs via `worker/ocrRunner.ts` (Tesseract default, vision-model upgrade) -> raw text stored in `notices.raw_text` and shown in the app's notice detail screen; extraction log in `notice_attachments`)
- [x] Notices screen: search, removable chips, virtualized FlatList, detail screen, official portal viewer
- [x] Hero carousel on Home from top notices (with useIsFocused pause)
- [x] Persistent notification preferences in Profile (`@gbu_one_notify_*`)

## Phase 4 — PYQ
- [x] Cloud Storage buckets & backend moderation queue (buckets `pyq-pending/` (private) and `pyq/` (public) with RLS policies, 20 MB PDF/JPG/PNG cap, in `supabase/schema.ts`; upload + approve/reject/report flow in `src/features/pyq/pyqRepository.ts` with the pure rules in `src/features/pyq/pyqStorage.ts`; moderator screen at `app/moderation.tsx`; real browse + upload wired into the PYQ tab with the bundled seed as the offline fallback)
- [x] Browse flow: school → programme code → semester → subject, plus search
- [x] Virtualized 2-column FlatList Grid UI with multi-select and honest cloud sync status
- [x] Upload flow + student moderation disclaimers
- [x] Report button, copyright/takedown note, Trending row
- [x] The Telegram PYQ archive is read, resolved and imported — the git-ignored tooling in `scripts/pyq-import/` turns the student library (45 folders, 162 files) into 39 `pending` rows in `pyq_papers` plus their objects in `pyq-pending`, deriving every field from a catalogue code, a file name or a curated override and recording that provenance on each paper's moderation trail; the plan refuses to guess the 122 files it cannot file, 26 self-tests guard the parsing rules, and a re-run is idempotent. `--apply` has no code path that publishes: a moderator still approves every paper in the app. What it surfaced is listed in `docs/PYQ_IMPORT.md` and `docs/OPEN_QUESTIONS.md` #20
- [ ] The archive's remaining questions answered — 51 files wait on the programme code for a subject the timetable offers to several programmes, 52 on a subject for the 18 folders the catalogue cannot name, 34 on a year or an exam type, and two name matches (`Engineering_Mechanics` → PH111, `Research_Optimization_for_Data_Science` → MDS101) want a second look. Owner action: fill `scripts/pyq-import/import-answers.csv` (per file) or `overrides.json` (per folder) and re-run the importer; tracked as `docs/OPEN_QUESTIONS.md` #20
- [x] Row level security for the whole app surface — the live project had **no policies at all**: `isModerator()` was false for the owner, the queue was always empty, uploads, approvals, push registration and reporting were refused, and an approved paper was invisible even to `anon`. `supabase/schema.ts` now creates `public.is_moderator()` (security definer, so a policy can ask "is this the owner?" without being filtered by the allowlist's own row level security) plus every policy the shipped screens need; `tools/emit-sql.mjs` generates the paste-ready `supabase/schema.sql` and `tests/schema_sql_sync.test.ts` keeps the two in step (`docs/ADMIN_MODERATION.md`, `docs/OPEN_QUESTIONS.md` #21)
- [x] An admin that can actually approve — a real Supabase Auth account with `role = 'owner'` in `public.moderators`, seeded by `scripts/_seed-admin.js`; the login field takes an email address as well as a roll number (`toLoginEmail()`), and the Moderation Queue says *why* it refuses instead of always answering "Moderator access required"
- [x] Approve-all for the owner — a confirmed "Approve all N" clears the imported archive in one pass, while `approveAllPending()` still writes one `pyq_moderation_log` entry per paper
- [x] Results that announce themselves — `src/features/exams/resultsWatch.ts` and `resultAlerts.ts` compare the public per-school result sheet's `Last-Modified`/size on the device (one HEAD per sheet, nothing sent to GBU One) and raise a local `results` notification when it moves; the Exams → Results tab carries the switch and a "Check the portal now" action. The portal's own login stays a link-out, because it is captcha-gated (`docs/OPEN_QUESTIONS.md` #22)

## Phase 5 — Exams, results, deadlines, calendar, events
- [x] Exam hub: date sheet for my programme, revision alerts, countdown, admit card reminder
- [x] Result finder (on-device PDF text search for roll number)
- [x] Deadline tracker with local reminders
- [x] Academic calendar + holidays parsed into virtualized FlatList view with official PDF link
- [x] Manual attendance tracker (local battery card)
- [x] Campus events hub — `app/events.tsx` and `src/features/events/eventsService.ts` for cultural fests, workshops, hackathons, sports, and club meetups with category filtering, search, and SQLite caching

## Phase 6 — Polish, Admin Build, and Release
- [x] Performance pass (cold start, 60Hz Android GPU optimization, elevation cleanup on GlassCard & FloatingTabBar)
- [x] List virtualisation (Notices, PYQ, Mail, Calendar)
- [x] Streamlined 1.7s splash with UI-thread TypeWriter & 512px native splash mark
- [x] Supabase client config (`src/lib/supabase.ts`) + Create Account bottom sheet in login
- [x] Dedicated Admin APK build (`gbu-one-admin.apk`, package `in.gbu.one.admin`) — independent APK installable side-by-side with student app, auto-booting to GBU Admin Console with live events publisher, photo gallery manager, PYQ queue, and version update manager
- [x] Central Compulsory Auto-Update Engine (`MandatoryUpdateModal.tsx` & `versionChecker.ts`) — remote version check with non-dismissible hardware-back-trapped modal overlay for critical releases
- [x] Campus Events Photo Gallery (`app/events.tsx`) — horizontal thumbnail scroller, full-screen image viewer overlay, and live admin publishing
- [x] Open PYQ Access for All 8 Schools — SOICT, SOE, SOBT, SOM, SOL, SOVSAS, SOHSS open download with direct single-tap reader launch
- [x] Supabase Schema & RLS Enhancement — added `campus_events` and `app_versions` with security definer `is_moderator()` policies, synchronized with `supabase/schema.sql` (515 lines)
- [x] Error reporting without PII, privacy policy page, About/disclaimer
- [x] Android release build (EAS / production keystore) — release signing is wired through `plugins/withReleaseSigning.js` (owner keystore from `GBU_ANDROID_*` env vars, debug-key fallback for a fresh clone) and `eas.json` carries the `development` / `preview` / `production` profiles. A signed release APK was built and verified on the emulator (`apksigner` shows the owner DN, not the debug key). Full steps in `docs/RELEASE.md`. Remaining owner work: the upload keystore, the EAS project id (#11) and the FCM/APNs credentials (#12); the 16 KB page-size gap from React Native 0.76 prebuilts is recorded as #13
- [ ] Student survey results reviewed; update priorities — the instrument is ready (`docs/SURVEY.md`: ten concrete questions, each mapped to a decision) but there are no responses yet, so there is nothing to review. Owner action: share it with the class representatives and drop the answers into `docs/qa/survey-responses.csv`. Tracked as `docs/OPEN_QUESTIONS.md` #14

## Later ideas (do not build without owner approval)
Hindi UI, home-screen widgets, faculty directory, hostel/mess notices, incubation links.
