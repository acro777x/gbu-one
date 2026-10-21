# QA — Academic calendar, exam date sheet and holiday list (real data, no sample)

Research note for the three new worker modules:

- `worker/academicCalendar.ts`
- `worker/examDateSheet.ts`
- `worker/holidayList.ts`

Verified live on **22 October 2026** from a Windows host (Node 24, `undici` with a per-request
insecure dispatcher for `*.gbu.ac.in`, because the university certificate does not validate).
Every number in this note was measured on the real files, not on a fixture.

---

## 1. Sources

| # | Source | URL | Method | State |
|---|---|---|---|---|
| A | Academic calendar 2026-27 (text layer) | `https://exams.gbu.ac.in/uploads/imp_link/Academic%20Calendar%202026-27.pdf` | plain `GET` | 200, 619 847 bytes, 8 312 characters of text |
| A' | Academic calendar 2026-27 (scan) | `https://www.gbu.ac.in/Content/gbudata/General/Academic%20Calendar%202026-27.pdf` | plain `GET` | image only, needs OCR |
| B | Exam date sheet, per school | `https://exams.gbu.ac.in/uploads/datesheet/<code>-end-sem-<mon>-<year>.pdf` | plain `GET` | 7 of 8 schools published for `dec-2025` |
| C | Vacation & holiday list 2026 | `https://www.gbu.ac.in/Content/gbudata/General/List%20of%20Vacation-2026.pdf` | plain `GET` | 200, 687 457 bytes, **0 characters of text**, one 2 479 × 3 506 scan |

**Never use the apex host `https://gbu.ac.in/…`** — see the TLS note in `docs/QA_RESEARCH_NOTICES.md`.

**The December 2026 date sheets do not exist yet.** `dec-2026` answers **HTTP 404** for every
school (and `sovasas` answers 404 for `dec-2025` as well). `fetchDateSheet` reports that as
`ok: false, reason: 'not-published-yet'` — never as an empty but successful sheet.

---

## 2. Academic calendar (source A)

### 2.1 What the PDF really looks like

The document is a covering order (`Office of the Dean Academics`, a recipient list numbered 1–25)
followed by two tables, `MONSOON SEMESTER` (13 rows) and `WINTER SEMESTER` (11 rows).

The extractor returns **one word per line**, and the text carries a **NUL between every
character** (the PDF encodes its glyphs as two byte codes and the shared extractor drops the high
byte). After removing the NULs the text is normal.

### 2.2 Trap 1 — the rows are not printed in row order

The content stream does not emit the table row by row:

- the row numbers are printed out of order (row `8.` is printed **after** row `9.`),
- a date cell can be printed several rows later than the name it belongs to.

So a naive "line by line" regex cannot work. What *is* true:

- the row numbers are in order once they are sorted,
- the date expressions are in row order.

### 2.3 Trap 2 — a range is printed in several ways

All of these occur in the same PDF:

```
Fri, 10th July 2026 - Mon, 20th July 2026     (one range, separator on its own line)
Mon, 27th July 2026- Fri, 31st July 2026       (the dash is glued to the year)
Wed, 05th August 2026 & Thu, 06th August 2026  (two days joined with "&")
Up to Tue, 12tdh January 2027                  (typo for "12th" in the source)
Sat, 12h December 2026                         (typo for "12th" in the source)
Mon. 08th March 2027 Fri. 19th March 2027      (two cells, no separator at all)
```

### 2.4 Trap 3 — the winter block has more dates than rows

`MONSOON SEMESTER` has 13 rows and 13 date expressions. `WINTER SEMESTER` has **11 rows and 13
date expressions**, because two rows carry a range that the university printed over two cells
(mid semester `08 – 19 March 2027` and the summer vacation `08 June – 22 July 2027`).

### 2.5 What the parser does

`parseAcademicCalendarText(text)` works per semester block:

1. split the text into tokens (NULs removed, a weekday glued to the previous word is split off),
2. find the numbered rows and the date expressions separately,
3. pair them. When the counts match, the two sequences are zipped. When they do not, the best
   monotone split is searched for (dynamic programming) and scored by how far it moves a date away
   from the row it was printed next to — that is what puts `08 – 19 March` on the mid semester row
   and not on the lab row.

The covering order (everything before the first `MONSOON SEMESTER`) is ignored: it is a list of
recipients, not academic events.

### 2.6 Measured result on the real PDF

