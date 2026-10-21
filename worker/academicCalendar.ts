/**
 * GBU One — Academic Calendar parser (worker).
 *
 * The university publishes one PDF per academic session, e.g.
 *   https://exams.gbu.ac.in/uploads/imp_link/Academic%20Calendar%202026-27.pdf
 * That copy has a real text layer. A second, image-only copy is published on
 * the main site and is only reachable through OCR.
 *
 * Two things make the PDF awkward to read:
 *  1. The extractor returns one word per line, so a numbered entry looks like
 *     `1.` / `Fee` / `Submission` / ... / `Fri,` / `10th` / `July` / `2026`.
 *  2. The content stream does not emit the rows in reading order. The names
 *     arrive out of order (row 8 is drawn after row 9) and a date cell can be
 *     drawn several rows later than the name it belongs to.
 *
 * The parser therefore works in two passes: it collects the numbered entries
 * (with their row number) and the date expressions separately, then pairs
 * them. Both sequences are in row order, so the pairing is positional.
 *
 * Nothing here is guessed: an entry without a parsable date keeps
 * `startDate`/`endDate` undefined instead of being invented.
 */
import { extractPdfImages, extractPdfText } from './pdfText';
import { fetchWithTlsTolerance } from './noticesJob';
import { isTesseractAvailable, runTesseract } from './ocrRunner';

/** One row of the academic calendar. */
export interface AcademicEvent {
  /** Human readable event name, e.g. "Mid Semester Examination." */
  name: string;
  /** ISO `YYYY-MM-DD` first day of the event, when the PDF states one. */
  startDate?: string;
  /** ISO `YYYY-MM-DD` last day of the event, when the PDF states one. */
  endDate?: string;
  /** Which half of the session the row belongs to. */
  semester: 'monsoon' | 'winter' | 'unknown';
}

/** Result of a calendar fetch. */
export interface AcademicCalendarResult {
  events: AcademicEvent[];
  /** URL the events were read from (empty when nothing was fetched). */
  source: string;
  ok: boolean;
  /** Present when `ok` is false, or when a fallback had to be used. */
  reason?: string;
}

/** Options for {@link fetchAcademicCalendar}. */
export interface AcademicCalendarOptions {
  /** Preferred URL (text layer). */
  url?: string;
  /** Image-only copy, read through OCR. */
  fallbackUrl?: string;
  timeoutMs?: number;
  /** Download override; defaults to the worker's TLS-tolerant fetch. */
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  /** OCR override; defaults to the local Tesseract runner. */
  ocr?: (input: { bytes: Buffer; fileName: string; kind: string }) => Promise<string>;
}

/** Preferred copy: a PDF with a real text layer. */
export const ACADEMIC_CALENDAR_URL =
  'https://exams.gbu.ac.in/uploads/imp_link/Academic%20Calendar%202026-27.pdf';

/**
 * Fallback copy on the main site. It is a scan, so it needs OCR.
 * The apex `gbu.ac.in` host fails TLS hostname validation; only `www` works.
 */
export const ACADEMIC_CALENDAR_FALLBACK_URL =
  'https://www.gbu.ac.in/Content/gbudata/General/Academic%20Calendar%202026-27.pdf';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BYTES = 15 * 1024 * 1024;

/** Month name -> month number. */
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const WEEKDAYS = /^(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)$/i;
/** `12`, `12th`, `12tdh`, `12h` — the PDF has typos, so the suffix is loose. */
const DAY = /^(\d{1,2})(st|nd|rd|th|tdh|tgh|dh|h)?$/i;
/** `08-12-2025`, `08/12/2025`, `08.12.2025`. */
const NUMERIC_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/;
/** `10-20` — a day range that shares one month and year. */
const DAY_RANGE = /^(\d{1,2})\s*[-–]\s*(\d{1,2})$/;
/** `Up to`, `Upto`, `From`, `w.e.f.`. */
const RANGE_PREFIX = /^(up|upto|uptill|from|till|to|w\.?e\.?f\.?)$/i;
/** A weekday glued to the end of a word, e.g. `onwards.....Mon,`. */
const GLUED_WEEKDAY = /^(.*?[^A-Za-z])((?:Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)[.,]?)$/;

