# GBU Website Notice Structure (verified research)

All findings below were obtained by **live fetches** against the real hosts.

## 0. Access notes (read this before writing a scraper)

**GBU's TLS certificate does not verify from many clients.** From a Windows host,
`curl https://www.gbu.ac.in/` returned `000` (TLS failure) while `https://example.com`
returned `200`. Adding `-k` made GBU return `200` immediately.

This is a **server-side certificate-chain problem** (the issuing CA is not trusted by
Windows/Node), not a network block.

- Node `fetch`/undici will fail with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
- **Do NOT set `NODE_TLS_REJECT_UNAUTHORIZED=0` in production.** Bundle the specific CA.
- `gbuweb.github.io` has a valid certificate and needs no workaround.

### Redirects and canonical host

| From | Result |
|---|---|
| `http://gbu.ac.in/` | `301` -> `https://www.gbu.ac.in/` |
| `https://gbu.ac.in/` | `301` -> `https://www.gbu.ac.in/` |
| `https://www.gbu.ac.in/` | `200` (canonical) |

DNS resolves `www.gbu.ac.in` to `50.63.8.116`.
`https://test.gbu.ac.in/page/notices` returns the **identical** 146,859-byte page as
`https://www.gbu.ac.in/page/notices`, so the existing worker URL is valid.

## 1. Platform / CMS

**Custom ASP.NET MVC 5 on IIS 10 / Plesk.** Not WordPress, Drupal, Joomla, Django or Laravel.

Response headers from `https://www.gbu.ac.in/page/notices`:

```
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Server: Microsoft-IIS/10.0
X-AspNetMvc-Version: 5.2
X-AspNet-Version: 4.0.30319
X-Powered-By: ASP.NET
X-Powered-By-Plesk: PleskWin
```

Negative evidence: `/wp-json/` -> soft-404 (no WP REST API), `/wp-login.php` -> real 404,
`/admin/` -> soft-404, no `<meta name="generator">` tag anywhere.

`robots.txt` disallows `/.well-known/`, `/App_Data/`, `/bin/`, `/fonts/`, `/Scripts/`
(.NET conventions, not WordPress).

**Front end:** Bootstrap 5.0.0-beta2 (`/Content/css/bootstrap.min.css`,
`/Content/js/bootstrap.bundle.min.js`), jQuery 3.4.1 (`/Scripts/jquery-3.4.1.min.js`),
FontAwesome 4.0.3 via cdnjs, Google Programmable Search
(`cse.google.com/cse.js?cx=014142162027795520387:rpatngdrvw9`).

**The site is server-rendered HTML, not a JS SPA.** Do not build a headless-browser scraper.

## 2. The soft-404 trap (important)

Unknown paths return **HTTP 200** with a 38,725-byte "404 - Page not found" page:

```html
404 - Page not found
Sorry, an error has occured, Requested page not found!
Go Home
```

A scraper that only checks status codes will treat every invented path as valid.
**Detect it by body length (not 38,725) or by the literal marker `404 - Page not found`.**

Real 404s return a 1,245-byte page. Server errors (`500`) return 38,597 bytes.
`/admissions` returns `403` with 1,233 bytes (WAF block).

## 3. Path status table (all fetched with `-k -L`)

