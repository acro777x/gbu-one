# QA — Live GBU notices (real data, no sample)

Research note for `src/features/notices/liveNotices.ts`.
Verified live on **21–22 October 2026** from a Windows host (PowerShell + `curl.exe` 8.x, Node 24).

The notices screen used to render the bundled `MOCK_NOTICES` sample because no Supabase
project is configured. This note documents the two public pages the app now reads directly
from the device, the exact HTML they serve today, and the traps that will silently break the
parser if the pages change.

---

## 1. Sources

| # | Source | URL | Method |
|---|---|---|---|
| A | Main university notices | `https://www.gbu.ac.in/page/notices` | plain `GET`, no cookies, no login, no anti-bot, server-rendered HTML, no pagination |
| B | Examination portal | `https://exams.gbu.ac.in/` | plain `GET`, static HTML, no API |

Mirror: `https://test.gbu.ac.in/page/notices` is byte-identical to source A and is used as an
automatic fallback when `www` is unreachable.

**Never use the apex host `https://gbu.ac.in/…`** — see the TLS trap in §5.

---

## 2. Exact HTML shape

### Source A — `https://www.gbu.ac.in/page/notices`

One single `<table>` for the whole document:

```html
<table class="table table-condensed table-striped">
  <tr>
    <th style="width:150px">Date</th>
    <th>Title</th>
  </tr>
  <tr>
    <td>21 Oct 2026</td>
    <td><a href="/Admissions/DownloadFile?nName=-1071752_8ba41d50.pdfNew%20Township%20Project.pdf"
           target="_blank">Expression of Interest in the SIA Project</a></td>
  </tr>
  ...
</table>
```

* Date cell: `DD Mon YYYY` (`21 Oct 2026`). Month is a 3-letter English abbreviation.
* Title cell: contains exactly one `<a>` whose text **is** the notice title.
* Attachment href is always root-relative: `/Admissions/DownloadFile?nName=…`.
  The `nName=` value is **already percent-encoded** in the page (`%20` for spaces) and must be
  used verbatim — re-encoding it produces `%2520` and the download breaks.
* `Content-Type` of an attachment is `application/pdf` for most notices but `image/jpeg` for
  scanned notices, so the app must not assume PDF.

### Source B — `https://exams.gbu.ac.in/`

```html
<div class="notice-item border-bottom pb-3 mb-3">
  <div class="d-flex justify-content-between align-items-start gap-2">
    <div class="flex-grow-1">
      <h6 class="mb-1 text-dark">Special back passout and not promoted Revised Result</h6>
      <p class="small text-muted mb-2">Posted on: 07-10-2026</p>
      <a href="/admin/public/uploads/notices/Revise.pdf" target="_blank"
         class="text-primary text-decoration-none">View Attachment</a>
    </div>
    <span class="badge bg-danger flex-shrink-0">New</span>
  </div>
</div>
```

* Date: `Posted on: DD-MM-YYYY`, but the month may be **one digit** (`Posted on: 01-7-2026`).
* Two attachment roots are in use:
  * `/admin/public/uploads/notices/…` — current notices (28 of 31 today)
  * `uploads/notices/…` — older notices, **without** a leading slash (3 of 31 today);
    resolved against `https://exams.gbu.ac.in` this becomes
    `https://exams.gbu.ac.in/uploads/notices/…`.
* Some older hrefs contain a **raw space** (`…/noticeAcademicSession 2025-26.pdf`). The parser
  encodes spaces in the path to `%20` and leaves the query string untouched.
* `New` badge: `<span class="badge bg-danger">` — 6 on the page today.
* One important notice has **no file**: *“Datesheet for End Semester Examination – December 2025”*
  links to `javascript:void(0)` with `onclick="loadDateSheetModal()"`. Its PDFs are only listed
  in the inline script at the bottom of the page, as
  `uploads/datesheet/<code>-end-sem-dec-2025.pdf` for the codes
  `soict, soe, sobt, sohss, som, soljg, sovasas, sobsc`.
  `parseDateSheetModalLinks()` recovers that mapping as a documented **fallback**; the body
  `<div id="commonNoticeModal">` is empty (`<!-- Dynamic content will load here -->`), so the
  script is the only source.

---

## 3. Counts observed (2026-10-22)

| Page | HTTP | Bytes | Rows |
|---|---|---|---|
| A `www.gbu.ac.in/page/notices` | 200 | 147 326 | 1 `<table>`, 1 `<tr>` header (`Date`/`Title`) + **214 data rows**, 428 `<td>`, 2 `<th>` — all 214 data rows carry an attachment |
| B `exams.gbu.ac.in/` | 200 | 62 195 | **31** `div.notice-item` = **11 visible** + **20 inside `<div id="allNotices" style="display:none;">`**, 31 `<h6 class="mb-1 text-dark">`, 31 `Posted on:`, 6 `New` badges, 8 date-sheet PDFs in the inline script |

