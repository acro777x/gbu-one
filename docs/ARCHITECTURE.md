# Architecture

## Shipped vs declared (reconciled 2026-10-20)
The declared stack below now **matches the shipped stack**:

| Declared | Shipped |
|---|---|
| Expo + TS strict, Expo Router | `app/` + `src/`, typecheck/lint/tests green in CI |
| Zustand | `src/store/*`, `src/features/*`; **attendance + mail now persisted** via `zustand/persist` (MMKV → AsyncStorage fallback) |
| TanStack Query | `@tanstack/react-query` installed; `QueryClientProvider` in `app/_layout.tsx`; `useNoticesQuery` implements cached-then-refresh |
| expo-sqlite + MMKV | `expo-sqlite@15`, `react-native-mmkv@2.12` installed (SDK 52 pinned); `src/lib/db.ts` (notices/timetable/kv caches), `src/lib/storage.ts` (MMKV with AsyncStorage fallback) |
| Supabase | `src/lib/supabase.ts` (app, anon), `worker/supabaseClient.ts` (worker, service-role) |
| FCM push | `worker/pushSender.ts` via Expo Push API (FCM under the hood), deduped per notice |
| Node worker on GitHub Actions cron | `worker/run.ts` + `.github/workflows/worker-cron.yml` (15 min 01:30–16:30 UTC, hourly otherwise) |

Offline-first rule is met for the notices screen (SQLite cache first, Supabase
refresh second, bundled seed only when both are empty). The timetable store
reads SQLite cache first, then the live Samay API, with mock as last resort.

## Overview
```
GBU public sites ──► Worker (GitHub Actions cron, Node/TS)
 (notices, exams,      │  fetch → diff → OCR → classify → write
  academic calendar)   ▼
                  Supabase (Postgres + Storage)  ◄── App (Expo RN)
                       │                                ▲
                       └──► FCM push (expo-notifications)┘
Timetable API (owner's) ◄── adapter, called from worker (public data) or app (credentialed)
```

## Repo layout
```
/app            Expo Router screens
/src
  /components   UI kit (GlassCard, Chip, FloatingTabBar ...)
  /features     notices, timetable, pyq, exams, results, deadlines, calendar, attendance, auth
  /lib          api clients, db, notifications, theme
  /store        Zustand stores
/worker         scraper + diff + classify + push sender
/supabase       migrations, RLS policies, seed
/docs           these specs
```

## Key decisions
- **Offline-first:** SQLite cache of notices, timetable, PYQ metadata; UI reads cache first, then TanStack Query refetches.
- **Worker does the heavy work** (scraping, OCR, classification, diffing) so the app stays light and notifications work when the app is closed.
- **Idempotent worker:** each source item has a stable `source_id` (URL + date hash); reruns never duplicate.
- **OCR:** for image/scanned notices use an OCR step in the worker (Tesseract with English+Hindi data, or a vision model if the owner provides a key via env). Store `raw_text`, `clean_title`, `category`, `confidence`. Keep the original file URL always.
- **Classification:** rules first (keywords: fee, scholarship, date sheet, result, hostel, NCC, back paper, repeat, admit card, mid sem, convocation) then optional LLM fallback behind an env flag. Add unit tests with real notice titles.
- **Deadline threads:** group notices by normalised subject (e.g. "fee submission monsoon 2026-27"); latest date wins; keep history list.
- **Targeting:** each notice gets `audience` tags: school(s), programme(s), semester(s) when detectable, else `all`. Push goes only to matching users.
- **Sheets are drawn inside the screen, not in a native modal window:** a React Native `Modal` does not work in this app on Android. The modal window is created and painted, but its content view is measured without constraints, so the window ends up with no touchable region: the sheet was invisible, every tap fell through to the screen underneath, and the Android back button left the app. All sheets therefore use `src/components/ui/SheetOverlay.tsx`, an absolutely positioned overlay drawn inside the screen, and the floating tab bar steps aside while one is open (`src/store/useSheetStore.ts`). `tools/diagnose_modal.py` measures the dim backdrop, and the back button is handled by the overlay itself.

## Database (Supabase Postgres, RLS on)
- `notices(id, source, source_id, title, clean_title, posted_at, file_url, file_type, raw_text, category, audience jsonb, importance int, deadline_at, thread_id, created_at)`
- `notice_threads(id, key, latest_notice_id, updates_count)`
- `timetable_snapshots(id, class_key, hash, payload jsonb, fetched_at)`
- `timetable_changes(id, class_key, diff jsonb, detected_at)`
- `exam_datesheets(id, school, programme_code, semester, file_url, version, posted_at)`
- `results(id, programme, file_url, posted_at, text_index_url)` (result PDFs; roll number search happens on-device)
- `pyq_papers(id, school, programme_code, semester, subject_code, subject_name, year, exam_type, file_path, uploader_id, status, downloads, created_at)` status: pending / approved / rejected
- `profiles`, `device_tokens`, `notification_prefs`, `saved_notices`, `reports`
- `calendar_events(id, title, date_from, date_to, type, source_url)`

RLS: users read approved PYQs and public tables; write only own rows; moderation via admin role.

