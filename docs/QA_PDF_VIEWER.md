# QA — Notice PDF viewer (in-app render + native handoff)

QA note for `src/components/pdf/PdfViewer.tsx`, `src/components/pdf/PdfViewerScreen.tsx`,
`src/components/pdf/pdfHelpers.ts`, `app/pdf.tsx` and `app/notice/[id].tsx`.

**Reported symptom:** "the view pdf option is not working. The pdf should render inside or maybe it
gives the command so that Native pdf reader of Android should start".

**Status:** implemented. `npm run typecheck` clean, `npm run lint` clean, `npm test` green
(24 suites / 388 tests, of which 35 are the new `tests/pdf_viewer.test.ts`).

---

## 1. Why the old button could never work

The old "View Document" action called `Linking.openURL(notice.fileUrl)` and nothing else. There
was no viewer and no download: the university link was handed to whatever app the OS picked, and
the app itself could never show a page of a circular.

On top of that, the university download endpoint is unreliable in two specific, repeatable ways.
`www.gbu.ac.in/Admissions/DownloadFile` answers with:

| Failure | HTTP status | Body | What the client sees |
|---|---|---|---|
| Broken download service | **500** | a PDF that renders *"Error / An error occurred while processing your request"* | a "PDF" that will not open |
| Withdrawn or renamed file | **200** | ~38 KB of HTML reading *"404 - Page not found"* | a "successful" download of a web page |

The second one is the nastier of the two: at the HTTP layer it looks like a perfect download, so
any client that trusts the status code ends up feeding an HTML page to the PDF renderer and the
student gets a blank screen or a crash.

---

## 2. What the fix does

### Download first, render second

`PdfViewer` never points the renderer at the network. It downloads the file into
`ReactNativeBlobUtil.fs.dirs.CacheDir` first, and only hands the local `file://` path to
`react-native-pdf` once the file has passed every check.

### The three checks on a finished download

| Check | Helper | Rejects |
|---|---|---|
| HTTP status | `response.info().status` | 4xx / 5xx responses |
| First bytes | `isProbablyPdf(head)` | HTML bodies, including both GBU error pages |
| File size | `size >= MIN_PDF_BYTES` (1024) | truncated or stub files |

The head of the file (2 KB) is read separately with `fs.slice` + `fs.readFile`, so a 5 MB circular
is never decoded as text. When a check fails, the downloaded file is deleted straight away and the
student gets one plain sentence saying what the server did, plus two buttons: **Open in another
app** and **Try again**.

### Native handoff

The error state is never a dead end:

- **Android** — `ReactNativeBlobUtil.android.actionViewIntent(path, 'application/pdf', …)` fires
  an `ACTION_VIEW` intent for the local file, which is exactly the "native PDF reader of Android
  should start" case. The library ships its own `FileProvider` (`${applicationId}.provider`,
  with `cache-path` coverage) so this works on Android 7+ without any manifest work of ours.
- **iOS / anything else** — `Linking.openURL(url)` opens the original university link, because iOS
  cannot open a `file://` URL through `Linking`.
- If no app accepts the file, the screen says so instead of failing silently.

### Page navigation

`react-native-pdf` reports the visible page through `onPageChanged`; the toolbar shows
*"Page x of y"* and the chevrons move through the document. The page prop is 1-based, matching
the library's own contract.

### Cleanup

Every download is deleted when the viewer unmounts, when the URL changes and when a check fails,
so the cache does not fill with copies of circulars.

---

## 3. The notice screen

`app/notice/[id].tsx` now offers two clearly separated actions:

| Attachment | Action 1 | Action 2 |
|---|---|---|
| PDF | **View PDF** (primary) → pushes `/pdf?url=…&title=…` | **Open in another app** (outline) → `Linking.openURL` |
| Image | inline `Image` preview in the notice | **Open in another app** (primary) |
| Plain link | — | **Open in another app** (primary) |
| No / unsafe link | — | — |