All 31 exam notices are present in the raw HTML, so **no JavaScript execution is required** to
read them — only the school-wise date-sheet mapping lives in a script.

Parsing the live pages today yields **245 notices** (214 + 31), every attachment URL absolute
(`https://www.gbu.ac.in/…` or `https://exams.gbu.ac.in/…`), zero double-encoded query values.

**The exam page is not strictly date-sorted**: `01-12-2025` appears *before* `05-12-2025`.
Both parsers therefore sort newest-first themselves; do not rely on document order.

---

## 4. The `DownloadFile` trap (HTTP 500 + HTML error page)

`/Admissions/DownloadFile` is a thin wrapper around the stored file. If the query is not exactly
as published it answers **HTTP 500 with an HTML error page**, not a PDF:

```
GET https://www.gbu.ac.in/Admissions/DownloadFile                        -> 500
GET https://www.gbu.ac.in/Admissions/DownloadFile?nName=                 -> 500
GET https://www.gbu.ac.in/Admissions/DownloadFile?nName=<valid>&x=1      -> 500
GET https://www.gbu.ac.in/Admissions/DownloadFile?nName=<as published>   -> 200, application/pdf
```

Consequences for the app:

* Copy the `href` **verbatim**. Never re-encode it, never trim it, never append or drop query
  parameters, never rebuild it from the file name.
* Never probe `DownloadFile` with a guessed file name; a wrong guess yields a 500 page that the
  user would see as a broken PDF.
* A 500 from `DownloadFile` is a server-side error, not a missing notice. Keep the notice in the
  list and let the user open the original page instead.

---

## 5. The TLS trap (apex vs. `www`)

`www.gbu.ac.in`, `test.gbu.ac.in` and the apex `gbu.ac.in` all serve the **same** certificate:

```
Subject: CN=*.gbu.ac.in          SAN: DNS Name=*.gbu.ac.in
Issuer : CN=SSL.com TLS Issuing RSA CA R1
Valid  : 2026-10-21 -> 2027-01-19
```

A wildcard `*.gbu.ac.in` does **not** cover the apex `gbu.ac.in`, so hostname validation fails
there:

```
$ curl.exe -sS https://gbu.ac.in/page/notices
curl: (60) schannel: SNI or certificate check failed: SEC_E_WRONG_PRINCIPAL (0x80090322)
        - The target principal name is incorrect.
```

**Rule: always use `https://www.gbu.ac.in` (or `https://test.gbu.ac.in`). Never the apex.**
The apex is also the host used by the old `MOCK_NOTICES` `fileUrl` values, so any leftover link
that points at `gbu.ac.in` will fail to open in the app.

Update to `docs/DATA_SOURCES.md`: the note that `www.gbu.ac.in` fails with `CERT_HAS_EXPIRED`
was true on 2026-10-20 but the certificate was **renewed on 2026-10-21**, so strict validation
now succeeds. The `test.gbu.ac.in` fallback is still kept in `fetchLiveNotices()` because the
host has gone down before.

### Bonus trap — GBU soft-404

Unknown paths answer **HTTP 200** with a 38 725-byte body containing `404 - Page not found`
(verified: `https://www.gbu.ac.in/page/thispagedoesnotexist`). `fetchLiveNotices()` treats that
body as a failure instead of data, otherwise a renamed page would silently produce zero notices.

---

## 6. Re-verifying

### 6.1 Fetch both pages (the exact commands that work)

```bash
# Windows (curl.exe is in System32)
curl.exe -sS --max-time 30 -A "GBUOne-Research/1.0" -o notices.html \
  -w "http=%{http_code} bytes=%{size_download}\n" "https://www.gbu.ac.in/page/notices"

curl.exe -sS --max-time 30 -A "GBUOne-Research/1.0" -o exams.html \
  -w "http=%{http_code} bytes=%{size_download}\n" "https://exams.gbu.ac.in/"

# macOS / Linux
curl -sS --max-time 30 -A "GBUOne-Research/1.0" -o notices.html "https://www.gbu.ac.in/page/notices"
curl -sS --max-time 30 -A "GBUOne-Research/1.0" -o exams.html   "https://exams.gbu.ac.in/"
```

Expected today: `http=200 bytes=147326` and `http=200 bytes=62195`.
The apex must fail: `curl.exe -sS https://gbu.ac.in/page/notices` → `curl: (60) … SEC_E_WRONG_PRINCIPAL`.

### 6.2 Count the rows without parsing

```bash
grep -o '<tr' notices.html | wc -l          # 215  (1 header + 214 data rows)
grep -o 'notice-item' exams.html | wc -l    # 31   (11 visible + 20 hidden)
grep -o 'uploads/datesheet/' exams.html | wc -l   # 8  (school-wise date sheets)
```