| Path | Status | Size | Notes |
|---|---|---|---|
| `/notice` `/notices` `/notice-board` `/notices-board` `/news` `/announcements` `/events` `/students` `/examination` `/academic-calendar` `/holidays` `/calendar` | 200 | 38,725 | **soft-404** |
| `/rss` `/feed` `/api/notices` `/api/news` `/wp-json/` `/admin/` `/page/notice` `/newsletter` `/page/news` `/page/tenders` `/getpartial/news` | 200 | 38,725 | **soft-404** |
| `/academics` `/public/notices` | **500** | 38,597 | server error |
| `/admissions` | **403** | 1,233 | WAF |
| `/feed.xml` `/rss.xml` `/atom.xml` `/sitemap_news.xml` `/wp-login.php` | **404** | 1,245 | real 404 |
| **`/page/notices`** | 200 | 146,859 | **PRIMARY notices listing** |
| `/getpartial/notices` | 200 | 51,831 | legacy notices (all 2021 and older) |
| `/page/events` | 200 | 58,847 | events listing |
| `/page/EventDetail/{id}` | 200 | 39,654 | event detail page |
| `/page/tender` | 200 | 42,455 | tenders |
| `/getpartial/tenders` | 200 | 39,378 | tenders (partial) |
| `/getpartial/highlights` | 200 | 3,112 | highlights cards (true partial, no nav) |
| `/examinations` | 200 | 65,483 | exam notices (separate table) |
| `/public/newsletter` | 200 | 47,404 | GBU News newsletters |
| `/page/sitemap` | 200 | 42,217 | HTML sitemap |
| `/page/directory` | 200 | 83,832 | |
| `/page/recruitment` | 200 | 64,120 | |
| `/contact-us` | 200 | 49,306 | |
| `/page/payment` | 200 | 40,853 | |
| `/academics/timetables` | 200 | 38,982 | |
| `/Content/...` `/Content/gbudata/` (directory) | 403 | 1,233 | directory listing blocked |

**The real notices endpoint is `/page/notices`.** Every other guess in the brief is a
soft-404. Note `worker/sources.config.ts` currently has
`fallbackUrl: 'https://www.gbu.ac.in/notices'` - that is a **soft-404** and must be
changed to `https://www.gbu.ac.in/page/notices`.

## 4. `/page/notices` - the notices listing (raw markup)

**A single HTML `<table>`.** Not a card list, not a JS app.
Heading: `<h2>Notices and Circulars (Public)</h2>`.
Table: `<table class="table table-condensed table-striped">`.

```html
<h2>Notices and Circulars (Public)</h2>
    <div class="py-5">
        <table class="table table-condensed table-striped">
            <tr>
                <th style="width:150px">
                    Date
                </th>

                <th>
                    Title
                </th>

            </tr>

                    <tr>
                        <td>

                            01 Oct 2026

                        </td>

                        <td>
                           
                            <a href="/Admissions/DownloadFile?nName=-3239624_135ecad8.pdfScan30092026.pdf" target="_blank">Notice for Scholarship on NSP Portal</a>
                            
                        </td>


                    </tr>
                    <tr>
                        <td>


                            18 Sep 2026
## 5. Date formats differ across the site

| Page | Format | Example |
|---|---|---|
| `/page/notices` (table) | `DD Mon YYYY` | `01 Oct 2026` |
| Homepage carousel | `DD-MM-YYYY` | `01-10-2026` |
| `/page/events` (table) | `DD-MM-YYYY` | `20-11-2026` |
| `/getpartial/highlights` | `DD-MM-YYYY` | `04-04-2019` |
| `/getpartial/tenders` | `DD-MM-YYYY` | `21-05-2021` |
| `/getpartial/notices` (legacy) | `DD Mon YYYY` | `21 May 2021` |

Parse with `Date.parse` after normalising, or use two explicit patterns.

## 6. Homepage notice block (card list, 5 most recent)

Different markup from `/page/notices`: a `ul.list-group` of `li.list-group-item`.

```html
<h1 class="card-title text-center">Notices/Circulars</h1>
                    <p class="card-text">
                        <ul class="list-group list-group-flush">


                            <li class="list-group-item">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-calendar-date" viewBox="0 0 16 16">
                                    <path d="M6.445 11.688V6.354h-.633A12.6 12.6 0 0 0 4.5 7.16v.695c.375-.257.969-.62 1.258-.777h.012v4.61h.675zm1.188-1.305c.047.64.594 1.406 1.703 1.406 1.258 0 2-1.066 2-2.871 0-1.934-.781-2.668-1.953-2.668-.926 0-1.797.672-1.797 1.809 0 1.16.824 1.77 1.676 1.77.746 0 1.23-.376 1.383-.79h.027c-.004 1.316-.461 2.164-1.305 2.164-.664 0-1.008-.45-1.05-.82h-.684zm2.953-2.317c0 .696-.559 1.18-1.184 1.18-.601 0-1.144-.383-1.144-1.2 0-.823.582-1.21 1.168-1.21.633 0 1.16.398 1.16 1.23z" />
                                    <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z" />
                                </svg>



                               
                                <a class="block-text stretched-link gblink" target="_blank" href="/Admissions/DownloadFile?nName=-3239624_135ecad8.pdfScan30092026.pdf">
                                    Notice for Scholarship on NSP Portal
                                </a>



                                (<small>01-10-2026 </small>).
                            </li>
                            ...
                        </ul>
                    </p>
                    <a href="/page/notices" class="btn gblink"><b>More Notices ...</b></a>
