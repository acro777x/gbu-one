/**
 * GBU One — live notice fetching and parsing.
 *
 * WHY THIS FILE EXISTS: the notices screen used to render the bundled
 * `MOCK_NOTICES` sample from `noticeService.ts` because no Supabase project is
 * wired up yet, so the app showed invented notices. This module fetches the
 * REAL public GBU notice pages straight from the device and parses them, so the
 * screen shows what the university actually published. The bundled sample is
 * only ever an offline fallback, and must be labelled as a sample.
 *
 * Deliberately free of React and of native-only imports: the parsers are pure
 * functions so they can be unit tested under plain Node/Jest
 * (see `tests/live_notices.test.ts`). No `fs`, no `Buffer`, no `require`.
 *
 * Source A — https://www.gbu.ac.in/page/notices
 *   One `<table>` with a `Date | Title` header and 214 data rows, newest first.
 *   Each row: `<td>21 Oct 2026</td><td><a href="/Admissions/DownloadFile?nName=...">Title</a></td>`.
 *   Never use the apex host `gbu.ac.in`: its wildcard certificate (`*.gbu.ac.in`)
 *   does not cover the apex, so TLS hostname validation fails.
 *
 * Source B — https://exams.gbu.ac.in/
 *   Static HTML. 31 `div.notice-item` blocks (11 visible + 20 inside
 *   `div#allNotices[style="display:none"]`), so no JavaScript execution is needed.
 */

export const MAIN_NOTICES_URL = 'https://www.gbu.ac.in/page/notices';

/** Byte-identical mirror of {@link MAIN_NOTICES_URL}, used when the primary host is unreachable. */
export const MAIN_NOTICES_MIRROR_URL = 'https://test.gbu.ac.in/page/notices';

export const EXAM_NOTICES_URL = 'https://exams.gbu.ac.in/';

export type LiveNoticeSource = 'main' | 'exams';

export type LiveNoticeCategory =
  | 'exam'
  | 'datesheet'
  | 'result'
  | 'fees'
  | 'scholarship'
  | 'hostel'
  | 'admission'
  | 'academic'
  | 'event'
  | 'other';

/** A notice parsed out of one of the live public GBU pages. */
export interface LiveNotice {
  /** Stable id derived from source + title + attachment URL. */
  id: string;
  /** Which public page the notice came from. */
  source: LiveNoticeSource;
  /** The exact page URL the notice was parsed from. */
  sourceUrl: string;
  /** Notice title with markup stripped and whitespace collapsed. */
  title: string;
  /** Publication date as ISO-8601 UTC, or null when the page had no usable date. */
  postedAt: string | null;
  /** The date exactly as published (e.g. `21 Oct 2026`, `07-10-2026`). */
  postedOn: string | null;
  /** Absolute URL of the attachment, or null when the notice has no file link. */
  fileUrl: string | null;
  /** `file` = downloadable attachment, `modal` = JS-only link, `none` = no link at all. */
  attachmentKind: 'file' | 'modal' | 'none';
  /** Anchor text of the link, e.g. `View Attachment`. */
  attachmentLabel: string | null;
  /** True when the exam portal marks the notice with a `New` badge. */
  isNew: boolean;
  /** Coarse category for filtering. */
  category: LiveNoticeCategory;
  /** 0 (noise) to 5 (act now). */
  importance: number;
  /** Extra absolute URLs recovered for JS-only notices (school-wise date sheets). */
  relatedUrls: string[];
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  rupee: '₹',
  times: '×',
  eacute: 'é',
  egrave: 'è',
};

const NON_HTTP_SCHEME_RE = /^(?:javascript|mailto|tel|sms|data|blob|about):/i;

/**
 * Decodes HTML entities (`&amp;`, `&nbsp;`, `&#39;`, `&#x2013;`, …) in a single
 * pass. Unknown entities are left untouched so nothing is silently dropped.
 */
export function decodeEntities(input: string): string {
  if (!input) return '';
  return input.replace(/&(#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi, (match, body: string) => {
    if (body.charAt(0) === '#') {
      const isHex = body.charAt(1) === 'x' || body.charAt(1) === 'X';
      const parsed = Number.parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 0x10ffff) return match;
      try {
        return String.fromCodePoint(parsed);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? match : named;
  });
}

/** Removes tags and collapses whitespace; entities are decoded afterwards. */
function toPlainText(input: string): string {
  if (!input) return '';
  const withoutTags = input.replace(/<[^>]*>/g, ' ').replace(/<[^>]*$/, ' ');
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

/** Removes `<script>` / `<style>` blocks so their markup is never mistaken for content. */
function stripScriptBlocks(html: string): string {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
}

function encodePathPreservingEscapes(path: string): string {
  return path.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@%/]/g, (ch) => encodeURIComponent(ch));
}

