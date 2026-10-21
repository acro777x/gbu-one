# QA — CI and worker-cron fixes

Audit of the two GitHub Actions workflows and the data-source notes, fixed on **2026-10-21**.
Files touched: `.github/workflows/ci.yml`, `.github/workflows/worker-cron.yml`, `docs/DATA_SOURCES.md`, this file.
Nothing else was modified; nothing was committed.

---

## 1. Node 20 pinned in both workflows (root cause of the red CI)

### Reproduced

`undici@8.12.3` (pinned in `package-lock.json`) declares `"engines": { "node": ">=22.19.0" }` and does not
merely warn on Node 20 — it **fails to load**:

```
$ npx node@20.19.0 -e "require('undici')"
UNDICI LOAD FAIL: TypeError Cannot read properties of undefined (reading 'bind')
    at node_modules/undici/lib/interceptor/decompress.js:78:30
```

`@supabase/supabase-js@2.118.0` throws from `createClient()` → `new RealtimeClient()` →
`getWebSocketConstructor()` on any Node without a global `WebSocket`:

```
$ npx node@20.19.0 -e "require('@supabase/supabase-js').createClient('https://example.supabase.co','k')"
CREATE_CLIENT THROWS: Node.js detected but native WebSocket not found.
```

The full CI suite on **Node 20.19.0** reproduces the red build exactly — 3 suites die at import time:

```
FAIL tests/live_queries.test.ts        ● Node.js detected but native WebSocket not found.
FAIL tests/scale_fuzz_thousands.test.ts ● Node.js detected but native WebSocket not found.
FAIL tests/pyq_storage.test.ts         ● Node.js detected but native WebSocket not found.
Test Suites: 3 failed, 20 passed, 23 total
```

Two production consequences, both confirmed:

* `worker/supabaseClient.ts` calls `createClient()` in `getWorkerSupabase()` **outside** any try/catch
  → on Node 20 the worker exits 1 the moment the Supabase secrets exist.
* `fetchWithTlsTolerance()` (`worker/noticesJob.ts:56`) `require('undici')` inside a try/catch.
  On Node 20 the require throws, the catch **silently falls back to plain `fetch`**, and the two hosts with
  expired certificates then fail on every run:

  ```
  === Node 22.19.0 ===            === Node 20.19.0 ===
  undici require: OK              undici require FAILED: Cannot read properties of undefined (reading 'bind')
  https://ohms.gbu.ac.in/ -> 200  https://ohms.gbu.ac.in/ -> ERROR fetch failed | cause: CERT_HAS_EXPIRED
  https://digiforms.gbu.ac.in/ -> 200  https://digiforms.gbu.ac.in/ -> ERROR fetch failed | cause: CERT_HAS_EXPIRED
  ```

### Fixed

Both workflows now pin **`node-version: '22.19.0'`** (the exact floor `undici` requires; 22 is also the
first LTS line with a global `WebSocket`), and both fail loudly if the runtime is ever wrong again:

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: '22.19.0'
          cache: 'npm'
      - run: npm ci || npm install
      - name: Guard - the runtime must be able to load undici and @supabase/supabase-js
        run: |
          node -e '
            const [maj, min] = process.versions.node.split(".").map(Number);
            if (maj < 22 || (maj === 22 && min < 19)) {
              throw new Error("Node >= 22.19.0 required (undici engines), got " + process.versions.node);
            }
            if (typeof WebSocket !== "function") {
              throw new Error("global WebSocket is missing - @supabase/supabase-js cannot create a client");
            }
            require("undici");
            require("@supabase/supabase-js");
            console.log("runtime ok:", process.version, "| WebSocket:", typeof WebSocket);
          '
```

The guard was executed verbatim out of the workflow file: **exit 0** on Node 22.19.0
(`runtime ok: v22.19.0 | WebSocket: function`), **exit 1** on Node 20.19.0
(`Node >= 22.19.0 required (undici engines), got 20.19.0`).

---

## 2. The cron schedule drifted and left a hole at night

### What the old schedule really did

```yaml
    - cron: '*/15 1-16 * * *'
    - cron: '7 17-23,0 * * *'