The old fake **Download PDF** button (a 900 ms timer that opened the browser and pretended to
download) is gone: the real download now happens inside the viewer, where its progress is shown.

The attachment kind is decided from the notice's own `fileType` and from the URL itself. The URL
check has to look at the whole string, because the main portal hides the real file name in the
query string:
`https://www.gbu.ac.in/Admissions/DownloadFile?nName=21370280_a0c8e722.pdfNCC%20Enrollment…pdf`.

---

## 4. Files and exported API

### `src/components/pdf/pdfHelpers.ts` (new)

Pure, no React and no native imports, so it is unit testable under plain Node.

| Export | Purpose |
|---|---|
| `isProbablyPdf(bytes: string): boolean` | the `%PDF` magic |
| `looksLikeSoft404(text: string): boolean` | the GBU "404 - Page not found" body |
| `isPdfErrorPage(text: string): boolean` | the GBU "Error / An error occurred…" body |
| `describeDownloadProblem(status, head, byteLength): string` | one actionable sentence per failure |
| `isSafePdfUrl(url: string): boolean` | `http`/`https` only |
| `hostOfUrl(url: string): string` | host of an absolute URL (RN's `URL` polyfill throws on `.host`) |
| `buildCacheFileName(url: string): string` | stable, collision-free cache name |
| `looksLikePdfUrl(url): boolean`, `looksLikeImageUrl(url): boolean` | attachment kind |
| `MIN_PDF_BYTES`, `PDF_MIME_TYPE` | constants |

### `src/components/pdf/PdfViewer.tsx` (new)

- `export interface PdfViewerProps { url: string; onClose?: () => void; title?: string; subtitle?: string }`
- `export const PdfViewer: React.FC<PdfViewerProps>`
- `export default PdfViewer`

Toolbar (close, title, source host) → content (progress bar / error card / PDF) → page controls.

### `src/components/pdf/PdfViewerScreen.tsx` (new)

- `export const PdfViewerScreen: React.FC`
- `export default PdfViewerScreen`

Reads `/pdf?url=…&title=…`, validates the URL with `isSafePdfUrl` **before** fetching anything,
and renders a themed header (back, title) above the viewer. A `file://`, `javascript:` or
`content://` URL is refused with a message and no request is made.

### `app/pdf.tsx` (new)

- `export default function PdfRoute()` — the Expo Router route, which mounts `PdfViewerScreen`.

### `app/notice/[id].tsx` (edited)

- `handleViewPdf()` → `router.push({ pathname: '/pdf', params: { url, title } })`
- `handleOpenExternally()` → `Linking.openURL(fileUrl)`, with a Toast when no app handles it
- The old `handleOpenDoc()` / `handleDownload()` pair and the `downloading` / `downloadSuccess`
  state are removed.

---

## 5. Route to register in `app/_layout.tsx`

```tsx
<Stack.Screen name="pdf" options={{ animation: 'slide_from_right' }} />
```

- **Route name:** `pdf`
- **Params:** `url` (required, the absolute `http(s)` document URL) and `title` (optional, the
  document title shown in the header)
- **Full path:** `/pdf?url=<encoded>&title=<encoded>`

---

## 6. Manual QA checklist (device)

1. Open a notice with a real PDF attachment → **View PDF** opens the in-app viewer.
2. The progress bar fills, then the first page renders.
3. Swipe between pages; the counter reads *"Page x of y"*; the chevrons jump a page.
4. The back arrow and the ✕ both leave the screen.
5. Pull the plug (airplane mode) before opening a notice → the error card appears with
   **Try again**; with the network back, **Try again** succeeds.
6. Open a notice whose file the portal serves as the soft 404 → the message names the
   *"404 - Page not found"* page and **Open in another app** still opens the university link.
7. On a device with a PDF reader installed, trigger the same error and use
   **Open in another app** → the native PDF reader / chooser starts.
8. Leave the viewer on a large circular, then check `adb shell du -sh /data/data/in.gbu.one/cache`
   → no `gbu-document-*.pdf` file is left behind.
9. Repeat steps 1–4 in dark mode → the chrome follows the theme.

---

## 7. Native modules and the Android release build

Versions chosen by `npx expo install` (SDK 52 / RN 0.76):

| Package | Version | Notes |
|---|---|---|
| `react-native-pdf` | **7.0.5** | TurboModule/Fabric component `RCTPdfView` |
| `react-native-blob-util` | **0.25.1** | TurboModule `ReactNativeBlobUtil` |

Things to watch for in the build log:

1. **JitPack is needed at build time.** `react-native-pdf` depends on
   `com.github.zacharee:AndroidPdfViewer:4.0.1` (JitPack) and `io.legere:pdfiumandroid:1.0.32`
   (Maven Central). The Gradle build must be able to reach `jitpack.io`; on an offline or
   firewalled build machine the release build fails during dependency resolution with
   *"Could not find com.github.zacharee:AndroidPdfViewer:4.0.1"*. That is the single most likely
   new build failure.
2. **New Architecture is on.** `android/gradle.properties` has `newArchEnabled=true`, and both
   libraries support it (`react-native-pdf` ships `fabric/`, `react-native-blob-util` switches
   between `src/newarch` and `src/oldarch` from the same property). If the codegen output is
   stale after adding the packages, run `npx expo prebuild --clean` (or delete `android/build`)
   — otherwise the app can crash on opening the viewer with
   *"View config getter callback for component `RCTPdfView` must be a function"*.
3. **The library ships its own manifest.** `react-native-blob-util` merges a `FileProvider` with
   the authority `${applicationId}.provider`. If the manifest merge ever fails, `actionViewIntent`
   throws *"Failed to find configured root"* — the in-app viewer still works, only the native
   handoff breaks.
4. **`app.json` gained a plugin entry.** `npx expo install` added `"react-native-blob-util"` to
   `expo.plugins`. The plugin only wires custom CA certificates and is a **no-op** with the
   current configuration, so it can be left in place or removed — it does not affect the build.
5. **Lint is fatal inside `react-native-pdf`.** Its `android/build.gradle` sets
   `lintOptions { abortOnError true }`, so a lint finding in the library fails the build.
6. **`minSdkVersion` 24** (app) is above the library's own minimum of 21 — no problem.
7. **A device without a PDF reader** can still use the in-app viewer; only the native handoff
   needs another app installed. On a bare emulator, expect the *"No app on this device could open
   the document"* message.

---

## 8. Test coverage

`tests/pdf_viewer.test.ts` — 35 assertions over 9 helper groups, no network, no device:

| Group | Cases |
|---|---|
| `isProbablyPdf` | real header, HTML body, empty body, magic behind a BOM |
| `looksLikeSoft404` | GBU body, real document, a body with only one of the two markers |
| `isPdfErrorPage` | GBU body, real document, the soft-404 body |
| `describeDownloadProblem` | soft 404 with HTTP 200, error page with HTTP 500, HTTP 403, a non-PDF body, a 10 byte file, the fallback sentence |
| `isSafePdfUrl` | https, http, `file://`, `javascript:`, `content://`, empty, a URL smuggling a second scheme behind a newline |
| `buildCacheFileName` | stable, unique, ends in `.pdf` |
| attachment kinds | the GBU `DownloadFile` query URL, the exam portal URL, a portal home page, an image |
| `hostOfUrl` | host, host with a port, nonsense |
| `MIN_PDF_BYTES` | bigger than a stub, smaller than a circular |

---

## 9. Known limits

- A document served with a correct `Content-Type` but a broken body is still rejected — the checks
  look at the bytes, not at the headers, because the GBU endpoint lies about the status.
- iOS uses the browser handoff instead of a local file hand-off; a native iOS PDF hand-off would
  need `expo-sharing` or `expo-intent`, which are out of scope here.
- The viewer does not remember the last read page between openings.
- Password protected PDFs are not supported.