/** One parsed date expression: a single day, a range, or a list of days. */
interface DateGroup {
  startDate: string;
  endDate: string;
}

/** Strips punctuation so `".Fri,"` and `"Fri,"` compare equal. */
function cleanToken(token: string): string {
  return token
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}]+$/u, '')
    .trim();
}

function isWeekday(token: string): boolean {
  return WEEKDAYS.test(token);
}

function monthNumber(token: string): number | null {
  const key = token.slice(0, 3).toLowerCase();
  return MONTHS[key] ?? null;
}

function dayNumber(token: string): number | null {
  const match = DAY.exec(token);
  if (!match) return null;
  const value = Number(match[1]);
  return value >= 1 && value <= 31 ? value : null;
}

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const paddedMonth = String(month).padStart(2, '0');
  const paddedDay = String(day).padStart(2, '0');
  const iso = `${year}-${paddedMonth}-${paddedDay}`;
  // Reject impossible days such as 31 February.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return iso;
}

function expandYear(year: number): number {
  if (year >= 1000) return year;
  return year >= 70 ? 1900 + year : 2000 + year;
}

/** True when the token can open a date expression. */
function startsDate(token: string): boolean {
  const clean = cleanToken(token);
  if (isWeekday(clean)) return true;
  if (NUMERIC_DATE.test(clean)) return true;
  if (DAY_RANGE.test(clean)) return true;
  return dayNumber(clean) !== null;
}

/** A single day inside a date expression. */
interface DatePart {
  startDate: string;
  endDate: string;
}

/**
 * Reads one date expression out of the token stream.
 *
 * Understands the shapes the university prints:
 *   `Fri, 10th July 2026 - Mon, 20th July 2026`
 *   `Wed, 05th August 2026 & Thu, 06th August 2026`
 *   `Up to Tue, 12tdh January 2027`
 *   `10-20 Jul 2026`  /  `03 Aug 2026`  /  `08-12-2025`
 *
 * Returns `null` when the tokens are not a date, so that numbers inside a
 * name (for example "(2nd Year onwards)") are never mistaken for one.
 *
 * @param mergeAdjacent When true, two date expressions that are printed one
 *   after the other without a separator are read as one range. The calendar
 *   uses both styles, so the caller decides which reading fits the sheet.
 */
function parseDateGroup(
  tokens: string[],
  start: number,
  mergeAdjacent: boolean,
): { group: DateGroup; next: number } | null {
  let index = start;
  const parts: DatePart[] = [];
  let lastYear: number | null = null;

  // Optional lead-in such as "Up to".
  while (index < tokens.length && RANGE_PREFIX.test(cleanToken(tokens[index]))) {
    const word = cleanToken(tokens[index]).toLowerCase();
    // "to" also separates two days; only skip it as a prefix at the very start.
    if (word === 'to' && parts.length > 0) break;
    index++;
  }

  while (index < tokens.length) {
    // Optional weekday prefix (".Mon," / "Fri.").
    if (isWeekday(cleanToken(tokens[index]))) index++;

    const token = cleanToken(tokens[index]);
    let part: DatePart | null = null;
    let consumed = 0;
    // True when the separator was glued to the token we just consumed.
    let gluedSeparator = false;

    const numeric = NUMERIC_DATE.exec(token);
    if (numeric) {
      const iso = toIso(
        expandYear(Number(numeric[3])),
        Number(numeric[2]),
        Number(numeric[1]),
      );
      if (iso) {
        part = { startDate: iso, endDate: iso };
        consumed = 1;
      }
    } else {
      const range = DAY_RANGE.exec(token);
      if (range) {
        const month = monthNumber(cleanToken(tokens[index + 1] ?? ''));
        const yearToken = cleanToken(tokens[index + 2] ?? '');
        const year = /^\d{4}$/.test(yearToken) ? Number(yearToken) : null;
        if (month !== null && year !== null) {
          const start = toIso(year, month, Number(range[1]));
          const end = toIso(year, month, Number(range[2]));
          if (start && end) {
            part = { startDate: start, endDate: end };
            consumed = 3;
          }
        }
      } else {
        const day = dayNumber(token);
        const month = monthNumber(cleanToken(tokens[index + 1] ?? ''));
        if (day !== null && month !== null) {
          const rawYear = (tokens[index + 2] ?? '').trim();
          const yearToken = cleanToken(rawYear);
          const hasYear = /^\d{4}$/.test(yearToken);
          const year: number | null = hasYear ? Number(yearToken) : lastYear;
          consumed = hasYear ? 3 : 2;
          if (year === null) {
            // A year is mandatory; without one this is not a date.
            consumed = 0;
          } else {
            const iso = toIso(year, month, day);
            if (iso) {
              part = { startDate: iso, endDate: iso };
              lastYear = year;
              // "2026- Fri," carries the range dash inside the year token.
              gluedSeparator = /[-–]$/.test(rawYear);
            }
          }
        }
      }
    }

    if (!part) break;
    parts.push(part);
    index += consumed;

    if (gluedSeparator) continue;

    // A separator continues the expression with another day. The separator is
    // checked on the raw token, because punctuation-only tokens would be
    // stripped by `cleanToken`.
    const next = (tokens[index] ?? '').trim().toLowerCase();
    if (next === '-' || next === '–' || next === '&' || next === 'and' || next === 'to') {
      index++;
      continue;
    }
    if (mergeAdjacent && startsDate(tokens[index] ?? '')) continue;
    break;
  }

  if (parts.length === 0) return null;
  const first = parts[0];
  const last = parts[parts.length - 1];
  return {
    group: { startDate: first.startDate, endDate: last.endDate },
    next: index,
  };
}