```

GitHub Actions cron is **UTC only** — there is no timezone field, so the IST window has to be written in UTC.

| Old expression | Actual firings | Actual IST | Claimed |
|---|---|---|---|
| `*/15 1-16` | 01:00–16:45 UTC | **06:30–22:15 IST** | 07:00–22:00 IST |
| `7 17-23,0` | :07 past every hour, 17:07–00:07 UTC | 22:37–05:37 IST | "hourly" |

Defects: the 15-minute window starts **30 min early** and ends **15 min late**; the hourly entry sits on an
offset (`:07`) that does not exist on the 15-minute grid, so the two halves do not form one regular schedule
and the transitions are irregular (16:45 → 17:07 = 22 min, 00:07 → 01:00 = 53 min).

### Fixed

```yaml
    schedule:
      # GitHub Actions cron is UTC-only (there is no timezone field), so the
      # 07:00-22:00 IST window is expressed in UTC as 01:30-16:30 UTC.
      # Every expression sits on the quarter-hour grid (:00 / :15 / :30 / :45),
      # so the schedule has no drift and no unscheduled hole.
      - cron: '30,45 1 * * *'          # 01:30, 01:45 UTC   = 07:00, 07:15 IST
      - cron: '0,15,30,45 2-15 * * *'  # 02:00-15:45 UTC   = 07:30-21:15 IST
      - cron: '0,15,30 16 * * *'       # 16:00, 16:15, 16:30 UTC = 21:30, 21:45, 22:00 IST
      # Outside the window: hourly, on the same quarter-hour grid.
      - cron: '30 17-23,0 * * *'       # 17:30-00:30 UTC   = 23:00-06:00 IST
```

**Exact window produced: 01:30–16:30 UTC = 07:00–22:00 IST, every 15 minutes, 61 firings, no gap.**
Outside that window the worker still runs hourly (23:00–06:00 IST) on the same grid. 69 runs/day
(the old schedule fired 72).

First 12 hours of the day (00:00–11:59 UTC), computed with a cron evaluator:

```
00:30 UTC  =  06:00 IST   <- hourly (night)
01:30 UTC  =  07:00 IST
01:45 UTC  =  07:15 IST
02:00 UTC  =  07:30 IST
02:15 UTC  =  07:45 IST
02:30 UTC  =  08:00 IST
02:45 UTC  =  08:15 IST
03:00 UTC  =  08:30 IST
03:15 UTC  =  08:45 IST
03:30 UTC  =  09:00 IST
03:45 UTC  =  09:15 IST
04:00 UTC  =  09:30 IST
04:15 UTC  =  09:45 IST
04:30 UTC  =  10:00 IST
04:45 UTC  =  10:15 IST
05:00 UTC  =  10:30 IST
05:15 UTC  =  10:45 IST
05:30 UTC  =  11:00 IST
05:45 UTC  =  11:15 IST
06:00 UTC  =  11:30 IST
06:15 UTC  =  11:45 IST
06:30 UTC  =  12:00 IST
06:45 UTC  =  12:15 IST
07:00 UTC  =  12:30 IST
07:15 UTC  =  12:45 IST
07:30 UTC  =  13:00 IST
07:45 UTC  =  13:15 IST
08:00 UTC  =  13:30 IST
08:15 UTC  =  13:45 IST
08:30 UTC  =  14:00 IST
08:45 UTC  =  14:15 IST
09:00 UTC  =  14:30 IST
09:15 UTC  =  14:45 IST
09:30 UTC  =  15:00 IST
09:45 UTC  =  15:15 IST
10:00 UTC  =  15:30 IST
10:15 UTC  =  15:45 IST
10:30 UTC  =  16:00 IST
10:45 UTC  =  16:15 IST
11:00 UTC  =  16:30 IST
11:15 UTC  =  16:45 IST
11:30 UTC  =  17:00 IST
11:45 UTC  =  17:15 IST
```

Proof of the two properties (same evaluator, full 24 h):

```
firings inside 01:30-16:30 UTC: 61 (expected 61)
largest gap inside 01:30-16:30 UTC: 15 min      <- no hole in the daytime window
largest gap between consecutive firings: 60 min  <- the intended hourly night cadence
minute-of-hour offsets used: 0, 15, 30, 45      <- everything on the quarter-hour grid, no drift
```

No `:07` firing exists any more, so the old 7-minute offset is gone, and the day window is exactly
07:00–22:00 IST (not 06:30–22:15).

### Overlap protection

```yaml
concurrency:
  group: worker-cron
  cancel-in-progress: false