```
events: 24   (13 monsoon + 11 winter)   with a date: 24/24
```

Every value matches the reference list of the university calendar:

| Row | Parsed | University |
|---|---|---|
| Monsoon · Fee submission | 2026-07-10 → 2026-07-20 | 10-20 Jul 2026 |
| Monsoon · Reporting & registration | 2026-07-27 → 2026-07-31 | 27-31 Jul 2026 |
| Monsoon · Classes (2nd year+) | 2026-08-03 | 03 Aug 2026 |
| Monsoon · Reporting (1st year) | 2026-08-05 → 2026-08-06 | 05-06 Aug 2026 |
| Monsoon · Induction | 2026-08-07 | 07 Aug 2026 |
| Monsoon · Classes (1st year) | 2026-08-10 | (not in the reference list) |
| Monsoon · Mid semester | 2026-10-07 → 2026-10-16 | 07-16 Oct 2026 |
| Monsoon · Lab / practical | 2026-11-30 → 2026-12-04 | 30 Nov-04 Dec 2026 |
| Monsoon · Back paper | 2026-12-07 → 2026-12-12 | 07-12 Dec 2026 |
| Monsoon · End semester | 2026-12-14 → 2026-12-24 | 14-24 Dec 2026 |
| Monsoon · Answer books due | 2027-01-12 | 12 Jan 2027 |
| Monsoon · Winter vacation | 2026-12-25 → 2027-01-05 | 25 Dec 2026-05 Jan 2027 |
| Monsoon · Results | 2027-01-25 | 25 Jan 2027 |
| Winter · Fee submission | 2026-12-26 → 2027-01-05 | 26 Dec 2026-05 Jan 2027 |
| Winter · Reporting & registration | 2027-01-09 | 09 Jan 2027 |
| Winter · Classes | 2027-01-11 | 11 Jan 2027 |
| Winter · Mid semester | 2027-03-08 → 2027-03-19 | 08-19 Mar 2027 |
| Winter · Lab / practical | 2027-04-26 → 2027-04-30 | 26-30 Apr 2027 |
| Winter · Back paper | 2027-05-03 → 2027-05-08 | 03-08 May 2027 |
| Winter · End semester | 2027-05-10 → 2027-05-22 | 10-22 May 2027 |
| Winter · Back paper answer books | 2027-05-19 (up to) | (not in the reference list) |
| Winter · End term answer books | 2027-06-07 (up to) | (not in the reference list) |
| Winter · Results | 2027-06-20 → 2027-06-30 | 20-30 Jun 2027 |
| Winter · Summer vacation | 2027-06-08 → 2027-07-22 | (not in the reference list) |

---

## 3. Exam date sheet (source B)

### 3.1 What the PDF really looks like

The grid is: `[Programme Name Batch/Semester] [Date & Time] [08-12-2025] [09-12-2025] …`.

Each row is one programme. The `Date & Time` column prints the slot (`Morning 9.30am-12.30pm` /
`Evening 2.00pm-5.00pm`), and every date column holds the papers of that programme on that date.

### 3.2 Trap 1 — the plain text cannot rebuild the grid

The shared extractor returns the cells of one programme one after the other, **in date order, but
without saying which date column a cell came from**. A programme with papers on 08, 10, 13, 16,
22 and 24 December looks exactly like one with papers on 08, 09, 10, 11, 12 and 13 December.
Measured on `soe-end-sem-dec-2025.pdf`, the first programme of the Architecture table has six
morning papers on **08, 10, 13, 16, 22 and 24 December** — the plain text cannot tell that apart
from a continuous run.

**The grid therefore needs the position of every cell, and `worker/pdfText.ts` does not expose
positions.** `worker/examDateSheet.ts` therefore adds a small layout pass that

- reuses `parseToUnicode` from `worker/pdfText.ts` for the font decoding (no second PDF text
  extractor, no new dependency),
- keeps the position of every piece of text while walking the content stream,
- and rebuilds the grid from the geometry: the date column of a cell is the closest date header,
  the slot of a cell is the marker it was printed after, the programme is the programme column
  entry closest to that marker.

`parseDateSheetText(text, schoolCode)` is the pure function on top of it. It reads the grid text
(`programme | slot | date | subject`) and falls back to the plain text of the PDF, where the dates
can only be matched positionally — that fallback is documented as approximate and is only used
when the layout pass finds nothing.