/** A numbered row of the calendar. */
interface CalendarEntry {
  number: number;
  name: string;
  /** Token index where the row starts. */
  at: number;
}

/** One semester block of the calendar. */
interface CalendarBlock {
  tokens: string[];
  semester: 'monsoon' | 'winter';
}

/**
 * Splits the extracted text into tokens.
 *
 * The PDF extractor emits one word per line, but a hand-made copy of the
 * calendar can put `1. Fee Submission .......... 10-20 Jul 2026` on one line,
 * so both are handled by splitting on any whitespace.
 *
 * The university PDF encodes its glyphs as two byte codes, so the extracted
 * text carries a NUL between every character. Those separators are removed
 * before the text is split, otherwise every word would look like one long
 * token.
 */
function tokenize(text: string): string[] {
  const raw = text
    .replace(/\r\n/g, '\n')
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 || code === 9 || code === 10 || code === 13;
    })
    .join('')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  // The PDF sometimes prints a weekday glued to the previous word
  // ("onwards.....Mon,"). Split it so the date can be read.
  const out: string[] = [];
  for (const token of raw) {
    const match = GLUED_WEEKDAY.exec(token);
    if (match && match[1].length > 0) {
      out.push(match[1], match[2]);
      continue;
    }
    out.push(token);
  }
  return out;
}