```

Two 15-minute runs can no longer overlap: the second one queues behind the first instead of racing it on
the same snapshot rows. `cancel-in-progress: false` means a queued run is still executed after the first one
finishes (it is never dropped). `timeout-minutes: 10` is unchanged.

---

## 3. The worker downloaded a package from npm on every run

`tsx` is **not** in `package.json`, and it is not in `package-lock.json` either (the lockfile contains
neither `tsx`, nor `ts-node`, nor `esbuild`, nor `swc`). So `npx tsx worker/run.ts` downloaded `tsx` from npm
on **every scheduled run**, unpinned.

`package.json` is owned by someone else, so nothing was added to it. Instead the worker is compiled with the
TypeScript the repo already ships (devDependency `typescript`, pinned at **5.9.3** in `package-lock.json`) —
no npm download at run time, nothing unpinned, and a missing compiler fails loudly:

```yaml
      - name: Build the worker with the repo's own TypeScript
        run: |
          test -f node_modules/typescript/bin/tsc || { echo "::error::TypeScript is not installed - 'npm ci' must install devDependencies"; exit 1; }
          node ./node_modules/typescript/bin/tsc worker/run.ts \
            --outDir dist --rootDir . \
            --module commonjs --moduleResolution node \
            --target es2022 --lib es2022,dom \
            --esModuleInterop --allowSyntheticDefaultImports --resolveJsonModule \
            --skipLibCheck --strict --noCheck
      - name: Run notices worker
        env: ...
        run: node dist/worker/run.js
```

Notes:

* `dist/` is already in `.gitignore`, so the build output never lands in git.
* `--noCheck` (TypeScript ≥ 5.6) makes the cron build independent of app-wide type errors; `npm run typecheck`
  in CI is what guards the types. The emitted JavaScript is unaffected by type errors.
* The build is CommonJS on purpose: `worker/noticesJob.ts` uses a runtime `require('undici')`, and `undici` is
  ESM-only in some versions.
* **Alternative considered and rejected:** `sucrase@3.35.0` *is* in the lockfile (a transitive dependency) and
  its `sucrase-node` runner does work with this worker (`node node_modules/sucrase/bin/sucrase-node
  worker/run.ts` → `{"event":"worker_scraped","total":261,...}`). It was not used because it is **undeclared**
  in `package.json`: npm only hoists it by luck, and any dependency bump can remove or re-hoist it, which would
  break the cron without any warning. `typescript` is a declared, lockfile-pinned devDependency.
* Node's own type stripping (`node worker/run.ts`) is **not** an option: the worker uses extensionless relative
  imports (`./noticesJob`), which Node's ESM resolver rejects —
  `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...\worker\noticesJob'`.

The two workflow steps were executed **verbatim** out of the YAML in a POSIX shell (Git Bash on Windows):

```
=== running step verbatim in Git Bash: Build the worker with the repo's own TypeScript ===
exit: 0
=== running step verbatim in Git Bash: Run notices worker ===
exit: 0
{"event":"worker_start","at":"2026-10-21T22:00:33.633Z"}
{"event":"worker_scraped","total":261,"fresh":255,"pushCandidates":150}
{"event":"worker_push_skipped","reason":"no-supabase"}
{"event":"worker_done","ms":8043,"at":"2026-10-21T22:00:41.676Z"}
```

(The run above is parse-only because no Supabase secrets are set locally; it scraped the live GBU pages:
261 notices, 150 push candidates.)

---

## 4. Dead environment variables

| Variable | Read by the worker? | Action |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | yes (`worker/supabaseClient.ts`) | kept |
| `EXPO_ACCESS_TOKEN` | yes (`worker/pushSender.ts`) — the Expo Push API is the only push transport | kept |
| `OCR_PROVIDER` | yes (`worker/ocrService.ts`) | kept |
| `WORKER_CONTACT_EMAIL` | **no** — the User-Agent is hard-coded in `worker/sources.config.ts` (`WORKER_CONFIG.userAgent`) and in the attachment headers in `worker/run.ts` | **removed from the workflow** |
| `FCM_SERVER_KEY` | **no** — not read anywhere in `worker/`; it was not even present in the workflow file (it only appears in `.env.example`) | left alone; `.env.example` is not owned here — **the owner should delete that line** |

`WORKER_CONTACT_EMAIL` was removed because `worker/sources.config.ts` cannot be edited from this task; wiring it
would mean a code change in a file owned by someone else. The documentation was corrected instead
(`docs/DATA_SOURCES.md` now states that the User-Agent is hard-coded and that the variable is never read).

---

## 5. TLS note in `docs/DATA_SOURCES.md` corrected

The old note claimed `www.gbu.ac.in` fails with `CERT_HAS_EXPIRED`. That is wrong. Verified live on
2026-10-21 with a TLS probe (`tls.connect({ rejectUnauthorized: true })`):