PowerShell equivalent:

```powershell
(Select-String -Path notices.html -AllMatches '<tr').Matches.Count            # 215
(Select-String -Path exams.html  -AllMatches 'notice-item').Matches.Count     # 31
(Select-String -Path exams.html  -AllMatches 'uploads/datesheet/').Matches.Count  # 8
```

### 6.3 Run the parsers against the fresh files

```bash
npx tsc src/features/notices/liveNotices.ts --outDir /tmp/gnc \
  --module commonjs --target es2020 --lib es2020,dom --skipLibCheck --strict

node -e '
const fs=require("fs"), m=require("/tmp/gnc/liveNotices.js");
const a=m.parseMainNoticesHtml(fs.readFileSync("notices.html","utf8"));
const b=m.parseExamNoticesHtml(fs.readFileSync("exams.html","utf8"));
console.log("main",a.length,"exam",b.length);
console.log(a[0], b[0]);
'
```

Expected: `main 214 exam 31`, and every `fileUrl` starting with `https://`.

### 6.4 Automated regression

```bash
npx jest tests/live_notices.test.ts
```

The suite uses inline HTML fixtures only — it never touches the network.

---

## 7. How the app is expected to use it

```ts
import { fetchLiveNotices } from '@/features/notices/liveNotices';

const { notices, sources, errors } = await fetchLiveNotices({ timeoutMs: 15000 });
```

* `notices` — real notices, newest first, de-duplicated by `absolute attachment URL + title`.
* `sources` — the page URLs that actually delivered notices.
* `errors` — advisory; `fetchLiveNotices()` never throws, it returns whatever parsed plus the
  reasons the rest failed. A partial result is still worth showing.
* `MOCK_NOTICES` from `noticeService.ts` stays only as the **offline fallback**, and it must be
  rendered with a visible “sample / offline” label so it is never mistaken for a real notice.

### Module API

| Export | Signature |
|---|---|
| `MAIN_NOTICES_URL` | `'https://www.gbu.ac.in/page/notices'` |
| `MAIN_NOTICES_MIRROR_URL` | `'https://test.gbu.ac.in/page/notices'` |
| `EXAM_NOTICES_URL` | `'https://exams.gbu.ac.in/'` |
| `LiveNotice` | `interface` — `id, source, sourceUrl, title, postedAt, postedOn, fileUrl, attachmentKind, attachmentLabel, isNew, category, importance, relatedUrls` |
| `parseMainNoticesHtml` | `(html: string, baseUrl?: string) => LiveNotice[]` |
| `parseExamNoticesHtml` | `(html: string, baseUrl?: string) => LiveNotice[]` |
| `parseDateSheetModalLinks` | `(html: string) => Array<{ schoolCode: string; url: string }>` |
| `fetchLiveNotices` | `(options?: { timeoutMs?: number; fetchImpl?: typeof fetch }) => Promise<{ notices: LiveNotice[]; sources: string[]; errors: string[] }>` |
| `resolveAbsoluteUrl` | `(href: string, baseUrl: string) => string \| null` |
| `classifyLiveNotice` | `(title: string) => LiveNoticeCategory` |
| `scoreLiveNoticeImportance` | `(title: string, category: LiveNoticeCategory, isNew?: boolean) => number` |
| `decodeEntities` | `(input: string) => string` |

`LiveNoticeCategory` = `exam | datesheet | result | fees | scholarship | hostel | admission | academic | event | other`.
(Placement and internship notices are bucketed as `event`, because the app's category set has no
`placement` member. The keyword style mirrors `noticeService.ts` so the existing filter chips
keep working; the live pages additionally map NCC, tablet/smartphone distribution, government
benefit schemes, orientation/induction and eligibility notices into meaningful buckets.)

`importance` is 0–5 and is a pure function of the notice: exam/datesheet/result +3,
fees/scholarship +2, admission/hostel/academic +1, deadline wording +2, `New` badge +1,
tender/procurement wording −3, clamped to 0–5.

---

## 8. Open points for the owner

1. **The app is not wired to this module yet.** `noticeService.ts` / `useNoticesQuery.ts` /
   the notices screen still read `MOCK_NOTICES`; they are outside the ownership of this change.
   Whoever wires it up must add the “sample” label for the offline fallback.
2. **The date-sheet fallback is incomplete on purpose.** Only the December 2025 end-semester
   mapping is recoverable from the inline script. A future notice that hides its attachments
   behind a modal will need a new entry in `parseDateSheetModalLinks()`.
3. **Attachment links expire.** GBU re-uses file names, and the `DownloadFile` endpoint answers
   500 for anything that is not the exact published query. The app should always offer “open the
   original notice page” next to the attachment.
4. `docs/ROADMAP.md` should be ticked for this item by the person who integrates it.