/** True for a row marker such as `1.` or `12.`. */
function rowNumber(token: string): number | null {
  const match = /^(\d{1,2})\.$/.exec(token.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return value >= 1 && value <= 99 ? value : null;
}

/** Rebuilds a readable row name out of its tokens. */
function joinName(tokens: string[]): string {
  const cleaned = tokens
    .map((token) => token.replace(/^[.,;]+/, '').replace(/[.,;]+$/, ''))
    .filter((token) => token.length > 0);
  const joined = cleaned.join(' ').replace(/\s{2,}/g, ' ').trim();
  return joined.replace(/^[\s.]+/, '').replace(/[\s.]+$/, '');
}

/** Splits the token stream into the monsoon and the winter block. */
function splitBlocks(tokens: string[]): CalendarBlock[] {
  const blocks: CalendarBlock[] = [];
  let current: CalendarBlock | null = null;
  let index = 0;

  while (index < tokens.length) {
    const upper = cleanToken(tokens[index]).toUpperCase();
    const next = cleanToken(tokens[index + 1] ?? '').toUpperCase();
    // A semester block starts with "MONSOON SEMESTER" / "WINTER SEMESTER".
    // The word "Winter" also appears inside the row "Winter Vacation", so the
    // header is only recognised when "SEMESTER" follows it.
    if (
      (upper === 'MONSOON' || upper === 'WINTER') &&
      (next === 'SEMESTER' || next === 'SEM')
    ) {
      current = { tokens: [], semester: upper === 'MONSOON' ? 'monsoon' : 'winter' };
      blocks.push(current);
      index += 2;
      continue;
    }
    if (current) current.tokens.push(tokens[index]);
    index++;
  }

  return blocks;
}

/** Finds the numbered rows of one block. */
function findEntries(tokens: string[]): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  let index = 0;

  while (index < tokens.length) {
    const number = rowNumber(tokens[index]);
    if (number === null) {
      index++;
      continue;
    }

    const nameTokens: string[] = [];
    let cursor = index + 1;
    while (cursor < tokens.length) {
      if (rowNumber(tokens[cursor]) !== null) break;
      if (parseDateGroup(tokens, cursor, false)) break;
      const word = cleanToken(tokens[cursor]).toUpperCase();
      // A trailing "NOTE:" belongs to the footer, not to the row name.
      if (word === 'NOTE') break;
      nameTokens.push(tokens[cursor]);
      cursor++;
    }

    entries.push({ number, name: joinName(nameTokens), at: index });
    index = cursor;
  }

  return entries;
}

/** Finds the date expressions of one block, in the order they are printed. */
function findDateGroups(
  tokens: string[],
  mergeAdjacent: boolean,
): Array<{ at: number; group: DateGroup }> {
  const groups: Array<{ at: number; group: DateGroup }> = [];
  let index = 0;
  while (index < tokens.length) {
    const parsed = parseDateGroup(tokens, index, mergeAdjacent);
    if (parsed) {
      groups.push({ at: index, group: parsed.group });
      index = parsed.next;
      continue;
    }
    index++;
  }
  return groups;
}

/**
 * For every row, the date expressions that were printed between its row
 * marker and the next row marker in the printed order.
 *
 * The PDF does not print the marker and the date of a row together, so this
 * is only a hint — but it is enough to tell which row a date most likely
 * belongs to.
 */
function anchorGroups(
  rows: CalendarEntry[],
  expressions: Array<{ at: number }>,
): Array<number[]> {
  const markers = rows.map((row) => row.at).sort((a, b) => a - b);
  return rows.map((row) => {
    const next = markers.find((marker) => marker > row.at) ?? Number.POSITIVE_INFINITY;
    const indices: number[] = [];
    expressions.forEach((expression, index) => {
      if (expression.at > row.at && expression.at < next) indices.push(index);
    });
    return indices;
  });
}

/** Merges several date expressions into one range. */
function mergeGroups(groups: Array<DateGroup | undefined>): DateGroup | undefined {
  const present = groups.filter((group): group is DateGroup => group !== undefined);
  if (present.length === 0) return undefined;
  let start = present[0].startDate;
  let end = present[0].endDate;
  for (const group of present) {
    if (group.startDate < start) start = group.startDate;
    if (group.endDate > end) end = group.endDate;
  }
  return { startDate: start, endDate: end };
}

/**
 * Pairs the rows of a block with the date expressions of that block.
 *
 * The date expressions are printed in row order, but the PDF shifts them
 * around: a row's date can be printed before the row's own marker, and a row
 * can carry two expressions when the university split a range over two cells.
 *
 * When the counts match, the two sequences are simply zipped. When they do
 * not, the best monotone split is searched for, scoring a split by how far it
 * moves a date away from the row it was printed next to.
 */
