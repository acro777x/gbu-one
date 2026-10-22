# PYQ archive import (the Telegram corpus)

The PYQ tab shipped with an empty backend: `public.pyq_papers` had no rows, so
browse showed only the bundled seed. This document describes the offline
pipeline that reads the student library collected from Telegram
(`…/telegram/library/pyq`, 45 folders, 162 files, 87 MB) and fills that table —
and, just as importantly, everything it refuses to guess.

The tooling lives in `scripts/pyq-import/`, which `.gitignore` keeps out of the
repository ("research scratch — never ship"). This document is the part that
ships: what the pipeline does, what it decided, and what it still needs.

## The pipeline

| step | command | reads | writes |
| --- | --- | --- | --- |
| 1. inventory | `node scripts/pyq-import/buildInventory.js` | the archive on disk | `inventory.json` |
| 2. catalogue | `node scripts/pyq-import/buildCatalogue.js` | the timetable API (`mygbu.in/schd/api.php`) | `catalogue.json` — the only source of subjects |
| 3. mapping | `node scripts/pyq-import/buildMapping.js` | inventory + catalogue + `overrides.json` | `mapping.json` |
| 4. plan | `node scripts/pyq-import/importPyq.js` | mapping + answers | `import-plan.csv`, `import-manifest.json`, `owner-review.md` |
| 5. import | `node scripts/pyq-import/importPyq.js --apply --tier=all` | the plan | rows in `pyq_papers` + objects in `pyq-pending` |
| check | `… --status` | the live project | a summary on stdout |
| rules | `… --selftest` | — | 26 assertions on the parsing rules |

The importer writes exactly what the app's own upload writes
(`src/features/pyq/pyqStorage.ts`): the row shape, the
`pyq-pending/SCHOOL/PROGRAMME/SEMESTER/SUBJECT/YEAR-EXAM-<id>.ext` object key and
the 20 MB / PDF-JPG-PNG limits. A paper id is a UUID derived from SHA-256 of
`school|programme|semester|subject|year|exam type|content hash`, so a re-run
never duplicates a row and never moves a file.

## How each field is decided

Priority runs strongest evidence first, and every value records where it came
from (`subjectSource`, `yearSource`, `examSource` in the manifest):

| field | decided by |
| --- | --- |
| subject | a curated override → a catalogue code in the file name → a catalogue code in the folder name → the folder name matched against catalogue names (a clear winner only) |
| school | the catalogue subject's own school |
| programme, semester | a curated override, else the catalogue when the subject has exactly one offering |
| year | the file name (`CS522_2024-25` → 2024) → the date stamped in the file name (`IMG-20251218-WA0037` → Dec 2025) → the single year every sibling file agrees on |
| exam type | the file name → the month of the stamped date (Nov–Dec and Apr–Jun are end-semester, Sep–Oct and Feb–Mar are mid-semester, from the university's own calendar) → the single exam type every sibling file agrees on |
| the file itself | extension and size, per `pyqStorage.ts` — the 2 `.docx` mock tests are refused by type |

A folder no rule can name stays `unresolved`; a file whose year or exam type
nobody states is left out. Nothing is averaged, taken from a file timestamp or
invented.

Confidence tiers: **verified** (a code or the file name settles every field),
**inferred** (a documented rule decided the year and/or the exam type), or
**blocked** (a reason and a question). The default `--apply` sends only the
verified tier; `--apply --tier=all` sends the inferred rows too. Both land as
`status = 'pending'` in the private bucket — the importer has no code path that
publishes anything.
## What was imported (22 Oct 2026)

- **39 rows** in `public.pyq_papers`, all `status = 'pending'`, `uploader_id` null
- **39 objects** in `pyq-pending`, one per row, exact path match, 20.9 MB
- **0 objects** in the public `pyq` bucket — nothing is visible to a student
  until a moderator approves it in `app/moderation.tsx`
- 40 `pyq_moderation_log` entries (`action = 'import'`), each naming the
  provenance of that row's metadata

Filed by browse key: `SOVSAS/UFT/I` 9, `SOVSAS/BHP/I` 7, `SOICT/BCA/I` 6,
`SOICT/BIT/III` 5, `SOICT/MCA/I` 4, `SOICT/BCA/III` 2, `SOICT/MCA/II` 2,
`SOBT/UFS/I` 2, `SOICT/BIT/IV` 1, `SOICT/ICS/III` 1. Years 2023–2026; 33 end-sem,
6 mid-sem. Subjects: FTMA101, PH111, BCA101, IT301, the MCA-side MDS101 / MDS203
/ MCB003 / BCA315, plus BTBFS101, IT311, IT409 and CS325.

## What is still blocked (122 files)

| reason | files | what it needs |
| --- | --- | --- |
| the catalogue cannot name the folder | 52 | a subject code — 18 folders, each with its candidates listed in `owner-review.md` |
| the timetable offers the subject to several programmes | 51 | one programme code per subject (CS303, CS301, CSE205, CS205, CSE207, CS521, EC101, CS101, CS307, EN101, MA201…) |
| no year or no exam type anywhere | 45 | one value per row — 33 lack a year, 34 lack an exam type |
| `.docx` mock tests | 2 | out of scope by policy |

Plus one duplicate: the two byte-identical `CD201_2024-25_mid_sem` files, already
counted once. `owner-review.md` also lists (a) the folders that resolved on a
*name* rather than a code, so those subject choices can be confirmed before
approval, and (b) the same file sitting in two folders that claim different
subjects (`C_programming` vs `C_programming_CS101`).

## Answering the open questions

Two places, both plain text:

1. `scripts/pyq-import/import-answers.csv` — one row per file, columns
   `folder,file,subjectCode,school,programmeCode,semester,year,examType`. A
   filled-in cell counts as evidence, so that row becomes importable. This is
   the tool for one-off corrections.
2. `scripts/pyq-import/overrides.json` — the curated folder registry, the place
   for a decision covering a whole folder. It only ever names a code that exists
   in `catalogue.json`.

Then re-run the plan (`node scripts/pyq-import/importPyq.js`) and, when
`owner-review.md` looks right, `--apply --tier=all`. Already-imported rows are
skipped, so the command is safe to repeat.

## Notes

- The archive's own codes (`CD201`, `CD203`, `CD205`, `CD207`, `CD209`, `CD302`,
  `CD304`, `CD306`, `CD310`, `CS522`, `EE102`) are **not** in today's catalogue —
  they are earlier course numbers. A file carrying one resolves through its
  folder instead, and the migration shows up in the row's provenance note.
- The first draft of `overrides.json` put a *school* (`SOICT`) into
  `programmeCode`. The catalogue now decides programme and semester; an override
  states them only when the owner does.
- The counts in this document come from `import-manifest.json`, which the plan
  rewrites on every run — treat that file, not this page, as the current count.