```

Homepage regex:

```js
/<li class="list-group-item">[\s\S]*?<a class="block-text stretched-link gblink" target="_blank" href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?\(<small>(\d{2}-\d{2}-\d{4})\s*<\/small>\)/g
```

"More Notices ..." is `<a href="/page/notices" class="btn gblink"><b>More Notices ...</b></a>`.

## 7. Events - `/page/events` (has the department field notices lack)

```html
<h2>Events</h2>
   <div class="py-5">
        <table class="table table-striped table-bordered">

            <tr>
                <td class="w-auto">1</td>
                <td class="w-auto"> 20-11-2026 </td>
                <td class="w-75"><a class="gblink" href="/page/EventDetail/1786">National Conference on Intellectual Property Rights: Innovation, Access and Society</a></td>
               <!-- <td class="w-auto">
                <a class="gblink" href="/page/EventDetail/-1186787135_Brochure_National Conference on IPR.pdf">PDF</a>
                </td> -->
                <td class="w-auto"> SoLJG</td>
            </tr>
```

**4 columns: S.No. | date (`DD-MM-YYYY`) | title -> `/page/EventDetail/{id}` | department.**
A 4th "PDF" column exists but is **commented out** in the HTML; the brochure is reached
via the detail route, not a direct PDF link. Department codes seen: `SoLJG`, `SOBT`,
`SOBSC`, `SOHSS`, and the full "School of Law, Justice and Governance" (naming is
inconsistent between rows).

**Individual link pattern: `/page/EventDetail/{numericId}`** (e.g. `/page/EventDetail/1783`).
The homepage carousel uses lowercase `/page/eventdetail/1783`; both resolve.
**There is no equivalent detail route for notices.**

`/page/EventDetail/1783` body contains:

```html
<h6>Download Links:</h6>
<a href="https://data.gbu.ac.in/Events/1830331098_CCI-Final1 Poster (1).pdf">Information Brochure</a>
...
<h6>Registration Links:</h6>
<a href="https://cancerconferenceindia.com/">Register Here</a>
...
<h4>21st International Conference on Emerging Frontiers in Cancer Research ...</h4>
<p class="small">29-10-2026</p>
<p>Organized By Gautam Buddha University and Shiv Nadar University, Greater NOIDA</p>
```

## 8. Storage hosts for attachments (all verified)

| Host | Path pattern | Result |
|---|---|---|
| `www.gbu.ac.in` | `/Admissions/DownloadFile?nName=...` | 200 `application/pdf` 861,108 B |
| `www.gbu.ac.in` | `/Content/gbudata/...` (newsletters, notices) | 200 |
| `data.gbu.ac.in` | `/Events/{id}_{name}.pdf` (event brochures) | 200 `application/pdf` 3,825,352 B; `/Events/` and `/Notices/` dirs -> 403, root -> 403 |
| `gbuweb.github.io` | `/data/notices/{Category}/{file}` (legacy only) | 200 |

## 9. Machine-readable endpoints

**There is no RSS/Atom feed and no JSON API for the live notices list.**
Tested and all soft-404 or real 404: `/rss`, `/feed`, `/feed.xml`, `/rss.xml`,
`/atom.xml`, `/api/notices`, `/api/news`, `/api/notice`, `/json/notices`, `/rss/news`,
`/NewsFeed`, `/newsfeed`, `/feed/news`, `/news/rss`, `/sitemap_news.xml`.

Dead ASMX hints in **commented-out** JavaScript on the homepage:

```js
// url: "NewsProvider.asmx/HelloWorld"
// url: "Home/getRecentNews"
```

`/NewsProvider.asmx`, `/NewsProvider.asmx?WSDL` and `/NewsProvider.asmx/HelloWorld`
all return the soft-404 page (no WSDL is served).
`/Home/getRecentNews` returns **200 with a zero-length body** (also with `?userId=1`
and `?Id=1`). Dead code - do not build against it.

### The one real machine-readable feed: GitHub Pages

Repo `gbuweb/gbuweb.github.io` (confirmed via the GitHub API). All URLs verified live:

| URL | Status | Size | Contents |
|---|---|---|---|
| `https://gbuweb.github.io/data/notices/index.json` | 200 `application/json` | 9,503 B | **35 notice records** |
| `https://gbuweb.github.io/data/events/index.json` | 200 `application/json` | 464 B | 1 event record |
| `https://gbuweb.github.io/data/breakingnews/index.json` | 200 `application/json` | 604 B | 2 breaking-news records |