function pairRowsAndDates(
  rows: CalendarEntry[],
  expressions: Array<{ at: number; group: DateGroup }>,
): Array<DateGroup | undefined> {
  const rowCount = rows.length;
  const dateCount = expressions.length;
  const assigned: Array<DateGroup | undefined> = new Array(rowCount).fill(undefined);
  if (rowCount === 0 || dateCount === 0) return assigned;

  if (dateCount === rowCount) {
    rows.forEach((_row, index) => {
      assigned[index] = expressions[index].group;
    });
    return assigned;
  }

  const anchors = anchorGroups(rows, expressions);

  if (dateCount < rowCount) {
    // Not enough dates for every row: keep the ones that are clearly anchored.
    anchors.forEach((indices, rowIndex) => {
      if (indices.length > 0) assigned[rowIndex] = expressions[indices[0]].group;
    });
    return assigned;
  }

  // Cost of giving the expressions `from..to` to a row: how many of them the
  // row did not print next to its marker, plus how many it left behind.
  const cost = (rowIndex: number, from: number, to: number): number => {
    const anchored = new Set(anchors[rowIndex]);
    let total = 0;
    for (let index = from; index <= to; index++) {
      if (!anchored.has(index)) total++;
      else anchored.delete(index);
    }
    return total + anchored.size;
  };

  const infinity = Number.MAX_SAFE_INTEGER;
  const dp: number[][] = [];
  const back: number[][] = [];
  for (let i = 0; i <= rowCount; i++) {
    dp.push(new Array<number>(dateCount + 1).fill(infinity));
    back.push(new Array<number>(dateCount + 1).fill(-1));
  }
  dp[0][0] = 0;

  for (let i = 1; i <= rowCount; i++) {
    for (let j = 1; j <= dateCount; j++) {
      for (let k = j - 1; k >= 0; k--) {
        if (dp[i - 1][k] === infinity) continue;
        const candidate = dp[i - 1][k] + cost(i - 1, k, j - 1);
        if (candidate < dp[i][j]) {
          dp[i][j] = candidate;
          back[i][j] = k;
        }
      }
    }
  }

  let j = dateCount;
  for (let i = rowCount; i >= 1; i--) {
    const k = back[i][j];
    if (k < 0) {
      j = Math.max(0, j - 1);
      continue;
    }
    const parts: DateGroup[] = [];
    for (let x = k; x < j; x++) parts.push(expressions[x].group);
    assigned[i - 1] = mergeGroups(parts);
    j = k;
  }

  return assigned;
}

/**
 * Parses the text layer of an academic calendar PDF.
 *
 * The parser is tolerant: rows may sit on one line (`1. Fee ..... 10-20 Jul
 * 2026`) or be spread over many lines, and the date may use the long form
 * (`Fri, 10th July 2026 - Mon, 20th July 2026`) or the short form
 * (`10-20 Jul 2026`). Both are recognised.
 *
 * Rows that belong to neither the monsoon nor the winter block (the covering
 * order at the top of the PDF, which lists the recipients of the order) are
 * ignored, because they are not academic events.
 *
 * @param text Text layer of the calendar PDF.
 * @returns The calendar rows, in the order the university lists them.
 */
export function parseAcademicCalendarText(text: string): AcademicEvent[] {
  if (!text) return [];
  const blocks = splitBlocks(tokenize(text));
  const events: AcademicEvent[] = [];

  for (const block of blocks) {
    const entries = findEntries(block.tokens).filter((entry) => entry.name.length > 0);
    if (entries.length === 0) continue;

    const sorted = [...entries].sort((a, b) => a.number - b.number);

    // The date expressions are printed in row order, but the sheet uses both
    // "one expression per row" and "two expressions per row" styles. The
    // reading under which the rows and the dates line up is used.
    let expressions = findDateGroups(block.tokens, false);
    if (expressions.length !== sorted.length) {
      const merged = findDateGroups(block.tokens, true);
      if (merged.length === sorted.length) expressions = merged;
    }

    const dates = pairRowsAndDates(sorted, expressions);
    sorted.forEach((entry, index) => {
      const date = dates[index];
      events.push({
        name: entry.name,
        startDate: date?.startDate,
        endDate: date?.endDate,
        semester: block.semester,
      });
    });
  }

  return events;
}

/** Outcome of a PDF download. */
interface PdfDownload {
  bytes: Buffer | null;
  ok: boolean;
  reason?: string;
}