| Host | Result |
|---|---|
| `www.gbu.ac.in` | **validates cleanly** — leaf `CN=*.gbu.ac.in`, SAN `DNS:*.gbu.ac.in`, issuer `SSL.com TLS Issuing RSA CA R1` (O = SSL Corporation), valid **21 Oct 2026 → 19 Jan 2027** |
| `test.gbu.ac.in` | same certificate, same validity |
| `gbu.ac.in` (bare apex) | **name mismatch** — `ERR_TLS_CERT_ALTNAME_INVALID` in Node/OpenSSL, `SEC_E_WRONG_PRINCIPAL` on Windows SChannel: the wildcard does not cover the apex |
| `exams.gbu.ac.in` | 200, Let's Encrypt, valid to 15 Dec 2026 |
| `ohms.gbu.ac.in` | `CERT_HAS_EXPIRED` |
| `digiforms.gbu.ac.in` | `CERT_HAS_EXPIRED` |

The doc now distinguishes the three cases (apex name mismatch ≠ expiry; the two expired hosts), records the
current expiry date, and warns that the worker's plain-`fetch` fallback is a silent data-loss trap on Node 20.

Other facts re-verified and recorded in the same file: `www.gbu.ac.in/page/notices` and
`test.gbu.ac.in/page/notices` are **byte-identical** (147,326 bytes, SHA-256
`b6b9a6970e04aad27a694b07f9444f1a933b60c84ad0bd8d4a9e0a3e05073ef8`); `mygbu.in/schd/api.php` (3,182,982 bytes)
and `samay.mygbu.in/api.php` (3,180,079 bytes) both return 200 with the same timetable dataset.

---

## 6. Verification summary

YAML syntax — parsed with **PyYAML 6.0.3** (`yaml.safe_load`) and cross-checked with **js-yaml** (already in
`node_modules`); both files load, and the parsed structures are exactly as intended:

```
OK .github/workflows/ci.yml        | top-level keys: ['name', 'on', 'jobs']
   job check | runs-on: ubuntu-latest
      - actions/checkout@v4
      - actions/setup-node@v4
      - npm ci || npm install
      - Guard - the runtime must be able to load undici and @supabase/supabase-js
      - npm run typecheck
      - npm run lint
      - npm test
OK .github/workflows/worker-cron.yml | top-level keys: ['name', 'on', 'concurrency', 'jobs']
   on: {'schedule': [{'cron': '30,45 1 * * *'}, {'cron': '0,15,30,45 2-15 * * *'},
                     {'cron': '0,15,30 16 * * *'}, {'cron': '30 17-23,0 * * *'}], 'workflow_dispatch': None}
   concurrency: {'group': 'worker-cron', 'cancel-in-progress': False}
   job scrape | timeout-minutes: 10 | runs-on: ubuntu-latest
```

Test suite — run exactly as CI runs it, under the exact pinned runtime (**Node 22.19.0**):

```
$ npx node@22.19.0 node_modules/typescript/bin/tsc --noEmit            -> exit 0
$ npx node@22.19.0 node_modules/eslint/bin/eslint.js . --ext .js,.jsx,.ts,.tsx -> exit 0
$ npx node@22.19.0 node_modules/jest/bin/jest.js
Test Suites: 23 passed, 23 total
Tests:       353 passed, 353 total
```

CI will therefore run, on the pushed workflow:

```yaml
      - run: npm ci || npm install
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
```

on `ubuntu-latest` with **Node 22.19.0** — the same three commands that pass locally above.

---

## 7. Still needed in `package.json` (owner action — nothing was changed here)

1. **Optional, recommended — add the worker runner to the repo** so the cron does not need a build step at all:

   ```json
   "devDependencies": { "tsx": "^4.19.2" },
   "scripts": { "worker": "tsx worker/run.ts" }
   ```

   and then the workflow's build step can be replaced by `npm run worker`. With `tsx` in `devDependencies` and
   in `package-lock.json`, `npm ci` installs it and the cron no longer touches npm at run time.

2. **Required if `npm ci` ever fails to keep the lockfile in sync** — today `npm ci` succeeds (the lockfile is in
   sync), and the workflow keeps `npm ci || npm install` as a fallback so a `package.json` edit from another
   owner cannot turn the cron red.

3. **Delete `FCM_SERVER_KEY=` from `.env.example`** — it is dead (the worker pushes through the Expo Push API
   with `EXPO_ACCESS_TOKEN`). `.env.example` is not owned by this task.

4. **Optional — `WORKER_CONTACT_EMAIL`**: either delete it from `.env.example` as well, or wire it into
   `worker/sources.config.ts` (`WORKER_CONFIG.userAgent`) and add it back to the workflow. Today it is read
   nowhere.