`data/notices/index.json` record shape:

```json
{
  "id": "37",
  "type": "General",
  "title": "Resumption of Online Classes from 21st May 2021 due to Covid-19 pandemic",
  "pdf": "OfficeOrder_OnlineClass_21MAy2021.jpeg",
  "createdat": "2021-05-21T13:37:27+00:00",
  "displaytill": "2021-05-31T13:37:27+00:00",
  "isActive": 1
}
```

- `type` is the **category**: `Hostel` 13, `Accounts` 12, `Exam` 6, `General` 2,
  `Admin` 1, `""` 1.
- `pdf` is a bare filename; the real URL is
  `https://gbuweb.github.io/data/notices/{type}/{pdf}`.
- `createdat` / `displaytill` are ISO 8601 with offset - good for date parsing.
- One record's `pdf` is a Google Drive folder URL, not a file.

Repo directory layout: `data/{notices,events,highlights,tenders,breakingnews}` plus a
`data/olddata` file. `data/notices/` contains `Accounts/`, `Admin/`, `Exam/`,
`General/`, `Hostel/`, `index.json`.

**Important:** this feed corresponds to the **legacy** `/getpartial/notices` page
(35 rows, all `github.io` links, dates <= 2021-05-21). It is **not** the current
213-notice list. Useful for backfilling old notices, useless for new ones.

### Legacy partial pages

`/getpartial/notices` (51,831 B): `<h2>Notices and Circulars (Public)</h2>` +
`<table class="table table-condensed table-striped">`, 35 rows, header
`Date` / `Title / Description`, links are absolute to
`https://gbuweb.github.io/data/notices/{Category}/{file}` e.g.
`General/OfficeOrder_OnlineClass_21MAy2021.jpeg`,
`Hostel/OfficeOrder_Students_16Apr2021.pdf`. Dates `DD Mon YYYY`.

`/getpartial/highlights` (3,112 B - a true partial, no nav or footer):
`<section id="highlights">` with 3 `.card` blocks, each having `.card-title`,
`#text-description-card`, `<small class="text-muted">DD-MM-YYYY</small>`,
link `/page/event/{id}`, image `https://gbuweb.github.io/data/highlights/img/{id}.png`.

`/getpartial/tenders`: `<h2>Tenders</h2>` + table (S.No. | `DD-MM-YYYY` | title ->
`https://gbuweb.github.io/data/tenders/{file}.pdf`) + 3 buttons (eTender portal,
print media, `/page/etender`).

## 10. robots.txt and sitemap.xml

`robots.txt` (163 B, verbatim):

```
User-agent: *
Disallow: /.well-known/
Disallow: /App_Data/
Disallow: /bin/
Disallow: /fonts/
Disallow: /Scripts/
Sitemap: https://www.gbu.ac.in/sitemap.xml
```

