# Data Sources

Verified in October 2026; TLS and host status re-verified live on **2026-10-21**. Hosts change; keep everything in `worker/sources.config.ts`.

## Public pages (scrape politely)
| Source | URL | Content | Notes |
|---|---|---|---|
| Main notices | `https://test.gbu.ac.in/page/notices` (byte-identical mirror of `https://www.gbu.ac.in/page/notices`, verified 2026-10-21) | Table: Date, Title (link). Links look like `/Admissions/DownloadFile?nName=<id>.<ext><filename>` | Newest first, no pagination seen, no categories. Many targets are scanned JPG/JPEG, others PDF. Titles are sometimes useful, filenames are not. **See `GBU_WEB_STRUCTURE.md` for the verified markup, the exact regex, the soft-404 trap, and the `~/` href bug.** |
| Exams portal | `https://exams.gbu.ac.in` | Latest notices (title, posted date, attachment), important links, important dates, contact | Attachments under `/admin/public/uploads/notices/` and `/uploads/notices/`. Some entries are JS-only ("View School-wise Datesheet") — handle or skip with a logged note. |
| Timetables landing | `https://test.gbu.ac.in/academics/timetables` | Links to the timetable system: on campus `http://172.25.5.15`, off campus `http://mygbu.in` | The owner's API comes from this system. |
| Student portal | `https://gbu.samarth.edu.in` | Login required | **Do not scrape.** Link out only. |
| Exam student portal | `https://gbuexam.in/result/login.php` | Login required (roll number + password + **captcha**) | **Do not scrape.** Link out only. An automated sign-in would mean defeating the captcha, so the app never collects these credentials (OPEN_QUESTIONS #22). The public result sheets above are what it can watch: `src/features/exams/resultsWatch.ts` compares each sheet's `Last-Modified`/size and raises a local alert when it moves. |
| Academic calendar | `https://exams.gbu.ac.in/uploads/imp_link/Academic Calendar 2026-27.pdf` and `https://test.gbu.ac.in/page/academicCalender` | Calendar PDF | Parse into `calendar_events`. |
| Holidays 2026 | `https://test.gbu.ac.in/Content/gbudata/General/List of Vacation-2026.pdf` | Holiday list | Parse into `calendar_events`. |
| Scholarship | `https://gbu.ac.in/public/scholarship` | Scholarship info | Link out, plus pick up scholarship notices from the main feed. **Bare apex** — its certificate does not match the name, so it only loads through the worker's tolerant TLS path. |
| Hostels | `http://hostels.gbu.ac.in/` | Hostel info | Check for a notice list; link out otherwise. |
| Incubation | `https://www.gburif.org/` | Incubation centre | Link out (Explore section). |
| Faculty directory | `https://faculty.gbu.ac.in` | Faculty | Optional, link out. |
| End-semester date sheet | `https://exams.gbu.ac.in/uploads/datesheet/<code>-end-sem-<mon>-<yr>.pdf` | One PDF per school (`sobsc`, `sobt`, `soe`, `sohss`, `soict`, `soljg`, `som`, `sovasas`) | The portal publishes a copy with a **text layer**, so the grid can be rebuilt (`worker/examDateSheet.ts`). The combined 34-page scan under `/admin/public/uploads/notices/` is image-only, so do not use it. The set for the running session is published towards the end of the semester; a 404 is reported, never filled with the old sheet. |
| Result sheets | `https://exams.gbu.ac.in/uploads/results/<code>.pdf` and `/uploads/results/passout/p<code>.pdf` | The published marks, one scan per school | Image-only scans (9-15 MB), so the app opens them in the PDF viewer and the student reads their own row. The sheets keep their URL and are overwritten each session, so a *new* result shows up as a moved `Last-Modified`/size: that is what `src/features/exams/resultsWatch.ts` watches and alerts on (one HEAD per sheet, on the device only). The personal result and the admit card live behind `gbuexam.in/result/login.php` (roll number + password + captcha) — link out, never scrape. |
| Admit card notice | `https://exams.gbu.ac.in/admin/public/uploads/notices/Admit Cards.pdf` | The notice announcing the admit cards | A notice about the cards, not the cards themselves. |
| Incubation announcements | `https://gburif.org/announcements.php` | The incubation centre's own notices | 15 items, none of them academic. Link out. |

### Read directly by the app
The app reads the two public notice pages itself when the backend is not
connected, so the student sees real notices without any account:
`src/features/notices/liveNotices.ts` fetches `https://www.gbu.ac.in/page/notices`
and `https://exams.gbu.ac.in/`, parses them, and never throws — a failing
source is reported and the other one still comes through. The bundled sample
is only the offline fallback and is labelled as a sample in the app.

## Host status (verified live 2026-10-21)
| Host | Result |
|---|---|
| `www.gbu.ac.in` | 200. Certificate **validates cleanly**: leaf `CN=*.gbu.ac.in`, SAN `DNS:*.gbu.ac.in`, issued by `SSL.com TLS Issuing RSA CA R1` (O = SSL Corporation), valid **21 Oct 2026 → 19 Jan 2027**. Strict validation passes — there is **no** `CERT_HAS_EXPIRED` here. |
| `test.gbu.ac.in` | 200. **Byte-identical mirror of `www.gbu.ac.in`**: `/page/notices` returned the same 147,326 bytes and the same SHA-256 (`b6b9a6970e04aad27a694b07f9444f1a933b60c84ad0bd8d4a9e0a3e05073ef8`) on both hosts. Either URL may be used. |
| `gbu.ac.in` (bare apex) | TLS **name mismatch** — *not* an expiry. The wildcard `*.gbu.ac.in` does not cover the apex `gbu.ac.in`, so the client rejects the peer name: `SEC_E_WRONG_PRINCIPAL` on Windows SChannel, `ERR_TLS_CERT_ALTNAME_INVALID` in Node/OpenSSL. Always use a subdomain (`www.`, `test.`, `exams.`, `ohms.`, `digiforms.`), never the bare apex. |
| `exams.gbu.ac.in` | 200. Let's Encrypt, valid to 15 Dec 2026. |
| `ohms.gbu.ac.in` | TLS **expired** (`CERT_HAS_EXPIRED`). Only reachable through the worker's tolerant undici agent. |
| `digiforms.gbu.ac.in` | TLS **expired** (`CERT_HAS_EXPIRED`). Same. These two are the only hosts that need the tolerant path. |
| `mygbu.in/schd/api.php` | 200, timetable JSON (3,182,982 bytes). |
| `samay.mygbu.in/api.php` | 200, the same timetable dataset (3,180,079 bytes — not byte-identical, same rows and columns). Both live copies work; keep both URLs configured as primary/fallback. |

## Scraping rules
- Respect robots.txt if present. Only public, unauthenticated pages.
- **Soft-404 check (GBU):** unknown paths return **HTTP 200** with a 38,725-byte "404 - Page not found" page. Treat a body containing `404 - Page not found` (or that exact body length) as a failure, not as data. Implemented as `isSoft404()` in `worker/noticesJob.ts` and tested.
- **TLS:** re-verified live **2026-10-21** —
  - `www.gbu.ac.in` and `test.gbu.ac.in` **validate cleanly** (wildcard `*.gbu.ac.in`, valid until 19 Jan 2027). They do **not** fail with `CERT_HAS_EXPIRED`.
  - The host that still fails is the **bare apex `gbu.ac.in`**, and it fails for a different reason: a **name mismatch** (`SEC_E_WRONG_PRINCIPAL` / `ERR_TLS_CERT_ALTNAME_INVALID`), because the wildcard certificate does not cover the apex domain. Use `www.gbu.ac.in` where a subdomain exists. The worker's host regex (`/(^|\.)gbu\.ac\.in$|mygbu\.in$/i`) does match the apex, so the tolerant agent still fetches it — a strict client would not.
  - The two hosts whose certificates really are expired are **`ohms.gbu.ac.in`** and **`digiforms.gbu.ac.in`** (`CERT_HAS_EXPIRED`).
  - The worker uses `fetchWithTlsTolerance()` (undici `Agent({ connect: { rejectUnauthorized: false } })`) **scoped only to `*.gbu.ac.in` / `mygbu.in` hosts**, with plain fetch as fallback. That fallback is a silent data-loss trap: undici declares `engines.node >= 22.19.0` and **fails to load on Node 20**, so the `require` throws, the catch falls back to plain fetch, and both expired-cert hosts then fail with `CERT_HAS_EXPIRED` on every single run. **The worker must therefore run on Node >= 22.19.0** — that is why `.github/workflows/worker-cron.yml` pins Node 22.19.0. Never set `NODE_TLS_REJECT_UNAUTHORIZED=0` globally in production.
- Rate: max 1 request per source per run. The cron fires **every 15 minutes from 01:30 to 16:30 UTC (07:00-22:00 IST)** and **hourly at :30 past the hour from 17:30 to 00:30 UTC (23:00-06:00 IST)** — 69 runs/day, all on the `:00/:15/:30/:45` grid, with no drift and no unscheduled hole. GitHub Actions cron is UTC-only (no timezone field), so the IST window is expressed in UTC. 1s delay between files, exponential backoff on errors, honour `Retry-After`.
- User-Agent: `GBUOne-Worker/1.0 (student project; contact: student.gbuone@gmail.com)` — **hard-coded** in `worker/sources.config.ts` (`WORKER_CONFIG.userAgent`) and in the attachment download headers in `worker/run.ts`. There is no environment override: `WORKER_CONTACT_EMAIL` is read nowhere in `worker/` and must not be passed to the worker.
- Download attachments once; cache by content hash; never re-OCR the same file (`worker/ocrService.ts` `hashContent`/`markProcessed`).
- If a page layout changes and parsing returns 0 items, do **not** overwrite stored data; log failure and alert.

## Normalised notice shape
```ts
type Notice = {
  source: 'main' | 'exams' | 'hostel' | 'other';
  sourceId: string;          // stable hash of url + date
  title: string;             // as published
  postedAt: string;          // ISO, IST
  fileUrl: string;
  fileType: 'pdf' | 'image' | 'html';
};
```
Enrichment adds: `rawText`, `cleanTitle`, `category`, `audience`, `importance`, `deadlineAt`, `threadKey`.

## Categories
`exam`, `datesheet`, `result`, `fees`, `scholarship`, `hostel`, `admission`, `event`, `academic`, `placement`, `other`. Non-student notices (tenders, recruitment, EOI, PhD notifications, procurement) → `other` with low importance and hidden from "For me" by default.

## Timetable adapter (owner's API — details not yet provided)
```ts
interface TimetableProvider {
  listClasses(): Promise<ClassRef[]>;           // school, programme, semester, section
  getTimetable(classKey: string): Promise<Timetable>;
}
type Slot = { day: 0|1|2|3|4|5|6; start: string; end: string; subject: string; faculty?: string; room?: string; type?: 'lecture'|'lab'|'tutorial' };
type Timetable = { classKey: string; fetchedAt: string; slots: Slot[] };
```
- Implement `MockTimetableProvider` first with realistic data.
- Real provider reads `TIMETABLE_API_BASE_URL` and `TIMETABLE_API_KEY` from `.env`. **Ask the owner** for endpoint format, auth, and rate limits; record in `OPEN_QUESTIONS.md`.
- If the API needs student credentials, call it **from the device only** (see `SCREENS_AUTH.md`). If it is public per class, the worker can poll it for change detection.

## PYQ
No official source found. Crowdsourced only (see `ARCHITECTURE.md`). Optional later: link to GBU library resources if a public page exists.

## Result PDFs
Posted as per-programme or per-school PDFs on the notices pages. Worker records URL; matching happens on-device.

## Legal and ethics
Official app (university approval and API access to be arranged before release). Show source and date on every item with a link to the original. Do not alter official documents. Do not scrape login-protected systems.