### 3.3 Trap 2 — the sheets are not the same file

Every school prints its own sheet with its own tool, so the layout differs:

| School | Layout pass | Slots | Programmes | Notes |
|---|---|---|---|---|
| `soe` (Engineering) | ok | 299 | 299 | 4 pages, 93 back/repeat papers |
| `sohss` (Home Science) | ok | 296 | 296 | 3 pages |
| `som` (Management) | ok | 127 | 127 | |
| `soljg` (Law) | ok | 42 | 42 | |
| `sobsc` (Buddhist Studies) | ok | 29 | 29 | every cell sits on the **evening** band |
| `sobt` (Biotechnology) | **no grid** | 0 | – | all 14 dates are printed on **one line**, so the column geometry is missing |
| `soict` (ICT) | **no text** | 0 | – | the text layer is not decodable (58 046 characters of garbage) |
| `sovasas` | – | – | – | 404 for `dec-2025` |

* **`sobt`** — the header prints `08-12-2025 09-12-2025 …` as one single text run, so there is no
  x position per date column. The plain-text fallback still returns **88 slots** with approximate
  dates, but the programme names are unreliable.
* **`soict`** — `extractPdfText` returns 58 046 characters of mojibake, so the sheet has no usable
  text layer at all. Nothing can be read from it; the module returns `ok: false` rather than
  guessing.

### 3.4 Live check

```
fetchDateSheet('soe', { month: 'dec', year: 2025 })
  → ok: true, 299 slots, https://exams.gbu.ac.in/uploads/datesheet/soe-end-sem-dec-2025.pdf
fetchDateSheet('sovasas', { month: 'dec', year: 2026 })
  → ok: false, slots: 0, reason: 'not-published-yet'
```

---

## 4. Holiday list (source C)

### 4.1 What the PDF really looks like

One scanned page, **2 479 × 3 506 pixels**, **0 characters of text**. The page holds four tables:

| Table | Rows | Content |
|---|---|---|
| संपत्ति कर | 24 | property tax |
| विविध अवकाश | 31 | miscellaneous |
| जयंती / अंतिम ईद | 1 | |
| दृश्य अवकाश | 2 | for teaching staff |

Columns: serial number, festival name, number of days, date range from–to, day of the week.

**The whole list is in Devanagari and there is no English version of it anywhere on the site.**

### 4.2 Trap — the shared OCR runner cannot read Devanagari

`worker/ocrRunner.ts` calls `tesseract <file> stdout` **without a language argument**, so Tesseract
uses its default model (English). It cannot read Devanagari at all.

`worker/holidayList.ts` therefore asks Tesseract for `-l hin+eng` and falls back to the shared
runner when the Hindi language data is not installed. Everything else (the temporary file, the
timeout, the cleanup) follows the style of `worker/ocrRunner.ts`.

### 4.3 What the module does when OCR is not possible

The module never invents a date. It returns

```
{ holidays: [], ok: false, method: 'unavailable', reason: 'ocr-unavailable' }
```

and the reasons are explicit: `ocr-unavailable` (no Tesseract), `ocr-returned-no-text` (Tesseract
ran but read nothing), `no-holidays-in-ocr-text` (the recognised text holds no readable row),
`no-page-images`, `http-<status>`.

### 4.4 Measured result on the real PDF

**The OCR path could not be executed on this host: Tesseract is not installed** (`tesseract` is not
on `PATH`), and the runner image of the GitHub Action has no `hin.traineddata` either. What was
verified on the real file:

- the PDF downloads (200, 687 457 bytes),
- `extractPdfImages` finds exactly **one** page image (a 686 425 byte JPEG),
- `fetchHolidays2026()` returns `ok: false, method: 'unavailable', reason: 'ocr-unavailable'` — the
  honest failure, with no fabricated holiday.

The parser itself is tested against a Devanagari fixture (`tests/worker_calendar.test.ts`): it
reads `15/08/2026 - 16/08/2026` as a range, `03/03/2026` as a single day, `26-01-2026` in the
other separator form, and pulls the weekday out of `शनिवार` / `मंगलवार` / `सोमवार`.

---

## 5. What the owner may want to change

1. **Install the OCR data in the runner image.** The GitHub Action needs
   `tesseract-ocr` **and** `tesseract-ocr-hin` (`hin.traineddata`). Without them the holiday list
   stays unavailable; with them the module reads the scanned page as it stands.