/** Downloads a PDF and returns its bytes, or `null` when it cannot be read. */
async function downloadPdf(url: string, options: AcademicCalendarOptions): Promise<PdfDownload> {
  const fetchImpl = options.fetchImpl ?? fetchWithTlsTolerance;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { 'User-Agent': 'GBUOne-Worker/1.0 (student project)' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { bytes: null, ok: false, reason: `http-${response.status}` };
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) return { bytes: null, ok: false, reason: 'empty-response' };
    if (bytes.length > MAX_BYTES) return { bytes: null, ok: false, reason: 'too-large' };
    if (!bytes.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
      return { bytes: null, ok: false, reason: 'not-a-pdf' };
    }
    return { bytes, ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'fetch-failed';
    return { bytes: null, ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

/** Reads the text layer of a downloaded PDF. */
function readTextLayer(bytes: Buffer): string {
  const result = extractPdfText(bytes);
  return result.text ?? '';
}

/**
 * OCRs the page images of a scanned PDF.
 * Returns an empty string when no OCR provider is usable.
 */
async function ocrScannedPdf(
  bytes: Buffer,
  options: AcademicCalendarOptions,
): Promise<{ text: string; reason?: string }> {
  const pages = extractPdfImages(bytes);
  if (pages.length === 0) return { text: '', reason: 'no-page-images' };

  const runner =
    options.ocr ??
    (isTesseractAvailable()
      ? async (input: { bytes: Buffer; fileName: string; kind: string }) =>
          (await runTesseract({ bytes: input.bytes, fileName: input.fileName, kind: input.kind })).text
      : undefined);
  if (!runner) return { text: '', reason: 'ocr-unavailable' };

  const chunks: string[] = [];
  for (let index = 0; index < pages.length; index++) {
    try {
      const text = await runner({
        bytes: pages[index],
        fileName: `academic-calendar-p${index + 1}.jpg`,
        kind: 'image',
      });
      if (text) chunks.push(text);
    } catch {
      // One unreadable page must not lose the others.
    }
  }
  return { text: chunks.join('\n') };
}

/**
 * Downloads the academic calendar and parses it.
 *
 * The copy with a text layer is tried first; the scanned copy on the main
 * site is only read through OCR when the first one has no usable text. When
 * both fail the result is an honest failure with a reason — no date is ever
 * invented.
 *
 * @param options URL overrides, timeout and injectable downloader/OCR.
 * @returns The parsed rows plus the URL they came from.
 */
export async function fetchAcademicCalendar(
  options: AcademicCalendarOptions = {},
): Promise<AcademicCalendarResult> {
  const url = options.url ?? ACADEMIC_CALENDAR_URL;
  const fallbackUrl = options.fallbackUrl ?? ACADEMIC_CALENDAR_FALLBACK_URL;
  const reasons: string[] = [];

  const primary = await downloadPdf(url, options);
  if (primary.ok && primary.bytes) {
    const text = readTextLayer(primary.bytes);
    const events = parseAcademicCalendarText(text);
    if (events.length > 0) {
      return { events, source: url, ok: true };
    }
    reasons.push(`no-events-in-text-layer(${text.length} chars)`);
  } else {
    reasons.push(`${url}: ${primary.reason ?? 'download-failed'}`);
  }

  const fallback = await downloadPdf(fallbackUrl, options);
  if (fallback.ok && fallback.bytes) {
    const text = readTextLayer(fallback.bytes);
    if (text.trim().length > 0) {
      const events = parseAcademicCalendarText(text);
      if (events.length > 0) {
        return { events, source: fallbackUrl, ok: true };
      }
      reasons.push('no-events-in-fallback-text-layer');
    } else {
      const ocr = await ocrScannedPdf(fallback.bytes, options);
      if (ocr.text.trim().length > 0) {
        const events = parseAcademicCalendarText(ocr.text);
        if (events.length > 0) {
          return { events, source: fallbackUrl, ok: true };
        }
        reasons.push('no-events-in-fallback-ocr');
      } else {
        reasons.push(ocr.reason ?? 'fallback-ocr-empty');
      }
    }
  } else {
    reasons.push(`${fallbackUrl}: ${fallback.reason ?? 'download-failed'}`);
  }

  return {
    events: [],
    source: url,
    ok: false,
    reason: reasons.join('; ') || 'academic-calendar-unavailable',
  };
}