`sitemap.xml` (48,560 B): **315 `<url>` entries**, generated by
`<!-- created with Free Online Sitemap Generator www.xml-sitemaps.com -->`.
Format is `<loc>` + `<lastmod>` + `<priority>`. **All `<lastmod>` values are from
2021-03 / 2021-04 - the sitemap is stale and not maintained.** It contains
`https://gbu.ac.in/getpartial/notices` (the legacy path) but **not** `/page/notices`.
Note the `<loc>` values use the **non-www** host while the site canonicalises to `www`.

## 11. Other tables (for completeness)

- **`/examinations`** - tab-pane page. Active tabs: `Examination`, `Examination Schedule`,
  `Contact`. The `Notices` / `Announcement` / `Results` / `Degree` / `Certificate` /
  `Transcripts` **panels exist in the HTML but their nav tabs are commented out**, and
  the `Announcement` and `Results` bodies are **empty** (`<div class="ml-4"></div>`).
  The `id="Notices"` panel has a table (`S.No.` / `Details:` / `Link`) whose rows are
  **commented out**; 28 raw matches, the first is `SNo=1 / "Datesheet Odd Semester
  Examination-January-2022" / link empty`, the rest are per-school
  (`a.` `b.` ... School Of Buddhist Studies & Civilization / School of Biotechnology / ...)
  with links `~/Content/examination/{file}.pdf`.
- **`/public/newsletter`** - `<h1>GBU News</h1>`, sections `News Letters of GBU` /
  `Medical Claim Forms` / `General Forms`. Table `S.No.` / `Description` /
  `Download Link`; links are root-relative and work, e.g.
  `/Content/gbudata/Newsletter/GBU_English_May_June2025.pdf`. S.No. values are
  hierarchical (`11`, `11.1`, `10`, `10.1`, `9`).
- **`/page/sitemap`** (42,217 B) - HTML sitemap; contains no notice URLs.

## 12. The `~/` href bug - must be stripped

Some pages emit `href="~/Content/..."`. **VERIFIED broken:**

| URL | Result |
|---|---|
| `https://www.gbu.ac.in/~/Content/examination/SOBSC_Date%20Sheet_12Jan2022.pdf` | **404** (1,245 B) |
| `https://www.gbu.ac.in/Content/examination/SOBSC_Date%20Sheet_12Jan2022.pdf` | **200**, 179,180 B, `application/pdf` |

Counts per page: `exams.html` 9 x `~/`; home / notices / events / newsletter / tenders
1 x each (the footer link `~/Content/gbudata/about/Profile_Prof_R_K_Sinha_17Feb2022.pdf`).

**Rule: strip a leading `~/` and resolve against the origin root.**

## 13. Action items / bugs found in the existing worker

### BUG 1 - `worker/sources.config.ts` fallback URL is a soft-404

```ts
mainNotices: {
  url: 'https://test.gbu.ac.in/page/notices',   // OK - verified, 146,859 bytes
  fallbackUrl: 'https://www.gbu.ac.in/notices',  // WRONG - soft-404 (38,725 bytes)
```

If the primary fetch fails, the fallback silently yields the "page not found" page.
Change to `https://www.gbu.ac.in/page/notices`.

### BUG 2 - `worker/noticesJob.ts` date regex does not match the real format

The current regex is:

```ts
const dateMatch = rowContent.match(/(?:<td[^>]*>)?\s*([0-3]?[0-9][/.-][0-1]?[0-9][/.-][2-9][0-9]{3})\s*(?:<\/td>)?/i);
```

It only matches **numeric** dates (`DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`).
`/page/notices` uses **`DD Mon YYYY`**.

Measured against the live page: **only 12 of 213 rows matched**, and every one of
those 12 was a **false positive** - a date-looking digit run inside a *filename*:

