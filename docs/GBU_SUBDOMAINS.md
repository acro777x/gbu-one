# Gautam Buddha University (GBU) — Complete Subdomain Infrastructure Matrix

Compiled from multi-agent automated network probes, TLS verification, DNS resolution, and reverse-engineering of client bundles across `*.mygbu.in`, `*.gbu.ac.in`, and `gburif.org`.

---

## 1. Executive Summary & Routing Infrastructure

GBU's online digital presence is distributed across three physical and cloud hosting clusters:
1. **Cloud Production & VPS Cluster (`50.63.8.116` & `201.18.198.54`)**:
   - Runs Windows Server / IIS 10 with PleskWin, ASP.NET MVC 5.2, and PHP 8.
   - Hosts the primary university portal (`www.gbu.ac.in` / `test.gbu.ac.in`), Online Hostel Management System (`ohms.gbu.ac.in` & `hostels.gbu.ac.in`), Media Portal (`media.gbu.ac.in`), and NSS Portal (`nss.gbu.ac.in`).
2. **Examination & Student Cloud Cluster (`147.93.109.9`, Hostinger Cloud)**:
   - Hosts the official Examination Portal (`exams.gbu.ac.in`), Student Timetable Engine (`samay.mygbu.in`), and Central Student Management System (`csms.gbu.ac.in`).
3. **On-Campus National Knowledge Network (NKN) Core (`14.139.238.11` / `14.139.238.14`, ERNET India)**:
   - Hosts on-premise institutional ERP (`erp.gbu.ac.in`), Shibboleth Identity Provider (`idp.gbu.ac.in`), legacy timetable server (`schd.mygbu.in`), and IQAC server (`iqac.gbu.ac.in`).

---

## 2. Comprehensive Domain Matrix (50+ Subdomains)

### A. Core Academic & Notice Portals

| Subdomain | Resolved IP | Technology | Role & Content | Ingestion Strategy |
|---|---|---|---|---|
| `www.gbu.ac.in` | `50.63.8.116` / `201.18.198.54` | IIS 10, ASP.NET MVC 5 | Main official university web portal. Notices at `/page/notices`, events at `/page/events`. | Primary Notice Source (fallback: `test.gbu.ac.in`) |
| `test.gbu.ac.in` | `50.63.8.116` / `201.18.198.54` | IIS 10, PleskWin | High-reliability mirror of the main portal; serves live 147 KB table of circulars. | Worker Active Primary |
| `exams.gbu.ac.in` | `147.93.109.9` | PHP, Bootstrap | Examination Portal: date sheets, marks gazettes, back-paper rules, and exam notices. | Primary Datesheet & Exam Source (15m poll) |
| `hostels.gbu.ac.in` | `50.63.8.116` | PHP, Bootstrap 5 | Public hostel portal: phase-wise allotment notices at `/notices.php`, mess rebate orders. | Scrape Allotment & Mess Circulars |
| `ohms.gbu.ac.in` | `50.63.8.116` | React SPA + PHP REST API | Online Hostel Management System: room booking, single-seater requests, fee clearances. | Link-Out & REST Integration |
| `nss.gbu.ac.in` | `50.63.8.116` | PHP, DataTables | National Service Scheme: volunteering announcements, events, unity march circulars. | Scrape HTML Table at `/news.php` |
| `media.gbu.ac.in` | `50.63.8.116` | PHP 8, Bootstrap 5 | University media coverage and press clippings with hi-res photos. | Scrape Press Releases at `/index.php` |
| `gburif.org` | `172.67.214.67` (Cloudflare) | PHP 8.5 | AIC-GBU Incubation Centre: hackathons, startup grants, and innovation circulars. | Scrape Announcements Feed |

---

### B. Timetable & Student Academic Services (`*.mygbu.in`)

| Subdomain | Resolved IP | Role & Content | App Strategy |
|---|---|---|---|
| `samay.mygbu.in` | `147.93.109.9` | Primary Timetable JSON API (`/api.php?schd=39` current, `40` next session). Flat array of ~4,277 records. | Active Timetable Feed (30m poll) |
| `schd.mygbu.in` | `14.139.238.11` | Legacy campus timetable engine (`/schd/api.php`). | Secondary Timetable Fallback |
| `reg.mygbu.in` | `147.93.109.9` | Semester student registration slip verification and generation. | Link-Out (Student Portal) |
| `exams.mygbu.in` | `147.93.109.9` | Back-paper registration forms and internal assessment displays. | Link-Out |
| `fees.mygbu.in` | `147.93.109.9` | Semester fee payment redirector. | Link-Out to CSMS |
| `lms.mygbu.in` | `147.93.109.9` | Moodle Learning Management System for course slides and assignments. | Link-Out (Coursework) |
| `glitch.mygbu.in` | `14.139.238.11` | Annual National Technical Festival ("Glitch") schedule and hackathon registration. | Featured Event in Events Hub |
| `owncloud.mygbu.in` | `14.139.238.11` | Internal DIC cloud file storage. Token-authenticated only. | Internal Only |
| `adm.mygbu.in` | `14.139.238.11` | Legacy admission redirector. | Redirect to Samarth |
| `loop.mygbu.in` | `14.139.238.11` | GBU student community forum. | Link-Out |
| `sameer.mygbu.in` | `147.93.109.9` | Student developer sandbox environment. | Exclude |

