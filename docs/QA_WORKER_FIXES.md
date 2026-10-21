# QA — Worker change detection & notice dates (six real bugs, fixed)

QA note for `worker/timetableJob.ts`, `worker/noticesJob.ts`, `worker/supabaseClient.ts`
and `src/features/timetable/timetableProvider.ts`.

Verified live on **22 October 2026** from a Windows host (PowerShell, Node 24, read-only
`GET`s only). Every number below was produced against the real university data, before and
after the fix.

---

## 1. The live data used

| Source | URL | Payload |
|---|---|---|
| Samay schedule API (the worker's `baseUrl`) | `https://samay.mygbu.in/api.php` | **4,277 rows**, **151 sections**, one `SessionId` (`39`) |
| Legacy schedule API (fallback) | `https://mygbu.in/schd/api.php` | 4,281 rows, 152 sections (slightly newer snapshot) |
| University notices page | `https://www.gbu.ac.in/page/notices` | **214 rows**, every one of them in the shape `DD Mon YYYY` |

Facts that drive the bugs below, all measured on the live payload:

- `TimeTableId` is the **constant `"23001"`** on all 4,277 rows — it identifies nothing.
- `TTId` is *not* unique per slot: 135 `(section, day, period, subject)` groups hold more
  than one row, and 101 of them differ in room or teacher. Inside a section, `TTId` repeats
  89 times.
- The repeated rows are the same class published twice — one row with the room, one with
  `RoomName: null` / `Room_Id: 0` (e.g. `BEE-II | day 1 | period 2 | EE201`).
- `?schd=40` returns the **same** payload as `?schd=39`; the parameter is ignored and every
  row carries `SessionId: "39"`. There is no session 40 in the data.

---

## 2. Summary

| # | Bug | Before | After |
|---|---|---|---|
| 1 | 38 false `room_changed` diffs on a no-op poll | 38 diffs / 6 classes | **0 diffs** |
| 2 | Teacher swap never detected (diff *and* hash) | 0 real diffs, hash unchanged | **1 diff**, hash changes |
| 3 | Every main notice dated "today" | 214/214 wrong, 9 false pushes | **214/214** right, 9 false pushes gone |
| 4 | Session `40` stored as a copy of session `39` | 302 classes scanned, `SECTION#40` stored | **151** scanned, `40` reported empty |
| 5 | `slot.id` was the constant `23001` | 1 distinct id for 42 slots | **42 distinct ids**, stable |
| 6 | A failed snapshot read silently disabled detection | read error swallowed | read error **aborts the run** |

---

## 3. Bug 1 — 38 false "room changed" diffs on a no-op poll

**Where:** `computeTimetableDiff()` in `src/features/timetable/timetableProvider.ts`.

**What was wrong.** The old engine matched old↔new rows with `findIndex` on
`(day, period, subject)`, so it always paired the *last* new duplicate with the *first* old
duplicate. For a slot published twice (one row with the room, one without) it produced two
diffs that cancelled each other out — but both were still reported, and both were pushed to
the students' phones. Six classes were affected: `BAI-II-B` (4), `BAI-III-B` (4), `BEE-II`
(2), `MBA-I-A` (10), `UBT-I-A` (12), `UBT-I-B` (6).

**What changed.** Rows are no longer paired positionally. A *logical slot* is the group of
rows with the same `(day, period, subject)`, and every attribute inside that group is
compared as a **multiset**:

- `groupSlotsByKey()` groups the rows of one logical slot.
- `collectAttribute()` reads one attribute of every row of the group. A row that does not
  carry the attribute at all (the room-less copy) contributes nothing — it says "unknown",
  not "no room".
- `pairAttributeValues()` cancels the equal values out; whatever is left over is a change.

**Live result (Samay API, 4,277 rows, 151 sections):**

| Poll | Before | After |
|---|---|---|
| no-op (identical data) | 38 diffs over 6 classes | **0 diffs** |
| one slot's room changed | 39 diffs (38 false + 1 real) | **1 diff** — `Operating System room changed to ZZTEST999 (was IL101)` |

---

## 4. Bug 2 — teacher changes were never detected

**Where:** `computeTimetableDiff()` and `buildTimetableHash()` / `computeChangeKey()` in
`worker/timetableJob.ts`.

**What was wrong.** The diff only compared the room, and the stored hash only covered day,
period, subject code, room and type. A teacher swap therefore produced **zero** diffs and
**zero** push, and the stored baseline did not even notice it.

**What changed.**

- The diff now compares `faculty` as well, as a multiset inside the logical slot.
- The hash now covers `faculty` and the subject *title* as well, so a teacher swap changes
  the stored hash.
- `computeChangeKey()` includes the changed attribute and the teacher, so a teacher swap is
  a different change from a room move of the same slot (the push is not suppressed as a
  duplicate).
- `formatTimetableChangeNotification()` says "teacher changed to …" for such a diff.

**Live result:**

| Change | Before | After |
|---|---|---|
| teacher swap | 0 real diffs (only the 38 false ones) | **1 diff** — `Operating System teacher changed to ZZ Test Teacher (was Prashant Gaurav)` |
| hash after a teacher swap | unchanged | **changed** |

---

## 5. Bug 3 — every main notice lost its published date

**Where:** `enrichScrapedNotice()` in `worker/noticesJob.ts` (new helper
`parseGbUNoticeDate()`).

**What was wrong.** The date was split on `[/.-]` and only a purely numeric shape was
understood. The notices page publishes `DD Mon YYYY` (`21 Oct 2026`) — 214 of 214 live rows
— so every one of them fell through to `postedAt = now`. `calculateNoticeImportance()` then
added "+1 within 48 hours" to all of them: **152 notices got an inflated importance** and
**9 notices crossed the push threshold** (importance ≥ 3) only because of the bug.

**What changed.** `parseGbUNoticeDate()` understands every shape GBU publishes:

| Shape | Example | Source |
|---|---|---|
| `DD Mon YYYY` | `21 Oct 2026`, `21 oct 2026` | main notices table |
| `DD-MM-YYYY` | `01-7-2026` (month **not** padded) | exams portal (`Posted on: 01-7-2026`) |
| `DD/MM/YYYY` | `17/10/2026` | older GBU pages |
| `YYYY-MM-DD` | `2026-10-18` | written by the worker itself |

A date that cannot be read is still "posted now" — the notice is real, only its date is
unknown.

**Live result (214 rows of `https://www.gbu.ac.in/page/notices`):**

| | Before | After |
|---|---|---|
| rows whose `posted_at` changed | 0 | **214** |
| rows with an inflated importance | — | **152** (the inflated ones) |
| notices above the push threshold | 148 | **139** — the 9 false pushes are gone |

Example: `01 Oct 2026` → `2026-10-01T06:00:00.000Z` (before: `2026-10-21T21:37Z`, i.e.
"now"), importance 4 → 3.

---

## 6. Bug 4 — session "40" was a phantom duplicate of session 39

**Where:** `buildTimetableFromRawItems()` and `TimetablePollerJob.pollAndComputeDiffs()` in
`worker/timetableJob.ts`, plus the new `rowBelongsToSession()` helper in
`src/features/timetable/timetableProvider.ts`.

**What was wrong.** `?schd=40` returns the payload of session 39 (the parameter is ignored;
every row carries `SessionId: "39"`). The worker did not filter on `SessionId`, so it stored
a byte-identical copy of session 39 under the key `SECTION#40` and counted every class
twice: `totalClassesScanned` was 302 for 151 classes.

**What changed.**

- Rows are filtered by the session they name (`rowBelongsToSession()`); a row without a
  session id is kept, because it cannot be attributed to another session.
- A session whose rows all belong to another session is reported as **empty**
  (`emptySessions`) and is **not** stored — no `SECTION#40` row, no second copy.
- A snapshot of such a session that is already in the store (written by the old bug) is
  dropped, so the phantom does not survive in the stored payload either.
- `totalClassesScanned` counts the classes of the sessions that actually have data.

**Live result:** `totalClassesScanned` 302 → **151**, `emptySessions: ["40"]`,
stored snapshots 151 (all `…#39`), no `…#40`.

> **Correction to `docs/OPEN_QUESTIONS.md` #1:** session `40` is *not* the next semester.
> The API ignores the parameter; the data contains exactly one session (`39`). The worker
> now reports session `40` as "no data of its own" instead of copying session 39. A real
> session 40 will only appear when the university publishes one.

---

## 7. Bug 5 — `slot.id` was not an identifier

**Where:** `buildTimetableFromRawItems()` (worker) and `rawToTimetable()` (app side), both
using the new `buildStableSlotIds()` in `src/features/timetable/timetableProvider.ts`.

**What was wrong.** The worker used `item.TimeTableId` for the slot id — the constant
`"23001"` on every row. The app's `applyDiffsToTimetable()` keys its change-note map on
`slot.id`, so every diff of a class collided on one key and only one slot ever got a
change note. (`TTId` is not a fix either: it repeats 89 times *inside* a section.)

**What changed.** The id is derived from the values that make a slot unique — day, period,
subject code, room and teacher — with a counter for rows that are identical in all of them:

```
d1|p1|CSE209|IL101|PRASHANT GAURAV
d1|p1|CSE209||PRASHANT GAURAV|1     <- the room-less copy of the same slot
```

The id is stable across polls (an unchanged timetable always produces the same ids), so a
poll never looks like "every slot removed and re-added", and a change note lands on the
right slot.

**Live result:** 42 slots → **42 distinct ids** (before: 1). A mutated room produces exactly
one marked slot: `Operating System | d1 p1 | ZZTEST999 | Operating System room changed to
ZZTEST999 (was IL101)`.

---

## 8. Bug 6 — a failed snapshot read silently disabled change detection

**Where:** `fetchTimetableSnapshots()` in `worker/supabaseClient.ts` and
`TimetablePollerJob` in `worker/timetableJob.ts`.

**What was wrong.** The read swallowed every error and returned an empty map. The poller
then treated every class as "no previous snapshot" → zero diffs for that cycle → and
overwrote the stored snapshot with the new data. The change was lost for good, and the run
looked perfectly healthy.

**What changed.**

- `readTimetableSnapshots()` (new) returns `{ ok, snapshots, error }` and tells an empty
  table (`ok: true`, no rows — a cold start) apart from a failed read (`ok: false`).
- `fetchTimetableSnapshots()` keeps its signature but **throws** when the read failed, so
  the caller can no longer mistake a failure for a cold start. `worker/run.ts` already
  wraps the stage in `try/catch`, so the run now stops before the diff and before the
  snapshot write, logs `worker_timetable_error` and records an error run.
- `TimetablePollerJob.markBaselineUnavailable(reason)` makes the poller refuse to diff and
  to write. The result then reports `aborted: true`, `abortReason` and
  `baselineLoaded: false`, and the worker logs the reason.

**Live result:** with the baseline marked unavailable the poller returns
`aborted: true`, `changes: 0`, `totalClassesScanned: 0` and **writes no snapshot**.

---

## 9. Which fields the diff compares, and why

| Field | Compared | Reported as | Why |
|---|---|---|---|
| `room` | yes (multiset per slot) | `room_changed` / `changedField: 'room'` | students have to know where to go |
| `faculty` | yes (multiset per slot) | `room_changed` / `changedField: 'faculty'` | a teacher swap changes who takes the class |
| `subject` (title) | yes | `room_changed` / `changedField: 'subject'` | the university sometimes renames a subject in place (all 783 live subject codes have exactly one title, so this is stable) |
| `type` (lecture / lab / tutorial) | yes | `room_changed` / `changedField: 'type'` | a lecture that becomes a lab changes the shape of the slot |
| day + period | yes | `moved` | the class moved in the week |
| the slot itself | yes | `added` / `removed` | a class was added or cancelled |

`TimetableDiffItem` keeps its four `type` values (`added`, `removed`, `moved`,
`room_changed`) so that every screen which only knows those keeps working. The new
**optional** `changedField` says which attribute a `room_changed` diff is about.

---

## 10. Reproducing the verification

```bash
# 1. the live payloads
curl -s https://samay.mygbu.in/api.php  -o sched.json     # 4,277 rows, 151 sections
curl -s https://www.gbu.ac.in/page/notices -o notices.html # 214 rows

# 2. build the snapshot twice from identical data and diff it
#    (worker/timetableJob.ts -> buildTimetableFromRawItems,
#     src/features/timetable/timetableProvider.ts -> computeTimetableDiff)
#    before: 38 diffs over 6 classes   after: 0 diffs

# 3. mutate one row's room / teacher and diff again
#    before: 39 diffs (38 false) / 38 diffs (no real one)
#    after:   1 diff / 1 diff
```

The unit tests cover the same ground with fixtures: `tests/timetable.test.ts` (duplicated
slot, teacher swap, renamed subject, lecture→lab, added/removed), `tests/timetable_worker.test.ts`
(session filter, stable ids, hash, empty session, aborted baseline, snapshot read) and
`tests/notices_worker.test.ts` (the date shapes).

---

## 11. Notes for the owners of the files that were not touched

1. **`worker/run.ts`** — the safety net is already in place: `fetchTimetableSnapshots()`
   now throws on a failed read and the existing `try/catch` aborts the stage. To also get
   the failure into the returned summary, replace the call with
   `readTimetableSnapshots()` and forward it:
   ```ts
   const read = await readTimetableSnapshots();
   if (!read.ok) job.markBaselineUnavailable(read.error ?? 'unknown error');
   else for (const [classKey, row] of read.snapshots) { /* … */ }
   ```
   `TimetableWorkerResult` also gained the additive fields `emptySessions`,
   `failedSessions`, `baselineLoaded`, `aborted` and `abortReason` — worth logging next to
   `worker_timetable_scanned`.
2. **`app/(tabs)/index.tsx` + `src/components/timetable/TimetableChangeModal.tsx`** — the
   modal still shows the badge `ROOM RESCHEDULED` for every attribute change. Widening
   `TimetableChangeModalProps['changeType']` with the new kinds (and reading
   `diff.changedField`) would give a teacher swap its own badge. The diff type union itself
   was deliberately **not** changed, so no app code has to be edited for the fix to work.
3. **`worker/sources.config.ts`** — `activeSemesters: ['39', '40']` still asks for session
   40. That is fine now: the worker reports it as empty instead of copying session 39.
   Removing it would save one HTTP request per run.