```
25-08-2026, 16-03-2026, 2.3/2026, 2.3/2026, 2.3/2026, 27-01-2026,
07.11.2025, 15-10-2025, 08-10-2025, 23-05-2025, 08.05.2025, 07.07.2022
```

The other **201 rows get no date at all** and fall back to `new Date().toISOString()`
in the code - so every notice is stamped "now". The 12 false positives are also
matched from the wrong part of the row (the `nName` attribute, not the `<td>`).

Fix: anchor the date to the **first `<td>`** of the row and accept both formats.

```ts
const GBU_NOTICE_ROW_RE =
  /<tr>\s*<td>\s*(\d{2}\s+[A-Za-z]{3}\s+\d{4}|\d{2}[-/.]\d{2}[-/.]\d{4})\s*<\/td>\s*<td>\s*(?:<a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>)?/g;
```

This was verified to match 213/213 rows on the live page.

### BUG 3 - no soft-404 detection

`fetchHtml` should treat a 38,725-byte body containing `404 - Page not found` as a
failure, not as data. Otherwise a layout change silently empties the notice list.

### BUG 4 - `fileType` is always PDF

32 of 213 attachments are `.jpg` / `.jpeg` scans. Derive `fileType` from the extension
or the response `Content-Type`, not from the assumption that it is a PDF.

### Other worker rules

1. **Target `https://www.gbu.ac.in/page/notices`** - one request, all 213 notices.
   `test.gbu.ac.in` serves the identical page and can stay as primary.
2. **Fix TLS trust** (bundle the CA). Never disable verification globally.
3. **Detect soft-404** by body size / marker.
4. **Decode HTML entities** in titles (`&#39;`, `&amp;`).
5. **Normalise `nName`**: `%20` vs literal spaces differ between the table and the
   homepage. Keep the raw filename and build the URL from the decoded value.
6. **Handle both date formats** (see section 5).
7. **Strip the leading `~/`** from any href.
8. **No categories and no detail pages exist for notices** - derive `category` with
   `classifyNotice()` from the title, and do not attempt to fetch a notice detail page.
9. `sourceId` should be a hash of the **absolute file URL + parsed date**, not of the
   raw row text.
10. `/getpartial/notices` + the GitHub `index.json` can backfill 2021-era notices
    (35 records) if historical coverage is wanted.

## 14. Live subdomain matrix (verified 2026-10-20, `curl -k -L`)

TLS note: with strict validation Node/undici fail `CERT_HAS_EXPIRED` for
`*.gbu.ac.in` — the certificate itself has expired. `-k`/scoped
`rejectUnauthorized:false` is mandatory for every host below. (Section 0's
"untrusted leaf" description predates the expiry; treat the cert as **expired**.)