function normalizePathSegments(path: string): string {
  const leadingSlash = path.startsWith('/');
  const trailingSlash = path.length > 1 && path.endsWith('/');
  const segments = path.split('/');
  const kept: string[] = [];
  for (const segment of segments) {
    if (segment === '.') continue;
    if (segment === '..') {
      if (kept.length > 0) kept.pop();
      continue;
    }
    kept.push(segment);
  }
  let result = kept.join('/');
  if (leadingSlash && !result.startsWith('/')) result = `/${result}`;
  if (trailingSlash && !result.endsWith('/')) result += '/';
  return result || '/';
}

function directoryOf(path: string): string {
  if (!path) return '/';
  const index = path.lastIndexOf('/');
  if (index < 0) return '/';
  return path.slice(0, index + 1) || '/';
}

interface SplitUrl {
  origin: string;
  path: string;
  query: string;
  hash: string;
}

function splitUrl(url: string): SplitUrl | null {
  const match = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)([^?#]*)([^#]*)(#.*)?$/i.exec(url);
  if (!match) return null;
  return {
    origin: match[1],
    path: match[2] || '',
    query: match[3] || '',
    hash: match[4] || '',
  };
}

/** Splits a URL or path into path, query and fragment without touching the query. */
function splitPathQueryHash(raw: string): { path: string; query: string; hash: string } {
  const hashIndex = raw.indexOf('#');
  const hash = hashIndex >= 0 ? raw.slice(hashIndex) : '';
  const withoutHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const queryIndex = withoutHash.indexOf('?');
  return {
    path: queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash,
    query: queryIndex >= 0 ? withoutHash.slice(queryIndex) : '',
    hash,
  };
}

/**
 * Resolves an `href` from one of the GBU pages against the page URL.
 *
 * Relative paths become absolute, the query string is kept **verbatim** (the
 * `nName=` value is already percent-encoded and must never be double-encoded),
 * and non-HTTP schemes such as `javascript:void(0)` return `null` because they
 * are not downloadable files.
 */
export function resolveAbsoluteUrl(href: string, baseUrl: string): string | null {
  const raw = decodeEntities(String(href ?? '')).trim();
  if (!raw) return null;
  if (raw.startsWith('#')) return null;
  if (NON_HTTP_SCHEME_RE.test(raw)) return null;

  const base = splitUrl(String(baseUrl ?? '').trim());
  if (!base) return null;

  let origin = base.origin;
  let path: string;
  let query: string;
  let hash: string;

  if (/^https?:\/\//i.test(raw)) {
    const absolute = splitUrl(raw);
    if (!absolute) return null;
    origin = absolute.origin;
    path = absolute.path;
    query = absolute.query;
    hash = absolute.hash;
  } else if (raw.startsWith('//')) {
    const rest = splitPathQueryHash(raw.slice(2));
    origin = base.origin.replace(/:[^/:]*$/, '');
    path = rest.path;
    query = rest.query;
    hash = rest.hash;
  } else {
    const relative = splitPathQueryHash(raw);
    path = relative.path;
    query = relative.query;
    hash = relative.hash;
    if (!raw.startsWith('/')) {
      path = `${directoryOf(base.path)}${path}`;
    }
  }

  const normalized = encodePathPreservingEscapes(normalizePathSegments(path));
  const result = `${origin}${normalized}${query}${hash}`;
  return result.length > 0 ? result : null;
}

/**
 * Classifies a notice title into a coarse bucket the app can filter on.
 * Keyword based, mirroring the style used by `noticeService.ts`.
 */
export function classifyLiveNotice(title: string): LiveNoticeCategory {
  const lower = (title ?? '').toLowerCase();

  if (
    lower.includes('tender') ||
    lower.includes('quotation') ||
    lower.includes('procurement') ||
    lower.includes('recruitment of faculty') ||
    lower.includes('corrigendum for tender') ||
    lower.includes('eoi')
  ) {
    return 'other';
  }
  if (lower.includes('datesheet') || lower.includes('date sheet')) return 'datesheet';
  if (lower.includes('result') || lower.includes('grade card') || lower.includes('mark sheet')) {
    return 'result';
  }
  if (
    lower.includes('exam') ||
    lower.includes('admit card') ||
    lower.includes('back paper') ||
    lower.includes('backpaper') ||
    lower.includes('mid sem') ||
    lower.includes('end sem') ||
    lower.includes('repeat paper') ||
    lower.includes('supplementary')
  ) {
    return 'exam';
  }
  if (lower.includes('hostel') || lower.includes('mess') || lower.includes('room allotment')) {
    return 'hostel';
  }
  if (
    lower.includes('scholarship') ||
    lower.includes('fellowship') ||
    lower.includes('freeship') ||
    lower.includes('tablet') ||
    lower.includes('smartphone') ||
    lower.includes('yojana') ||
    lower.includes('yojna') ||
    lower.includes('vikshit bharat') ||
    lower.includes('viksit bharat')
  ) {
    return 'scholarship';
  }
  if (lower.includes('fee') || lower.includes('dues')) return 'fees';
  if (
    lower.includes('admission') ||
    lower.includes('counselling') ||
    lower.includes('seat allotment') ||
    lower.includes('entrance test')
  ) {
    return 'admission';
  }
  if (
    lower.includes('academic calendar') ||
    lower.includes('holiday') ||
    lower.includes('vacation') ||
    lower.includes('semester registration') ||
    lower.includes('registration for session') ||
    lower.includes('orientation') ||
    lower.includes('induction') ||
    lower.includes('anti-ragging') ||
    lower.includes('eligib')
  ) {
    return 'academic';
  }
  if (
    lower.includes('event') ||
    lower.includes('fest') ||
    lower.includes('hackathon') ||
    lower.includes('sports') ||
    lower.includes('competition') ||
    lower.includes('cultural') ||
    lower.includes('convocation') ||
    lower.includes('placement') ||
    lower.includes('internship') ||
    lower.includes('campus drive') ||
    lower.includes('webinar') ||
    lower.includes('workshop') ||
    lower.includes('ncc') ||
    lower.includes('celebrat') ||
    lower.includes('volunteer')
  ) {
    return 'event';
  }
  return 'other';
}

const DEADLINE_KEYWORDS = [
  'last date',
  'last date extended',
  'deadline',
  'extended to',
  'date extend',
  'till ',
  'up to ',
  'due date',
];

const NOISE_KEYWORDS = ['tender', 'quotation', 'procurement', 'recruitment of faculty'];

/**
 * Scores a notice from 0 (noise) to 5 (act now).
 *
 * Deadline-bearing and exam/result notices score highest; administrative
 * tenders are pushed down. The score is a pure function of the notice so it
 * never changes between renders.
 */
export function scoreLiveNoticeImportance(
  title: string,
  category: LiveNoticeCategory,
  isNew = false
): number {
  const lower = (title ?? '').toLowerCase();
  let score = 0;

  if (category === 'exam' || category === 'datesheet' || category === 'result') score += 3;
  else if (category === 'fees' || category === 'scholarship') score += 2;
  else if (category === 'admission' || category === 'hostel' || category === 'academic') score += 1;

  if (DEADLINE_KEYWORDS.some((keyword) => lower.includes(keyword))) score += 2;
  if (isNew) score += 1;
  if (NOISE_KEYWORDS.some((keyword) => lower.includes(keyword))) score -= 3;

  return Math.max(0, Math.min(5, score));
}

function toIsoUtc(year: number, monthIndex: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null;
  if (year < 1990 || year > 2100) return null;
  if (monthIndex < 0 || monthIndex > 11) return null;
  if (day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString();
}

/** Parses `DD Mon YYYY` (source A) into an ISO-8601 UTC instant. */
function parseMainDate(text: string): string | null {
  const match = /(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/.exec(text ?? '');
  if (!match) return null;
  const month = MONTH_INDEX[match[2].toLowerCase().slice(0, 4)] ?? MONTH_INDEX[match[2].toLowerCase().slice(0, 3)];
  if (month === undefined) return null;
  return toIsoUtc(Number.parseInt(match[3], 10), month, Number.parseInt(match[1], 10));
}

/** Parses `DD-MM-YYYY` (source B) into an ISO-8601 UTC instant. */
function parseExamDate(text: string): string | null {
  const match = /(\d{1,2})-(\d{1,2})-(\d{4})/.exec(text ?? '');
  if (!match) return null;
  return toIsoUtc(
    Number.parseInt(match[3], 10),
    Number.parseInt(match[2], 10) - 1,
    Number.parseInt(match[1], 10)
  );
}

function stableId(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function makeNotice(params: {
  source: LiveNoticeSource;
  sourceUrl: string;
  title: string;
  postedAt: string | null;
  postedOn: string | null;
  fileUrl: string | null;
  attachmentKind: 'file' | 'modal' | 'none';
  attachmentLabel: string | null;
  isNew: boolean;
  relatedUrls?: string[];
}): LiveNotice {
  const category = classifyLiveNotice(params.title);
  return {
    id: `lt_${params.source}_${stableId(
      `${params.source}|${params.title}|${params.fileUrl ?? ''}`
    )}`,
    source: params.source,
    sourceUrl: params.sourceUrl,
    title: params.title,
    postedAt: params.postedAt,
    postedOn: params.postedOn,
    fileUrl: params.fileUrl,
    attachmentKind: params.attachmentKind,
    attachmentLabel: params.attachmentLabel,
    isNew: params.isNew,
    category,
    importance: scoreLiveNoticeImportance(params.title, category, params.isNew),
    relatedUrls: params.relatedUrls ?? [],
  };
}

/** Sorts newest first; notices without a date keep their original order at the end. */
function sortNewestFirst(notices: LiveNotice[]): LiveNotice[] {
  return notices
    .map((notice, index) => ({ notice, index }))
    .sort((a, b) => {
      const left = a.notice.postedAt ?? '';
      const right = b.notice.postedAt ?? '';
      if (left === right) return a.index - b.index;
      if (!left) return 1;
      if (!right) return -1;
      return left < right ? 1 : -1;
    })
    .map((entry) => entry.notice);
}

/** Splits a table row into its `<td>` cells, tolerating missing closing tags. */
function extractCells(rowHtml: string): string[] {
  const openings = (rowHtml.match(/<td\b/gi) ?? []).length;
  const wellFormed = Array.from(rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)).map(
    (match) => match[1]
  );
  if (openings > 0 && wellFormed.length === openings) return wellFormed;
  return rowHtml
    .split(/<td\b[^>]*>/i)
    .slice(1)
    .map((cell) => cell.replace(/<\/td>/gi, ''));
}

interface FoundAnchor {
  attrs: string;
  text: string;
}

/** Finds the first `<a>` element, tolerating a missing `</a>`. */
function findAnchor(html: string): FoundAnchor | null {
  const match = /<a\b([^>]*)>([\s\S]*?)(?:<\/a>|$)/i.exec(html);
  if (!match) return null;
  return { attrs: match[1] ?? '', text: match[2] ?? '' };
}

/** Reads the `href` of an anchor, tolerating single quotes and unterminated values. */
function readHref(attrs: string): string {
  const match = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attrs);
  if (!match) return '';
  return match[1] ?? match[2] ?? match[3] ?? '';
}

/** Reads the `title` attribute of an anchor. */
function readAttr(attrs: string, name: string): string {
  const match = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs);
  if (!match) return '';
  return match[1] ?? match[2] ?? '';
}

/** Derives a readable title from an attachment URL when the row has no anchor text. */
function titleFromHref(href: string): string {
  const nName = /[?&]nName=([^&]*)/i.exec(href);
  const raw = nName
    ? nName[1]
    : (href.split('?')[0] ?? '').split('/').pop() ?? '';
  if (!raw) return '';
  let decoded = decodeEntities(raw.replace(/%20/gi, ' '));
  decoded = decoded.replace(/^[-0-9]+_[0-9a-f]+\.[a-z0-9]{1,5}/i, '');
  decoded = decoded.replace(/\.[a-z0-9]{1,5}$/i, '');
  return toPlainText(decoded.replace(/[._]+/g, ' '));
}

/**
 * Returns the inner HTML of the `<div>` whose content starts at the beginning
 * of `html`, by counting nested `<div>` elements. Used to bound a notice block
 * so trailing page markup cannot be mistaken for notice content.
 */
function innerOfDiv(html: string): string {
  const pattern = /<div\b[^>]*>|<\/div>/gi;
  let depth = 1;
  let match = pattern.exec(html);
  while (match) {
    if (match[0].charAt(1) === '/') {
      depth -= 1;
      if (depth === 0) return html.slice(0, match.index);
    } else {
      depth += 1;
    }
    match = pattern.exec(html);
  }
  return html;
}

/**
 * Parses the main university notices page (`https://www.gbu.ac.in/page/notices`).
 *
 * The page holds a single `<table>` whose first row is the `Date | Title`
 * header followed by 214 data rows. Rows that do not carry a usable date are
 * skipped, so the header row is ignored automatically.
 *
 * @param html Raw HTML of the notices page.
 * @param baseUrl Page URL used to resolve relative attachment links.
 */
export function parseMainNoticesHtml(
  html: string,
  baseUrl: string = MAIN_NOTICES_URL
): LiveNotice[] {
  if (!html) return [];
  const source = stripScriptBlocks(html);
  const rows = source.split(/<tr\b[^>]*>/i).slice(1);
  const notices: LiveNotice[] = [];

  for (const row of rows) {
    const rowHtml = row.split(/<\/tr>/i)[0] ?? '';
    const cells = extractCells(rowHtml);
    if (cells.length < 2) continue;

    const postedOn = toPlainText(cells[0]);
    const postedAt = parseMainDate(postedOn);
    if (!postedAt) continue;

    const titleCell = cells[1] ?? '';
    const anchor = findAnchor(titleCell);
    const href = anchor ? readHref(anchor.attrs) : '';

    let title = toPlainText(titleCell);
    if (!title && anchor) title = toPlainText(anchor.text);
    if (!title) title = toPlainText(readAttr(anchor?.attrs ?? '', 'title'));
    if (!title && href) title = titleFromHref(href);
    if (!title) continue;

    const fileUrl = href ? resolveAbsoluteUrl(href, baseUrl) : null;

    notices.push(
      makeNotice({
        source: 'main',
        sourceUrl: baseUrl,
        title,
        postedAt,
        postedOn,
        fileUrl,
        attachmentKind: fileUrl ? 'file' : 'none',
        attachmentLabel: anchor ? toPlainText(anchor.text) || null : null,
        isNew: false,
      })
    );
  }

  return sortNewestFirst(notices);
}

/**
 * Recovers the school-wise date-sheet PDF mapping from the inline
 * `loadDateSheetModal()` script of the exam portal.
 *
 * The notice "Datesheet for End Semester Examination – December 2025" has no
 * file link (`javascript:void(0)`); its PDFs are only listed inside that
 * script, so this is a **fallback** for the missing attachment.
 *
 * @param html Raw HTML of the exam portal page (scripts must not be stripped).
 */
export function parseDateSheetModalLinks(
  html: string
): Array<{ schoolCode: string; url: string }> {
  if (!html) return [];
  const pattern = /(?:(https?:\/\/[^\s"'`)]+))?((?:\/)?uploads\/datesheet\/([a-z0-9]+)-([a-z0-9-]+)\.pdf)/gi;
  const seen = new Map<string, { schoolCode: string; url: string }>();
  let match = pattern.exec(html);
  while (match) {
    const absolute = match[1];
    const relative = match[2];
    const schoolCode = (match[3] ?? '').toLowerCase();
    const url = absolute
      ? `${absolute}${relative}`
      : resolveAbsoluteUrl(relative, EXAM_NOTICES_URL);
    if (schoolCode && url && !seen.has(schoolCode)) {
      seen.set(schoolCode, { schoolCode, url });
    }
    match = pattern.exec(html);
  }
  return Array.from(seen.values());
}

/**
 * Parses the examination portal (`https://exams.gbu.ac.in/`).
 *
 * Every notice is a `<div class="notice-item ...">` holding an `<h6>` title, a
 * `Posted on: DD-MM-YYYY` paragraph, an optional attachment link and an
 * optional `New` badge. Notices hidden inside `div#allNotices` are part of the
 * raw HTML, so no JavaScript execution is required.
 *
 * @param html Raw HTML of the exam portal page.
 * @param baseUrl Page URL used to resolve relative attachment links.
 */
export function parseExamNoticesHtml(
  html: string,
  baseUrl: string = EXAM_NOTICES_URL
): LiveNotice[] {
  if (!html) return [];
  const source = stripScriptBlocks(html);
  const blocks = source.split(/<div\b[^>]*class\s*=\s*"[^"]*notice-item[^"]*"[^>]*>/i).slice(1);
  const notices: LiveNotice[] = [];
  const modalLinks = parseDateSheetModalLinks(html);

  for (const chunk of blocks) {
    const block = innerOfDiv(chunk);
    const titleMatch = /<h6\b[^>]*>([\s\S]*?)<\/h6>/i.exec(block);
    if (!titleMatch) continue;
    const title = toPlainText(titleMatch[1]);
    if (!title) continue;

    const dateMatch = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(block);
    const postedOn = dateMatch ? toPlainText(dateMatch[1]) : '';
    const postedAt = parseExamDate(postedOn);

    const anchor = findAnchor(block.slice(titleMatch.index + titleMatch[0].length));
    const href = anchor ? readHref(anchor.attrs) : '';
    const attachmentLabel = anchor ? toPlainText(anchor.text) || null : null;

    let fileUrl: string | null = null;
    let attachmentKind: 'file' | 'modal' | 'none' = 'none';
    let relatedUrls: string[] = [];

    if (href) {
      if (/^javascript:/i.test(decodeEntities(href).trim())) {
        attachmentKind = 'modal';
        relatedUrls = modalLinks.map((link) => link.url);
      } else {
        fileUrl = resolveAbsoluteUrl(href, baseUrl);
        attachmentKind = fileUrl ? 'file' : 'none';
      }
    }

    notices.push(
      makeNotice({
        source: 'exams',
        sourceUrl: baseUrl,
        title,
        postedAt,
        postedOn: postedOn || null,
        fileUrl,
        attachmentKind,
        attachmentLabel,
        isNew: /badge\s+bg-danger/i.test(block),
        relatedUrls,
      })
    );
  }

  return sortNewestFirst(notices);
}

/** GBU returns HTTP 200 with a "404 - Page not found" body for unknown paths. */
function isSoft404Page(body: string): boolean {
  return body.includes('404 - Page not found');
}

async function fetchHtml(url: string, timeoutMs: number, fetchImpl: typeof fetch): Promise<string> {
  const controller =
    typeof AbortController === 'function' ? new AbortController() : (null as AbortController | null);
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const init: RequestInit = controller
      ? { signal: controller.signal, headers: { Accept: 'text/html,application/xhtml+xml' } }
      : { headers: { Accept: 'text/html,application/xhtml+xml' } };
    const response = await fetchImpl(url, init);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const body = await response.text();
    if (isSoft404Page(body)) {
      throw new Error('soft-404 page');
    }
    return body;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface FetchLiveNoticesResult {
  /** Every notice parsed from the live pages, newest first and de-duplicated. */
  notices: LiveNotice[];
  /** Page URLs that actually delivered notices. */
  sources: string[];
  /** Human readable failures; the fetch never throws. */
  errors: string[];
}

export interface FetchLiveNoticesOptions {
  /** Per-request timeout in milliseconds. Defaults to 15000. */
  timeoutMs?: number;
  /** Injectable `fetch`, mainly for tests. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Fetches both public GBU notice pages and returns the real notices.
 *
 * Never throws: a failing source is recorded in `errors` and the notices from
 * the remaining sources are still returned. The main page falls back to the
 * `test.gbu.ac.in` mirror when the primary host cannot be reached (the apex
 * host `gbu.ac.in` must never be used — its wildcard certificate does not
 * cover the apex).
 */
export async function fetchLiveNotices(
  options?: FetchLiveNoticesOptions
): Promise<FetchLiveNoticesResult> {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const fetchImpl = options?.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  const notices: LiveNotice[] = [];
  const sources: string[] = [];
  const errors: string[] = [];

  if (!fetchImpl) {
    return { notices, sources, errors: ['No fetch implementation available'] };
  }

  const mainCandidates = [MAIN_NOTICES_URL, MAIN_NOTICES_MIRROR_URL];
  let mainLoaded = false;
  for (const candidate of mainCandidates) {
    try {
      const html = await fetchHtml(candidate, timeoutMs, fetchImpl);
      const parsed = parseMainNoticesHtml(html, candidate);
      if (parsed.length === 0) {
        errors.push(`${candidate}: no notices found in page`);
        continue;
      }
      notices.push(...parsed);
      sources.push(candidate);
      mainLoaded = true;
      break;
    } catch (error) {
      errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!mainLoaded) {
    errors.push('Main notices unavailable from every known host');
  }

  try {
    const html = await fetchHtml(EXAM_NOTICES_URL, timeoutMs, fetchImpl);
    const parsed = parseExamNoticesHtml(html, EXAM_NOTICES_URL);
    if (parsed.length === 0) {
      errors.push(`${EXAM_NOTICES_URL}: no notices found in page`);
    } else {
      notices.push(...parsed);
      sources.push(EXAM_NOTICES_URL);
    }
  } catch (error) {
    errors.push(`${EXAM_NOTICES_URL}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const deduped: LiveNotice[] = [];
  const seen = new Set<string>();
  for (const notice of notices) {
    const key = `${notice.fileUrl ?? ''}|${notice.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(notice);
  }

  return { notices: sortNewestFirst(deduped), sources, errors };
}