2. **`worker/pdfText.ts` could expose positions.** `extractPdfText` returns plain text only. A
   `extractPdfTextWithPositions` (text + x/y per piece) would let `worker/examDateSheet.ts` drop
   its own layout pass (~250 lines) and would also fix `sobt`, whose dates are printed on one
   line. This is the only blocker that stops the date sheet from being complete for all schools.
3. **`soict` needs a different reader.** Its text layer cannot be decoded with the current
   `/ToUnicode` handling; OCR of the rendered pages would be the fallback.
4. **`sobsc` reports every paper as `evening`.** The cells of that sheet are drawn on the evening
   band of the row (the morning band is empty for those programmes), so that is what the geometry
   says. Worth a look against the printed sheet before the app shows it to students.

---

## 6. Exported API

```ts
// worker/academicCalendar.ts
export interface AcademicEvent { name: string; startDate?: string; endDate?: string;
                                  semester: 'monsoon' | 'winter' | 'unknown'; }
export interface AcademicCalendarResult { events: AcademicEvent[]; source: string; ok: boolean; reason?: string; }
export interface AcademicCalendarOptions { url?: string; fallbackUrl?: string; timeoutMs?: number;
                                           fetchImpl?: …; ocr?: …; }
export const ACADEMIC_CALENDAR_URL: string;
export const ACADEMIC_CALENDAR_FALLBACK_URL: string;
export function parseAcademicCalendarText(text: string): AcademicEvent[];
export function fetchAcademicCalendar(options?: AcademicCalendarOptions): Promise<AcademicCalendarResult>;

// worker/examDateSheet.ts
export interface DateSheetSlot { schoolCode: string; programme: string; date: string;
                                 slot: 'morning' | 'evening'; subjectCode?: string;
                                 subjectName: string; isBackPaper: boolean; }
export interface DateSheetResult { slots: DateSheetSlot[]; ok: boolean; url: string; reason?: string; }
export interface DateSheetOptions { month?: string; year?: number; timeoutMs?: number; fetchImpl?: …; }
export type DateSheetSchoolCode = 'sobsc' | 'sobt' | 'soe' | 'sohss' | 'soict' | 'soljg' | 'som' | 'sovasas';
export const DATE_SHEET_SCHOOL_CODES: readonly DateSheetSchoolCode[];
export const DATE_SHEET_BASE_URL: string;
export function buildDateSheetUrl(schoolCode: string, month: string, year: number): string;
export function parseDateSheetText(text: string, schoolCode: string): DateSheetSlot[];
export function splitSubjects(cellText: string): Array<{ subjectCode?: string; subjectName: string; isBackPaper: boolean }>;
export function extractPdfLayout(buffer: Buffer, options?: { fallbackOnly?: boolean }): Array<Array<{ x: number; y: number; text: string }>>;
export function parseDateSheetLayout(buffer: Buffer, schoolCode: string): DateSheetSlot[];
export function fetchDateSheet(schoolCode: string, options?: DateSheetOptions): Promise<DateSheetResult>;

// worker/holidayList.ts
export interface Holiday { name: string; startDate?: string; endDate?: string; dayOfWeek?: string; }
export interface HolidayListResult { holidays: Holiday[]; ok: boolean; reason?: string; method: 'ocr' | 'unavailable'; }
export interface HolidayListOptions { url?: string; timeoutMs?: number; fetchImpl?: …; ocr?: …; languages?: string; }
export const HOLIDAY_LIST_2026_URL: string;
export function parseHolidayTableText(text: string): Holiday[];
export function fetchHolidays2026(options?: HolidayListOptions): Promise<HolidayListResult>;
```

---

## 7. Reproducing this note

```powershell
# the calendar
curl.exe -sSL -k -o calendar.pdf "https://exams.gbu.ac.in/uploads/imp_link/Academic%20Calendar%202026-27.pdf"

# a date sheet
curl.exe -sSL -k -o soe.pdf "https://exams.gbu.ac.in/uploads/datesheet/soe-end-sem-dec-2025.pdf"

# the holiday list (a scan, 0 characters of text)
curl.exe -sSL -k -o holidays.pdf "https://www.gbu.ac.in/Content/gbudata/General/List%20of%20Vacation-2026.pdf"
```

`worker/pdfText.ts` reads all three; the unit tests live in `tests/worker_calendar.test.ts`
(15 tests, no network, no OCR).