| Host | Status | Verdict | Evidence / notes |
|---|---|---|---|
| `www.gbu.ac.in` | 200 | **primary source** | `/page/notices` 146,859 B, 214 `<tr>` (213 data rows); `/page/events` 58,831 B, 36 rows; `/page/academicCalender` 40,286 B (PDF links, no table) |
| `test.gbu.ac.in` | 200 | **mirror** | byte-identical notices page; current worker primary |
| `samay.mygbu.in` | 200 | **timetable API** | `api.php` 3,180,079 B JSON, 4,277 records, no params needed; `?schd=39/40` selects session |
| `mygbu.in` | 200 | timetable (login wall at `/`) | legacy `schd/api.php` shape identical |
| `exams.gbu.ac.in` | 200 | **source** | 62,123 B "GBU Examinations Portal"; notice tables under `/admin/public/uploads/notices/`, `/uploads/notices/` |
| `hostels.gbu.ac.in` | 200 | source (link-out) | 58,623 B home; no `/notices` path — find notice links from home crawl |
| `ohms.gbu.ac.in` | 200 | source (link-out) | 34,415 B; no standalone notice list found |
| `csms.gbu.ac.in` | 200 | **LOGIN-WALL** | 12,338 B student management login — never scrape, link out |
| `cultural-council.gbu.ac.in` | 200 | content, no notice list | 41,317 B home; `/notice*` `/events` all 404 (1,245 B) |
| `digiforms.gbu.ac.in` | 200 | content, no notice list | 20,651 B; `/notice*` `/forms` 404 (1,095 B) |
| `admissions.gbu.ac.in` | 200 | near-empty | 35 B body; real admissions live at `pravesh.gbu.ac.in` → `gbuadm.samarth.edu.in` (160,632 B) |
| `pravesh.gbu.ac.in` | 302→200 | admissions | redirects to Samarth portal — link out |
| `faculty.gbu.ac.in` | 200 | directory | 195,092 B faculty profiles — link out / optional crawl |
| `idp.gbu.ac.in` | 200 | E-Resources | 26,936 B — link out |
| `erp.gbu.ac.in` | 200 | **LOGIN-WALL** | redirects to `public/login.php` — never scrape |
| `manage.gbu.ac.in` | 200 | **LOGIN-WALL** | 2,066 B — never scrape |
| `gbuexam.in` | 200 | **LOGIN-WALL** (faculty) | `login.php` — never scrape; results link out |
| `data.gbu.ac.in` | 403 | blocked | "403 - Forbidden" |
| `finance.gbu.ac.in` | 403 | blocked | "403 Forbidden" |
| `iqac.gbu.ac.in` | 503 | down | "503 Service Unavailable" |
| `erpfee.gbu.ac.in` | 000 | dead | no DNS/connection (fee link on www is commented out; live fee link is `/page/payment`) |
| `events.gbu.ac.in` | 000 | dead | no DNS/connection — use `www.gbu.ac.in/page/events` instead |

**Action items applied:**
- Worker sources: main = `test.gbu.ac.in/page/notices` with fallback
  `www.gbu.ac.in/page/notices`; exams = `exams.gbu.ac.in`; dead hosts removed
  from the scrape list and replaced by working equivalents.
- Timetable base URL switched to `samay.mygbu.in/api.php` (see section 15).
- Soft-404 + TLS tolerance implemented and unit-tested in `worker/noticesJob.ts`.

## 15. Timetable API deep-dive (verified 2026-10-20)

- `https://samay.mygbu.in/api.php` (found in `base.apk` strings, the official
  timetable app) returns a **flat JSON array**, 4,277 records for session 39.
- Identity model: `TimeTableId` is the **snapshot version** (23001 on every
  row right now), `TTId` is the **unique row id** — cheap change detection can
  compare `MAX(TTId)` + `MAX(Timestamp)` before re-parsing 3 MB.
- `TT_Day` 1–7 (1=Monday … 7=Sunday — session 39 includes Sat+Sun weekend
  batches `PCW-II`), `TT_Period` 1–11 (08:30–07:30, one-hour slots),
  `ActivityTag` ∈ {Lecture, Lab, Tutorial}.
- Session ids: `39` = current, `40` = next (both present in `activeSemesters`).
- Class-code grammar: `<PROGRAMME>-<ROMAN_YEAR>[ -/]<SECTION>` e.g.
  `BCS-II B` = B.Tech CSE, 2nd year, section B; separators are inconsistent
  (`BCS-II B`, `BCS-I-A`, `BCA-I A`, `MBA II`), programme may itself contain
  dashes (`CSE-CS-II`, `BEC-AI-III`), and word years occur in owner-era codes
  (`bcs-second-a`). `parseGBUClassCode()` handles all of these and is tested.
- 152 distinct `SectionName` values across 6 schools (SOICT, SOE, SOM, SOBT,
  SOHSS, SOVSAS). `app/class-setup.tsx` now derives years/sections **only** from
  the real catalogue (`SECTIONS_BY_PROGRAMME`), so students can never select a
  class key that doesn't exist in the API.


                        </td>

                        <td>
                           
                            <a href="/Admissions/DownloadFile?nName=-8055826_861029a0.jpgScan_20260918.jpg" target="_blank">Advisory on Events and use of the University&#39;s Name and Identity</a>
                            
                        </td>


                    </tr>
        </table>
    </div>