## PYQ moderation
Uploads go to Storage `pyq-pending/`; the **owner** (first moderator, `public.moderators.role='owner'`) plus trusted students added to `public.moderators` approve via the Supabase dashboard or admin screen; approved files move to `pyq/`. Adding or removing a moderator is one SQL row — no app release. Virus/size/type checks (PDF/JPG/PNG, max 20MB). Report button on every paper. Show disclaimer on copyright: students upload only papers they are entitled to share; takedown contact in About. (OPEN_QUESTIONS #5 resolved this way on 2026-10-20.)

### PYQ moderation queue (shipped)
- **Buckets** (`supabase/schema.ts`): `pyq-pending` is private and holds uploads until a moderator approves them; `pyq` is public and holds approved papers. Both are capped at 20 MB and accept only PDF/JPG/PNG. Storage RLS lets a signed-in student write into `pyq-pending` under their own prefix, lets a moderator move files between the buckets, and exposes `pyq` for reading.
- **Rules** (`src/features/pyq/pyqStorage.ts`, unit tested): the file type/size check, the metadata check, the storage path (`<bucket>/<school>/<programme>/<semester>/<subject>/<year>-<exam>-<id>.<ext>`, every segment slugified so a field can never escape its folder), the exam-type normalisation and the action-to-status mapping.
- **Flow** (`src/features/pyq/pyqRepository.ts`): the app uploads the file into `pyq-pending`, writes a `pyq_papers` row with `status='pending'`, and removes the file again if the row cannot be written. Approving downloads the pending file, writes it to `pyq/`, and only then flips the status, so a failed move never publishes an unapproved paper. Rejecting deletes the file. Every decision is written to `pyq_moderation_log`.
- **Screen** (`app/moderation.tsx`): moderators see the pending queue and can approve or reject; a student who is not on the allowlist sees an explanation instead. The entry point is in Profile → "PYQ Moderation Queue".
- **App** (`app/(tabs)/pyq.tsx`): the browse list now comes from the backend (the bundled seed stays as the offline fallback), uploads pick a real file with the system document picker, and the report sheet writes to the `reports` table.

## OCR
Worker default is **Tesseract** (offline, free) — `OCR_PROVIDER=tesseract`. Optional vision-model upgrade via `OCR_PROVIDER=vision` + `VISION_API_KEY`. Attachments are content-hash deduped so no file is ever OCR'd twice. (OPEN_QUESTIONS #4 resolved this way on 2026-10-20.)

### Attachment pipeline (shipped)
`worker/attachmentPipeline.ts` runs one pass per notice attachment:
1. **Resolve** the link to an absolute GBU URL (GBU hosts only; other hosts are refused).
2. **Download** once, with the same GBU TLS tolerance as the scraper, capped at 15 MB.
3. **Hash** the bytes (SHA-256). A hash already in `notice_attachments` means the file was handled before and is skipped.
4. **Extract**:
   - A PDF with a text layer is read directly by `worker/pdfText.ts` — a dependency-free parser that walks the object table, reads each page's font resources and decodes subset fonts through their `/ToUnicode` CMap, then pulls the `Tj`/`TJ` text-showing operators. No OCR needed.
   - A PDF with no text layer is *scanned*: its embedded page images are extracted (`extractPdfImages`) and each page is OCR'd.
   - A plain image is OCR'd directly.
5. **Store** the text in `notices.raw_text` (never overwritten once set) and any deadline the document revealed in `notices.deadline_at`. The extraction is logged in `notice_attachments` with the provider, size, scan flag and deadlines.

The app shows the extracted text on the notice detail screen (`app/notice/[id].tsx`) with a "Read full text" expander, so a student can read a scanned circular without leaving the app. The CI runner installs `tesseract-ocr` explicitly (`.github/workflows/worker-cron.yml`).

## Timetable change detection
1. Fetch timetable for each active `class_key` (distinct classes among users) every 30 min during 7:00–20:00, hourly otherwise.
2. Normalise to a canonical JSON (day → slots → subject, faculty, room, start, end).
3. Hash; if changed, compute structured diff (added / removed / moved / room change).
4. Store snapshot + change; push to users of that class_key with a readable message ("Tomorrow: Data Structures moved 10:00→11:00, Room 204").
5. App keeps last snapshot locally for offline.

## Result finder
Worker detects new result PDFs and stores their URL. The app (on device, with the user's consent) downloads the programme's PDF, extracts text, searches for the user's roll number, and shows/notifies locally. The roll number is never sent to the server for this.

## Config
All sources and intervals in `worker/sources.config.ts` so URL/host changes (GBU already moved notices between hosts) need no code changes.

## Testing
Unit tests: parsers, diffing, classification, deadline threading, countdown logic. Fixture files from real notices in `worker/fixtures/`. CI runs typecheck, lint, tests.

On-device QA runs against a real build on the emulator, because a unit test cannot show that a button is reachable or a screen is not clipped:
- `tools/build_android_apk.py` builds the APK from a copy at a space-free path (the native CMake build breaks on a path with a space), signs it with the owner keystore and refuses to hand over a release APK that is signed with the debug key.
- `tools/emulator_qa.py` walks the app (onboarding, class setup, every tab, the notice detail, the upload sheet, the moderation queue) and saves a screenshot per step into `docs/qa/`.
- `tools/audit_touch_targets.py` reads the view hierarchy from the device and reports every tappable node below 44dp, in dp rather than raw pixels.
- `tools/probe_worker_pipeline.ts` and `tools/probe_scanned_ocr.ts` run the real attachment pipeline against `www.gbu.ac.in`, so a change to the parser is checked against the university's actual files and not only against fixtures.

## Observability
Worker logs structured JSON, never logs PII or credentials. A `worker_runs` table records each run (source, status, items found, errors). Alert owner (GitHub issue or email) if a source fails 3 runs in a row.
