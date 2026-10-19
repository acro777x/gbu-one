# Data Sources

Verified in October 2026. Hosts change; keep everything in `worker/sources.config.ts`.

## Public pages (scrape politely)
| Source | URL | Content | Notes |
|---|---|---|---|
| Main notices | `https://test.gbu.ac.in/page/notices` (same page as `https://www.gbu.ac.in/page/notices`) | Table: Date, Title (link). Links look like `/Admissions/DownloadFile?nName=<id>.<ext><filename>` | Newest first, no pagination seen, no categories. Many targets are scanned JPG/JPEG, others PDF. Titles are sometimes useful, filenames are not. **See `GBU_WEB_STRUCTURE.md` for the verified markup, the exact regex, the soft-404 trap, and the `~/` href bug.** |
| Exams portal | `https://exams.gbu.ac.in` | Latest notices (title, posted date, attachment), important links, important dates, contact | Attachments under `/admin/public/uploads/notices/` and `/uploads/notices/`. Some entries are JS-only ("View School-wise Datesheet") — handle or skip with a logged note. |
| Timetables landing | `https://test.gbu.ac.in/academics/timetables` | Links to the timetable system: on campus `http://172.25.5.15`, off campus `http://mygbu.in` | The owner's API comes from this system. |
| Student portal | `https://gbu.samarth.edu.in` | Login required | **Do not scrape.** Link out only. |
| Exam student portal | `https://gbuexam.in/result/login.php` | Login required | **Do not scrape.** Link out only. |
| Academic calendar | `https://exams.gbu.ac.in/uploads/imp_link/Academic Calendar 2026-27.pdf` and `https://test.gbu.ac.in/page/academicCalender` | Calendar PDF | Parse into `calendar_events`. |
| Holidays 2026 | `https://test.gbu.ac.in/Content/gbudata/General/List of Vacation-2026.pdf` | Holiday list | Parse into `calendar_events`. |
| Scholarship | `https://gbu.ac.in/public/scholarship` | Scholarship info | Link out, plus pick up scholarship notices from the main feed. |
| Hostels | `http://hostels.gbu.ac.in/` | Hostel info | Check for a notice list; link out otherwise. |
| Incubation | `https://www.gburif.org/` | Incubation centre | Link out (Explore section). |
| Faculty directory | `https://faculty.gbu.ac.in` | Faculty | Optional, link out. |

## Scraping rules
- Respect robots.txt if present. Only public, unauthenticated pages.
- **Soft-404 check (GBU):** unknown paths return **HTTP 200** with a 38,725-byte "404 - Page not found" page. Treat a body containing `404 - Page not found` (or that exact body length) as a failure, not as data.
- **TLS:** GBU's certificate chain does not verify on some hosts. Bundle the CA — do not disable certificate verification globally.
- Rate: max 1 request per source per run, runs every 15 minutes for notices (every 60 minutes outside 7:00–22:00 IST), 1s delay between files, exponential backoff on errors, honour `Retry-After`.
- User-Agent: `GBUOne-Worker/1.0 (student project; contact: <owner email from env>)`.
- Download attachments once; cache by content hash; never re-OCR the same file.
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