```

(The real source has blank lines between the tags inside `<td>`; the regex below is
whitespace-tolerant. **All 213 data rows follow this identical shape.**)

### Regex (tested against the live page: matched 213 / 213 rows)

```js
/<tr>\s*<td>\s*(\d{2}\s+[A-Za-z]{3}\s+\d{4})\s*<\/td>\s*<td>\s*(?:<a[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>)?/g
```

Sample extractions:
- `date=[01 Oct 2026] href=[/Admissions/DownloadFile?nName=-3239624_135ecad8.pdfScan30092026.pdf] title=[Notice for Scholarship on NSP Portal]`
- `date=[24 May 2021] href=[/Admissions/DownloadFile?nName=17233690_18307fdd.pdfApplication-Form_Intrnl_Stdnt_GBU.pdf] title=[APPLICATION FORM FOR INTERNATIONAL STUDENTS]`

### Fields exposed by each notice entry

| Field | Available | Detail |
|---|---|---|
| Title | yes | anchor inner text; HTML-escaped (`&#39;`, `&amp;`) - decode entities |
| Date | yes | `DD Mon YYYY`, e.g. `01 Oct 2026` (zero-padded day) |
| Attachment / file link | yes | `/Admissions/DownloadFile?nName=...` (relative, same-origin) |
| **Category / department tag** | **no** | absent from the notices table (events table has one) |
| **Individual notice detail page** | **no** | **none - notices are file links only** |
| Description / body text | no | title only |
| Stable notice ID | no | `nName` is an upload filename, not a notice ID |

Link distribution inside the table: **213 same-origin, 0 external** (verified).

### Coverage and ordering

213 notices, newest first, `2021-05-24` -> `2026-10-01`.

| Year | Count |
|---|---|
| 2021 | 1 |
| 2022 | 9 |
| 2023 | 0 |
| 2024 | 9 |
| 2025 | 148 |
| 2026 | 46 |

Dates tie (two notices on 01 Oct 2026, two on 17 Sep 2026). Tie order is not guaranteed
stable between renders, so do not use it as a secondary sort key.

### Pagination: there is none

- `/page/notices?page=2` -> **byte-identical** to `/page/notices`
  (SHA-256 `BB374AEA58EA8F9BC085DC489323EBE4BF878A175A4617FAE85AF27A8324E320`), still 213 rows.
- `/page/notices/1` -> also byte-identical.
- No pager markup; `?p=` and `?pageIndex=` are ignored.

**One request to `/page/notices` returns the complete list. No pagination logic needed.**

### Encoding

UTF-8 **without BOM** (first bytes `60,33,68` = `<!D`). `<head>` declares
`<meta charset="utf-8">` and the HTTP header says `charset=utf-8`.
`/page/notices` and `/page/events` decode cleanly; the **homepage contains 1 mojibake
sequence**. Decode as UTF-8 and tolerate stray bad bytes.

### Attachment link pattern

```
/Admissions/DownloadFile?nName=<signed-int>_<8-hex>.<ext><Original Name.ext>
```

Decoded examples:

```
-3239624_135ecad8.pdfScan30092026.pdf
24307069_18f29bc0.pdfNew Doc 09-30-2026 16.53.pdf
-8055826_861029a0.jpgScan_20260918.jpg
-1254719_ef91f782.pdf31 UP (Girls)Bn NCC Notice.pdf
```

- `nName` is the full original filename, URL-encoded.
- **Spaces are `%20` in the `/page/notices` table but literal in the homepage carousel.**
  Normalise before building URLs.
- A valid file returns `200`, `Content-Type: application/pdf`,
  `Content-Length: 861108` (the NSP notice), served **inline with no
  `Content-Disposition` header**.
- **Attachment extensions across the 213 rows: `pdf` 181, `jpg` 30, `jpeg` 2.**
  32 of 213 notices are scanned **images**, not PDFs. Check the extension /
  `Content-Type` and set `fileType` accordingly (`'pdf' | 'image' | 'html'`).