---

### C. Student Welfare, Utilities & Administration (`*.gbu.ac.in`)

| Subdomain | Resolved IP | Purpose | App Integration |
|---|---|---|---|
| `sp.gbu.ac.in` | `50.63.8.116` | Security & Proctor Fine Payment portal. Connects to `https://finance.gbu.ac.in/api/sp/search.php`. | Utility Feature (Check & Pay Fines) |
| `bodhimitra.gbu.ac.in` | `201.18.198.54` | Bodhi-Mitra Student Mental Health & Psychological Counselling helpline. | Emergency Student Support Drawer |
| `ccc.gbu.ac.in` | `201.18.198.54` | Central Computer Centre: Wi-Fi MAC device registration PDF & GBU email forms. | Offline Forms & Wi-Fi Setup |
| `csms.gbu.ac.in` | `147.93.109.9` | Central Student Management System: mandatory fee payment, challans, ledgers. | Secure Link-Out (Pay Fees) |
| `daict.gbu.ac.in` | `43.250.252.75` | SDMS: Vite/React SPA for student attendance, class rosters, and clearance desk. | Protected WebView / Link-Out |
| `digiforms.gbu.ac.in` | `201.18.198.54` | Digital forms: UP Govt tablet/smartphone scheme, day-scholar verification. | Welfare Link-Out |
| `library.gbu.ac.in` | `201.18.198.54` | Bodhisattva Dr. BR Ambedkar Library OPAC, Koha catalogue, operational timings. | Library Timing & OPAC Drawer |
| `idp.gbu.ac.in` | `14.139.238.14` | Shibboleth IdP for off-campus IEEE Xplore / ScienceDirect access. | Research E-Resources Link |
| `pravesh.gbu.ac.in` | `103.21.58.236` | HTTP 301 to Samarth Admissions (`gbuadm.samarth.edu.in`). | Link-Out in Onboarding |
| `cultural-council.gbu.ac.in` | `201.18.198.54` | Cultural societies (*Dishayan*, *Swaranjali*, *Abhivyanjana* fest). | Clubs Directory |
| `ignition.gbu.ac.in` | `201.18.198.54` | Annual Technical Festival (IgNITion) hackathons and rulebooks. | Events Hub (Seasonal Feb-Apr) |
| `iqac.gbu.ac.in` | `14.139.238.11` | Internal Quality Assurance Cell: Course Outcomes (CO/PO), SSS surveys. | In-App Survey Reference |
| `alumni.gbu.ac.in` | `201.18.198.54` | GBU Alumni Association (GBUAA) directory and AlmaBay network. | Community Link |
| `convocation.gbu.ac.in` | `201.18.198.54` | Convocation schedules, degree clearance, dress code regulations. | Seasonal Banner (Nov-Dec) |
| `faculty.gbu.ac.in` | `201.18.198.54` | Faculty directories, qualifications, office rooms, and email contacts. | Faculty Directory Search |
| `manage.gbu.ac.in` | `50.63.8.116` | Internal ASP.NET administrative backend for content approval. | Internal (Never Scrape) |
| `admin.gbu.ac.in` | `201.18.198.54` | University administration router. | Internal (Never Scrape) |
| `finance.gbu.ac.in` | `147.93.109.9` | Internal finance ERP (Student fee interface is at CSMS). | Internal ERP |
| `files.gbu.ac.in` | `201.18.198.54` | Wildcard virtual host (attachments live on apex and exams hosts). | Exclude |
| `data.gbu.ac.in` | `201.18.198.54` | Static asset CDN for event brochures parsed from `/page/events`. | Download Target |
| `erp.gbu.ac.in` | `14.139.238.11` | University ERP behind login wall (`/public/login.php`). | Link-Out |
| `coolify.gbu.ac.in` | `201.18.198.54` | DevOps server infrastructure. | Internal |
| `development.gbu.ac.in` | `201.18.198.54` | Pre-production testing server. | Internal |
| `development-api.gbu.ac.in`| `201.18.198.54` | Pre-production API server. | Internal |
| `old.gbu.ac.in` | `50.63.8.116` | Deprecated 2021 archive. | Exclude |
| `erpfee.gbu.ac.in` | `20.207.96.231` | Decommissioned fee gateway (HTTP 404). | Exclude |
| `events.gbu.ac.in` | `50.63.8.116` | Unconfigured Plesk placeholder (real events at `www.gbu.ac.in/page/events`).| Exclude |

---

## 3. Worker Ingestion Guidelines

1. **Multi-Source Notice Aggregation**:
   - `main`: `https://www.gbu.ac.in/page/notices` (mirrored at `test.gbu.ac.in/page/notices`).
   - `exams`: `https://exams.gbu.ac.in`.
   - `hostel`: `https://hostels.gbu.ac.in/notices.php`.
   - `nss`: `https://nss.gbu.ac.in/news.php`.
   - `gburif`: `https://gburif.org/announcements.php`.
2. **Timetable Pipeline**:
   - Primary: `https://samay.mygbu.in/api.php?schd=39`.
   - Legacy fallback: `https://mygbu.in/schd/api.php?schd=39`.
3. **Question Paper Ingestion (PYQ)**:
   - No public digital repository exists on university servers; the crowdsourced library powered by Supabase Storage (`pyq` bucket) and authentic Telegram archives is the sole repository for student question papers.
