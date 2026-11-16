/**
 * GBU One — Exam date sheet parser (worker).
 *
 * The university publishes one date sheet PDF per school, e.g.
 *   https://exams.gbu.ac.in/uploads/datesheet/soe-end-sem-dec-2025.pdf
 * The file is a grid: the first column names the programme, the second column
 * names the slot ("Morning 9.30am-12.30pm" / "Evening 2.00pm-5.00pm") and
 * every following column is one exam date.
 *
 * The shared PDF extractor in `worker/pdfText.ts` returns plain text only, and
 * the plain text of a date sheet is not enough to rebuild the grid: the text
 * extractor emits the cells of a programme one after the other, in date
 * order, but it never says which date column a cell came from. A programme
 * with papers on 08, 10, 13, 16, 22 and 24 December looks exactly like one
 * with papers on 08, 09, 10, 11, 12 and 13 December.
 *
 * This module therefore adds a small layout pass on top of the shared
 * extractor: it reuses `parseToUnicode` from `worker/pdfText.ts` for the font
 * decoding and keeps the position of every piece of text, so each cell can be
 * matched with its date column and its slot. The pure
 * {@link parseDateSheetText} works on the grid text that this pass produces
 * and also copes with the plain text of a date sheet, in which case the dates
 * can only be guessed positionally.
 *
 * A date sheet for a session that has not been published yet answers HTTP
 * 404. That is reported as "not published yet", never as an error and never
 * as an empty but successful sheet.
 */
import zlib from 'zlib';
import {
  WORD_SPACE_KERN,
  extractPdfText,
  parseToUnicode,
  parseObjects,
  type PdfObject,
} from './pdfText';
import {
  isTesseractAvailable,
  rasterisePdf,
  runTesseract,
} from './ocrRunner';
import { readFileSync } from 'fs';
import path from 'path';
import { fetchWithTlsTolerance } from './noticesJob';
import {
  parseExcelDateSheet,
  buildClassKey,
  matchClassKey,
  parseDateValue,
  parseSubjectCell,
  dateSlotKey,
  examSlotToRow,
  rowToExamSlot,
  examSlotToDatesheetEntry,
  filterSlotsForStudent,
  type ExamDateSlot,
  type DateSheetParseOptions,
} from '../src/features/exams/examDateSheetParser';
import { baseClassKeyOf, buildCanonicalClassKey, slugForSchool } from '../src/lib/classKey';

export {
  parseExcelDateSheet,
  buildClassKey,
  matchClassKey,
  parseDateValue,
  parseSubjectCell,
  dateSlotKey,
  examSlotToRow,
  rowToExamSlot,
  examSlotToDatesheetEntry,
  filterSlotsForStudent,
  type ExamDateSlot,
  type DateSheetParseOptions,
};

/** The session a date sheet belongs to. */
export interface DateSheetSession {
  /** The exam month, e.g. `dec`. */
  month: string;
  /** The exam year, e.g. 2026. */
  year: number;
}

/**
 * The end-semester session that is running right now.
 *
 * The university runs two sessions: the monsoon semester (July to December)
 * and the winter semester (January to June). The end-semester examination of
 * the monsoon session is in December, the one of the winter session in June.
 *
 * The old default was "December of the current year", which fetched the
 * December sheet of the current year even when the running session was the
 * winter one.
 */
export function resolveRunningDateSheetSession(now: Date = new Date()): DateSheetSession {
  const year = now.getFullYear();
  const monthIndex = now.getMonth(); // 0 = January
  // July (index 6) starts the monsoon semester.
  if (monthIndex >= 6) {
    return { month: 'dec', year };
  }
  // January to June: the winter session of this year ends in June.
  return { month: 'jun', year };
}

/** One exam slot of a date sheet. */
export interface DateSheetSlot {
  /** School the date sheet belongs to, e.g. `soe`. */
  schoolCode: string;
  /** Programme and batch as printed in the first column. */
  programme: string;
  /** Exam date in `YYYY-MM-DD`. */
  date: string;
  /** Which half of the day the paper is in. */
  slot: 'morning' | 'evening';
  /** Subject code, when the sheet prints one, e.g. `MA101`. */
  subjectCode?: string;
  /** Subject name without the code. */
  subjectName: string;
  /** True when the sheet marks the paper as a back or repeat paper. */
  isBackPaper: boolean;
}

/** Result of a date sheet fetch. */
export interface DateSheetResult {
  slots: DateSheetSlot[];
  ok: boolean;
  /** URL that was read. */
  url: string;
  /** Present when `ok` is false. */
  reason?: string;
}

/** Options for {@link fetchDateSheet}. */
export interface DateSheetOptions {
  /** Exam month, e.g. `dec`. */
  month?: string;
  /** Exam year, e.g. 2025. */
  year?: number;
  timeoutMs?: number;
  /** Download override; defaults to the worker's TLS-tolerant fetch. */
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
}

/**
 * The schools that publish a date sheet.
 * `sovasas` is listed because the university publishes one for it, even
 * though the December 2025 sheet was not online at the time of writing.
 */
export const DATE_SHEET_SCHOOL_CODES = [
  'sobsc',
  'sobt',
  'soe',
  'sohss',
  'soict',
  'soljg',
  'som',
  'sovasas',
] as const;

/** One of the schools that publish a date sheet. */
export type DateSheetSchoolCode = (typeof DATE_SHEET_SCHOOL_CODES)[number];

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BYTES = 20 * 1024 * 1024;

/** Base URL of the date sheet folder. */
export const DATE_SHEET_BASE_URL = 'https://exams.gbu.ac.in/uploads/datesheet';

/**
 * Builds the download URL of one school's date sheet.
 *
 * @param schoolCode School code, e.g. `soe`.
 * @param month Exam month, e.g. `dec`.
 * @param year Exam year, e.g. 2025.
 * @returns The absolute URL of the PDF.
 */
export function buildDateSheetUrl(
  schoolCode: string,
  month: string,
  year: number,
): string {
  const code = schoolCode.trim().toLowerCase();
  const mon = month.trim().toLowerCase();
  return `${DATE_SHEET_BASE_URL}/${code}-end-sem-${mon}-${year}.pdf`;
}

/** A piece of text with the position it was drawn at. */
interface LaidOutText {
  x: number;
  y: number;
  text: string;
}

/** Subject code at the start of a cell, e.g. `MA101`, `AR1011-`, `ED-501`. */
const SUBJECT_CODE = /^([A-Z]{2,5}[- ]?\d{2,4}[A-Za-z]?)\b/;
/** A date cell header, e.g. `08-12-2025`. */
const DATE_HEADER = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
/** A slot marker, e.g. `Morning`, `9.30am-12.30pm`, `09:.30 am- 12:30 pm`. */
const SLOT_MARKER = /\b(morning|evening)\b/i;
const SLOT_TIME = /\d{1,2}\s*[:.]\s*\d{1,2}\s*(am|pm)/i;
/** Words that mark a paper as a back or repeat paper. */
const BACK_PAPER = /\(\s*back\s*paper|back\s*paper|repeat\s*paper|\(\s*back\b|\bback\b\s*\)/i;

/** True when the text is a slot marker (either the word or the time range). */
function isSlotMarker(text: string): boolean {
  const clean = text.trim();
  return SLOT_MARKER.test(clean) || SLOT_TIME.test(clean);
}

/**
 * Reads the slot out of a slot marker.
 *
 * The marker is either the word (`Morning`) or the time range
 * (`09:.30 am- 12:30 pm`). When both are printed the word wins, because a
 * morning range also ends with `pm`.
 */
function slotOfMarker(text: string): 'morning' | 'evening' {
  const clean = text.trim();
  if (/evening/i.test(clean)) return 'evening';
  if (/morning/i.test(clean)) return 'morning';
  const time = /\d{1,2}\s*[:.]\s*\d{1,2}\s*(am|pm)/i.exec(clean);
  if (time && time[1].toLowerCase() === 'pm') return 'evening';
  return 'morning';
}

/** True when the text is a back or repeat paper marker. */
function isBackPaper(text: string): boolean {
  return BACK_PAPER.test(text);
}

/**
 * Removes the control characters of a font encoding.
 *
 * The university PDF encodes its glyphs as two byte codes, so the extracted
 * text carries a NUL between every character. The control characters are
 * dropped, the spaces and the line breaks are kept.
 */
function stripControlCharacters(text: string): string {
  return text
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 || code === 9 || code === 10 || code === 13;
    })
    .join('');
}

/** Normalises the text of a cell: single spaces, no control characters. */
function cleanCellText(text: string): string {
  return stripControlCharacters(text)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits one cell text into its subjects.
 *
 * A cell can hold more than one paper (`BS511 Pre-Buddhist Indian History and
 * Archaeology/BS513 Mahayana Buddhist Literature`), so the text is cut at
 * every subject code.
 */
export function splitSubjects(cellText: string): Array<{
  subjectCode?: string;
  subjectName: string;
  isBackPaper: boolean;
}> {
  const text = cleanCellText(cellText);
  if (!text) return [];

  const starts: Array<{ index: number; code: string }> = [];
  const codeRe = /([A-Z]{2,5}[- ]?\d{2,4}[A-Za-z]?)(?=\s|$|[-–—])/g;
  let match: RegExpExecArray | null;
  while ((match = codeRe.exec(text)) !== null) {
    const code = match[1].replace(/\s+/g, '');
    // A code must start a word, otherwise "Engineering" style words would
    // look like codes.
    const before = text.slice(0, match.index).replace(/\s+$/, '');
    if (before.length > 0 && !/[ (/,-]$/.test(before)) continue;
    starts.push({ index: match.index, code });
  }

  if (starts.length === 0) {
    return [{ subjectName: text, isBackPaper: isBackPaper(text) }];
  }

  const subjects: Array<{
    subjectCode?: string;
    subjectName: string;
    isBackPaper: boolean;
  }> = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index + starts[i].code.length;
    const end = i + 1 < starts.length ? starts[i + 1].index : text.length;
    const raw = cleanCellText(text.slice(start, end));
    const backPaper = isBackPaper(raw);
    // The "(Back Paper)" note belongs to the marker, not to the name.
    const name = cleanCellText(
      raw
        .replace(/\(\s*(back|repeat)\s*paper\s*\)/gi, ' ')
        .replace(/\b(back|repeat)\s*paper\b/gi, ' '),
    ).replace(/^[-–—\s]+/, '');
    if (!name) continue;
    subjects.push({
      subjectCode: starts[i].code,
      subjectName: name,
      isBackPaper: backPaper,
    });
  }
  return subjects;
}

/**
 * Parses the grid text of a date sheet.
 *
 * The grid text has one line per exam cell:
 *
 * ```
 * <programme> | <slot> | <date> | <subject text>
 * ```
 *
 * The `|` may also be a tab. A line without a programme uses the programme
 * of the line above it, which is how the university prints it.
 *
 * The function also accepts the plain text of a date sheet (the output of
 * `extractPdfText`). In that case the date columns are known but the cell to
 * column mapping is not, so the cells of a slot are matched with the date
 * columns in order. That is exact for a sheet whose grid has no gaps and
 * approximate otherwise; `fetchDateSheet` uses the layout pass, which is
 * always exact.
 *
 * @param text Grid text or plain text of a date sheet.
 * @param schoolCode School the sheet belongs to.
 * @returns The exam slots, in the order they were printed.
 */
export function parseDateSheetText(text: string, schoolCode: string): DateSheetSlot[] {
  if (!text) return [];
  const code = schoolCode.trim().toLowerCase();
  const lines = text.split(/\r?\n/);

  const grid = parseGridLines(lines, code);
  if (grid.length > 0) return grid;

  return parsePlainDateSheetText(lines, code);
}

/** Parses lines of the form `programme | slot | date | subject`. */
function parseGridLines(lines: string[], schoolCode: string): DateSheetSlot[] {
  const slots: DateSheetSlot[] = [];
  let programme = '';

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line
      .split(/\s*\|\s*|\t+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts.length < 3) continue;

    // The last part is the subject, the one before it the date and the one
    // before that the slot. A leading part is the programme, which then
    // also applies to the lines that follow it.
    const subjectText = parts[parts.length - 1];
    const dateText = parts[parts.length - 2];
    const slotText = parts[parts.length - 3];
    if (parts.length >= 4) programme = parts[0];

    if (!isSlotMarker(slotText)) continue;
    const date = toIsoDate(dateText);
    if (!date) continue;

    for (const subject of splitSubjects(subjectText)) {
      slots.push({
        schoolCode,
        programme,
        date,
        slot: slotOfMarker(slotText),
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
        isBackPaper: subject.isBackPaper,
      });
    }
  }

  return slots;
}

/**
 * Best effort reading of the plain text of a date sheet.
 *
 * The date columns are taken from the header. Every subject cell is matched
 * with a date column in order, because the plain text keeps the cells of a
 * programme in date order but not the column they came from.
 */
function parsePlainDateSheetText(lines: string[], schoolCode: string): DateSheetSlot[] {
  const dates: string[] = [];
  for (const line of lines) {
    for (const token of line.split(/\s+/)) {
      const iso = toIsoDate(token);
      if (iso && !dates.includes(iso)) dates.push(iso);
    }
  }
  if (dates.length === 0) return [];

  const slots: DateSheetSlot[] = [];
  let programme = '';
  let slot: 'morning' | 'evening' = 'morning';
  let cellIndex = 0;

  for (const line of lines) {
    const text = cleanCellText(line);
    if (!text) continue;

    if (isSlotMarker(text)) {
      slot = slotOfMarker(text);
      cellIndex = 0;
      continue;
    }

    const codeMatch = SUBJECT_CODE.exec(text);
    if (!codeMatch) {
      // A line without a subject code is either the programme or a note.
      // The LAST such line before the first subject is the programme: on the
      // sheets that reach this fallback the programme is printed on one
      // line, and the lines after it are subject names whose paper code
      // sits in another cell.
      if (text.length > 6 && !/^\d/.test(text) && !PROGRAMME_HEADER_LINE.test(text)) {
        programme = text;
      }
      continue;
    }

    const date = dates[Math.min(cellIndex, dates.length - 1)];
    cellIndex++;
    for (const subject of splitSubjects(text)) {
      slots.push({
        schoolCode,
        programme,
        date,
        slot,
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
        isBackPaper: subject.isBackPaper,
      });
    }
  }

  return slots;
}

/** The column headings of a date sheet, which are never a programme. */
const PROGRAMME_HEADER_LINE = /^(programme|batch|semester|date\s*&\s*time|subject|slot|shift|particulars|seating)/i;

/** Turns `08-12-2025` into `2025-12-08`. */
function toIsoDate(value: string): string | null {
  const match = DATE_HEADER.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Layout pass
// ---------------------------------------------------------------------------

function inflate(buffer: Buffer): Buffer | null {
  const attempts: Array<() => Buffer> = [
    () => zlib.inflateSync(buffer),
    () => zlib.inflateRawSync(buffer),
    () => zlib.unzipSync(buffer),
  ];
  for (const attempt of attempts) {
    try {
      return attempt();
    } catch {
      // try the next decoding strategy
    }
  }
  return null;
}

/** Reads `N 0 R` references out of a dictionary. */
function readReferences(dict: string, key: string): number[] {
  const array = new RegExp(`/${key}\\s*\\[([^\\]]*)\\]`, 's').exec(dict);
  if (array) {
    return [...array[1].matchAll(/(\d+)\s+\d+\s+R/g)].map((match) => Number(match[1]));
  }
  const single = new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`).exec(dict);
  return single ? [Number(single[1])] : [];
}

/** Finds the `>>` that closes the `<<` at `start`. */
function findDictEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '<' && text[i + 1] === '<') {
      depth++;
      i++;
      continue;
    }
    if (text[i] === '>' && text[i + 1] === '>') {
      depth--;
      if (depth === 0) return i;
      i++;
    }
  }
  return -1;
}

/** Resolves a value that may be inline (`<< ... >>`) or an indirect reference. */
function resolveDict(dict: string, key: string, objects: Map<number, PdfObject>): string {
  const inline = new RegExp(`/${key}\\s*(<<)`).exec(dict);
  if (inline) {
    const start = inline.index + inline[0].length - 2;
    const end = findDictEnd(dict, start);
    return end === -1 ? '' : dict.slice(start, end + 2);
  }
  const ref = new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`).exec(dict);
  if (ref) {
    const object = objects.get(Number(ref[1]));
    return object ? object.dict : '';
  }
  return '';
}

/** Builds the font name -> Unicode map of one page. */
function pageFontMaps(
  resourcesDict: string,
  objects: Map<number, PdfObject>,
): Map<string, Map<number, string>> {
  const maps = new Map<string, Map<number, string>>();
  const fontsDict = resolveDict(resourcesDict, 'Font', objects);
  if (!fontsDict) return maps;

  const fontRe = /\/([A-Za-z0-9#+._-]+)\s+(\d+)\s+\d+\s+R/g;
  let match: RegExpExecArray | null;
  while ((match = fontRe.exec(fontsDict)) !== null) {
    const fontObject = objects.get(Number(match[2]));
    if (!fontObject) continue;
    const refs = readReferences(fontObject.dict, 'ToUnicode');
    if (refs.length === 0) continue;
    const cmapObject = objects.get(refs[0]);
    if (!cmapObject || !cmapObject.data) continue;
    const cmap = parseToUnicode(cmapObject.data.toString('latin1'));
    if (cmap.size > 0) maps.set(match[1], cmap);
  }
  return maps;
}

/**
 * Decodes a hex string through the font's Unicode mapping.
 *
 * Several date sheets put the page content in a form object whose resources
 * the page does not name, so the page's own font map can be empty. Every
 * Unicode map of the document is tried as a fallback.
 */
function decodeHexString(
  raw: string,
  cmaps: Array<Map<number, string> | null | undefined>,
): string {
  const clean = raw.replace(/[^0-9a-fA-F]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i + 1 < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }

  for (const cmap of cmaps) {
    if (!cmap || cmap.size === 0) continue;

    // One byte codes first, then two byte codes.
    let oneByte = '';
    let matchedAll = true;
    for (const byte of bytes) {
      const mapped = cmap.get(byte);
      if (mapped === undefined) {
        matchedAll = false;
        break;
      }
      oneByte += mapped;
    }
    if (matchedAll && oneByte.length > 0) return oneByte;

    let twoByte = '';
    let matched = true;
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const mapped = cmap.get((bytes[i] << 8) | bytes[i + 1]);
      if (mapped === undefined) {
        matched = false;
        break;
      }
      twoByte += mapped;
    }
    if (matched && twoByte.length > 0) return twoByte;
  }

  const first = cmaps.find((cmap) => cmap && cmap.size > 0);
  if (first) {
    // Partial mapping: translate the codes the font knows and keep the rest.
    const partial = bytes.map((byte) => first.get(byte) ?? String.fromCharCode(byte)).join('');
    if (partial.length > 0) return partial;
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return out;
  }
  return bytes.map((byte) => String.fromCharCode(byte)).join('');
}

/** Decodes a literal PDF string. */
function decodeLiteralString(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (char !== '\\') {
      out += char;
      continue;
    }
    const next = raw[++i];
    switch (next) {
      case 'n': out += '\n'; break;
      case 'r': out += '\r'; break;
      case 't': out += '\t'; break;
      case 'b': out += '\b'; break;
      case 'f': out += '\f'; break;
      case '(': out += '('; break;
      case ')': out += ')'; break;
      case '\\': out += '\\'; break;
      case '\n': break;
      case undefined: break;
      default: out += next;
    }
  }
  return out;
}

/**
 * Walks a content stream and returns every piece of text with the position
 * it was drawn at.
 */
function extractWithPositions(
  stream: string,
  fontMaps: Map<string, Map<number, string>>,
  globalCmaps: Array<Map<number, string>> = [],
): LaidOutText[] {
  const out: LaidOutText[] = [];
  let index = 0;
  let arrayDepth = 0;
  /** Kerning value seen inside the current TJ array (text space units). */
  let pendingKern = 0;
  let textMatrix = [1, 0, 0, 1, 0, 0];
  let lineMatrix = [1, 0, 0, 1, 0, 0];
  let font: Map<number, string> | null = null;

  const translate = (a: number[], b: number[]): number[] => [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];

  const readBalanced = (): string | null => {
    let depth = 1;
    let out = '';
    while (index < stream.length) {
      const char = stream[index];
      if (char === '\\') {
        out += char + (stream[index + 1] ?? '');
        index += 2;
        continue;
      }
      if (char === '(') depth++;
      if (char === ')') {
        depth--;
        if (depth === 0) {
          index++;
          return out;
        }
      }
      out += char;
      index++;
    }
    return null;
  };

  /** True when the text just read is followed by a text-showing operator. */
  const isShown = (): boolean => {
    if (arrayDepth > 0) return true;
    return /^\s*T[jJ*'"]/.test(stream.slice(index, index + 4));
  };

  while (index < stream.length) {
    const char = stream[index];
    const rest = stream.slice(index);

    if (char === '(') {
      index++;
      const raw = readBalanced();
      if (raw === null) break;
      if (isShown()) {
        // Inside a TJ array a large negative kern means the glyphs are a word
        // apart: the space glyph itself is often not encoded.
        const space = arrayDepth > 0 && pendingKern <= WORD_SPACE_KERN ? ' ' : '';
        out.push({
          x: textMatrix[4],
          y: textMatrix[5],
          text: space + decodeLiteralString(raw),
        });
      }
      pendingKern = 0;
      continue;
    }

    if (char === '<' && stream[index + 1] !== '<') {
      const end = stream.indexOf('>', index);
      if (end === -1) break;
      const raw = stream.slice(index + 1, end);
      index = end + 1;
      if (isShown()) {
        const space = arrayDepth > 0 && pendingKern <= WORD_SPACE_KERN ? ' ' : '';
        out.push({
          x: textMatrix[4],
          y: textMatrix[5],
          text: space + decodeHexString(raw, [font, ...globalCmaps]),
        });
      }
      pendingKern = 0;
      continue;
    }

    if (char === '/' && /^\/[A-Za-z0-9#+._-]+/.test(rest)) {
      const name = /^\/([A-Za-z0-9#+._-]+)/.exec(rest);
      if (name) {
        const after = rest.slice(name[0].length);
        const tf = /^\s+[\d.]+\s+Tf/.exec(after);
        if (tf) {
          font = fontMaps.get(name[1]) ?? null;
          index += name[0].length + tf[0].length;
          continue;
        }
        index += name[0].length;
        continue;
      }
    }

    if (char === '[') {
      arrayDepth++;
      pendingKern = 0;
      index++;
      continue;
    }
    if (char === ']') {
      arrayDepth = Math.max(0, arrayDepth - 1);
      pendingKern = 0;
      index++;
      continue;
    }

    // Numbers inside a TJ array carry the kerning between the glyphs.
    if (arrayDepth > 0 && (char === '-' || (char >= '0' && char <= '9'))) {
      const number = /^-?\d+(?:\.\d+)?/.exec(rest);
      if (number) {
        pendingKern = Number(number[0]);
        index += number[0].length;
        continue;
      }
    }

    let match: RegExpExecArray | null;
    if ((match = /^([-+.\d]+)\s+([-+.\d]+)\s+([-+.\d]+)\s+([-+.\d]+)\s+([-+.\d]+)\s+([-+.\d]+)\s+Tm/.exec(rest))) {
      textMatrix = [1, 0, 0, 1, Number(match[5]), Number(match[6])];
      lineMatrix = textMatrix.slice();
      index += match[0].length;
      continue;
    }
    if ((match = /^([-+.\d]+)\s+([-+.\d]+)\s+Td/.exec(rest))) {
      lineMatrix = translate([1, 0, 0, 1, Number(match[1]), Number(match[2])], lineMatrix);
      textMatrix = lineMatrix.slice();
      index += match[0].length;
      continue;
    }
    if ((match = /^([-+.\d]+)\s+([-+.\d]+)\s+TD/.exec(rest))) {
      lineMatrix = translate([1, 0, 0, 1, Number(match[1]), Number(match[2])], lineMatrix);
      textMatrix = lineMatrix.slice();
      index += match[0].length;
      continue;
    }
    if ((match = /^([-+.\d]+)\s+T\*/.exec(rest))) {
      lineMatrix = translate([1, 0, 0, 1, 0, -Number(match[1])], lineMatrix);
      textMatrix = lineMatrix.slice();
      index += match[0].length;
      continue;
    }
    if ((match = /^([-+.\d]+)\s+([-+.\d]+)\s+([-+.\d]+)\s+([-+.\d]+)\s+([-+.\d]+)\s+([-+.\d]+)\s+cm/.exec(rest))) {
      textMatrix = translate(
        [
          Number(match[1]),
          Number(match[2]),
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
          Number(match[6]),
        ],
        textMatrix,
      );
      index += match[0].length;
      continue;
    }
    if (/^BT/.test(rest)) {
      textMatrix = [1, 0, 0, 1, 0, 0];
      lineMatrix = textMatrix.slice();
      index += 2;
      continue;
    }
    if ((match = /^[\d.]+/.exec(rest))) {
      index += match[0].length;
      continue;
    }
    index++;
  }

  return out;
}

/**
 * Collects every Unicode map of the document.
 *
 * Some date sheets put the page content in a form object, so the page does
 * not name the fonts and the page's own map is empty. The maps of the whole
 * document are used as a fallback in that case.
 */
function collectGlobalCmaps(objects: Map<number, PdfObject>): Array<Map<number, string>> {
  const cmaps: Array<Map<number, string>> = [];
  for (const object of objects.values()) {
    const refs = readReferences(object.dict, 'ToUnicode');
    if (refs.length === 0) continue;
    for (const ref of refs) {
      const cmapObject = objects.get(ref);
      if (!cmapObject || !cmapObject.data) continue;
      const cmap = parseToUnicode(cmapObject.data.toString('latin1'));
      if (cmap.size > 0) cmaps.push(cmap);
    }
  }
  return cmaps;
}

/**
 * Collects the font name -> Unicode map of every `/Font` dictionary of the
 * document.
 *
 * Some date sheets put the page content in a form object, so the page itself
 * does not name its fonts. The maps of the whole document are used as a
 * fallback in that case.
 */
function collectGlobalFontMaps(
  objects: Map<number, PdfObject>,
): Map<string, Map<number, string>> {
  const maps = new Map<string, Map<number, string>>();
  const fontRe = /\/([A-Za-z0-9#+._-]+)\s+(\d+)\s+\d+\s+R/g;
  for (const object of objects.values()) {
    if (!/\/Font\b/.test(object.dict)) continue;
    let match: RegExpExecArray | null;
    fontRe.lastIndex = 0;
    while ((match = fontRe.exec(object.dict)) !== null) {
      if (maps.has(match[1])) continue;
      const fontObject = objects.get(Number(match[2]));
      if (!fontObject) continue;
      const refs = readReferences(fontObject.dict, 'ToUnicode');
      if (refs.length === 0) continue;
      const cmapObject = objects.get(refs[0]);
      if (!cmapObject || !cmapObject.data) continue;
      const cmap = parseToUnicode(cmapObject.data.toString('latin1'));
      if (cmap.size > 0) maps.set(match[1], cmap);
    }
  }
  return maps;
}

/**
 * Extracts the text of every page of a PDF together with its position.
 *
 * @param buffer The PDF.
 * @returns One array of positioned text pieces per page.
 */
export function extractPdfLayout(
  buffer: Buffer,
  options: { fallbackOnly?: boolean } = {},
): LaidOutText[][] {
  if (!buffer || buffer.length === 0) return [];
  const source = buffer.toString('latin1');
  const objects = parseObjects(source);
  const globalCmaps = collectGlobalCmaps(objects);
  const globalFonts = collectGlobalFontMaps(objects);

  const pages: Array<{ contents: number[]; fonts: Map<string, Map<number, string>> }> = [];
  if (!options.fallbackOnly) {
    for (const object of objects.values()) {
      if (!/\/Type\s*\/Page[^s]/.test(object.dict)) continue;
      const contents = readReferences(object.dict, 'Contents');
      if (contents.length === 0) continue;
      const resources = resolveDict(object.dict, 'Resources', objects);
      const fonts = pageFontMaps(resources, objects);
      // The fonts the page does not name are taken from the document.
      for (const [name, cmap] of globalFonts) {
        if (!fonts.has(name)) fonts.set(name, cmap);
      }
      pages.push({ contents, fonts });
    }
  }

  const result: LaidOutText[][] = [];
  for (const page of pages) {
    const pieces: LaidOutText[] = [];
    for (const ref of page.contents) {
      const object = objects.get(ref);
      if (!object || !object.data) continue;
      pieces.push(
        ...extractWithPositions(object.data.toString('latin1'), page.fonts, globalCmaps),
      );
    }
    result.push(pieces);
  }

  if (options.fallbackOnly || result.length === 0 || result.every((page) => page.length === 0)) {
    // Fallback for documents whose page tree cannot be walked, or whose text
    // is drawn with an encoding the page does not describe: read every stream
    // of the file.
    const fallback: LaidOutText[][] = [];
    const streamRe = /stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
    let match: RegExpExecArray | null;
    while ((match = streamRe.exec(source)) !== null) {
      const window = source.slice(Math.max(0, match.index - 800), match.index);
      if (/\/Subtype\s*\/Image/.test(window)) continue;
      const raw = Buffer.from(match[1], 'latin1');
      const data = /\/FlateDecode/.test(window) ? inflate(raw) : raw;
      if (!data) continue;
      const text = data.toString('latin1');
      if (!/(?:Tj|TJ)\b/.test(text)) continue;
      fallback.push(extractWithPositions(text, new Map(), globalCmaps));
    }
    if (options.fallbackOnly) return fallback;
    if (result.length === 0 || result.every((page) => page.length === 0)) return fallback;
  }

  return result;
}

/** A group of text pieces that were drawn together (one table cell). */
interface Cell {
  x: number;
  y: number;
  /** Y of the last piece that was added to the cell. */
  lastY: number;
  centerY: number;
  text: string;
}

/** Groups the pieces of a page into cells. */
function groupIntoCells(pieces: LaidOutText[]): Cell[] {
  const cells: Cell[] = [];
  // The coordinates are normalised to the top-left of the text, because a
  // page printed in landscape (the School of ICT's date sheet is /Rotate 90)
  // places its text at NEGATIVE x. Every column comparison in the grid
  // reader is a comparison of positions, so an origin at -110 silently
  // moved every column out of the way and the sheet parsed to nothing.
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const piece of pieces) {
    if (piece.x < minX) minX = piece.x;
    if (piece.y < minY) minY = piece.y;
  }
  if (!Number.isFinite(minX)) return cells;
  const offsetX = minX;
  const offsetY = minY;

  for (const piece of pieces) {
    const x = piece.x - offsetX;
    const y = piece.y - offsetY;
    // The control characters of the font encoding are dropped, but the spaces
    // are kept: they are part of the text of the cell.
    const text = stripControlCharacters(piece.text);
    if (!text) continue;
    const last = cells[cells.length - 1];
    // The pieces of one cell are drawn one after the other and share their
    // horizontal position. The text of a cell can be centred, so the lines of
    // one cell do not start at exactly the same x.
    if (
      last &&
      Math.abs(last.x - x) < 45 &&
      y <= last.lastY + 1 &&
      last.lastY - y < 30
    ) {
      // Pieces on the same line belong together without a space, pieces on
      // different lines are separated by one.
      const sameLine = Math.abs(last.lastY - y) < 1.5;
      last.text = sameLine ? `${last.text}${text}` : `${last.text} ${text}`;
      last.centerY = (last.centerY + y) / 2;
      last.lastY = y;
      continue;
    }
    cells.push({ x, y, lastY: y, centerY: y, text });
  }
  return cells;
}

/**
 * Rebuilds the grid of one page of a date sheet.
 *
 * @returns One entry per exam cell, with its programme, slot and date.
 */
function readPageGrid(page: LaidOutText[]): Array<{
  programme: string;
  slot: 'morning' | 'evening';
  date: string;
  text: string;
}> {
  const cells = groupIntoCells(page);
  if (cells.length === 0) return [];

  // The header row holds the date columns.
  const dateColumns = cells
    .filter((cell) => DATE_HEADER.test(cleanCellText(cell.text)))
    .sort((a, b) => a.x - b.x);
  if (dateColumns.length === 0) return [];

  const firstDateX = dateColumns[0].x;
  // Where is the date header - at the top of the page or at the bottom?
  //
  // The sheets are not printed the same way round. The School of Law's date
  // sheet has its date row at the BOTTOM (y = 816 of a 900 point page) with
  // the rows ABOVE it, and the School of ICT's has its date row at the TOP
  // (y = 40) with the rows BELOW it. The grid reader used to assume the
  // first shape, so every row of the second sheet was skipped and the
  // biggest school in the university had no date sheet at all.
  const pageMinY = Math.min(...cells.map((cell) => cell.y));
  const pageMaxY = Math.max(...cells.map((cell) => cell.y));
  const headerYMid = dateColumns.reduce((sum, cell) => sum + cell.y, 0) / dateColumns.length;
  const headerIsAtTop = headerYMid < pageMinY + (pageMaxY - pageMinY) / 2;
  const headerY = headerIsAtTop
    ? Math.min(...dateColumns.map((cell) => cell.y))
    : Math.max(...dateColumns.map((cell) => cell.y));
  /** True when a cell is on the CONTENT side of the date header. */
  const onContentSide = (cellY: number): boolean =>
    headerIsAtTop ? cellY > headerY : cellY < headerY;

  const markers = cells.filter(
    (cell) =>
      isSlotMarker(cleanCellText(cell.text)) && onContentSide(cell.y) && cell.x < firstDateX,
  );
  const markerSet = new Set(markers);
  // The slot column separates the programme column from the date columns.
  const slotColumnX = markers.length > 0
    ? Math.min(...markers.map((cell) => cell.x))
    : firstDateX;

  const programmeCells = cells.filter(
    (cell) =>
      cell.x < slotColumnX - 5 &&
      onContentSide(cell.y) &&
      !isSlotMarker(cleanCellText(cell.text)) &&
      cleanCellText(cell.text).length > 0,
  );

  // Group the programme column into one entry per row.
  const programmes: Cell[] = [];
  for (const cell of programmeCells) {
    const last = programmes[programmes.length - 1];
    if (last && Math.abs(last.centerY - cell.centerY) < 25) {
      last.text = cleanCellText(`${last.text} ${cleanCellText(cell.text)}`);
      last.centerY = (last.centerY + cell.centerY) / 2;
      last.y = Math.min(last.y, cell.y);
      continue;
    }
    programmes.push({ ...cell, text: cleanCellText(cell.text) });
  }

  const rows: Array<{
    programme: string;
    slot: 'morning' | 'evening';
    date: string;
    text: string;
  }> = [];

  // The slot of a cell is the marker it was printed after; the programme of
  // that cell is the programme column entry closest to the marker.
  let currentSlot: 'morning' | 'evening' | null = null;
  let currentMarker: Cell | null = null;

  for (const cell of cells) {
    const text = cleanCellText(cell.text);
    if (!text) continue;
    if (!onContentSide(cell.y)) continue;
    if (markerSet.has(cell)) {
      currentSlot = slotOfMarker(text);
      currentMarker = cell;
      continue;
    }
    if (!currentSlot) continue;
    if (!SUBJECT_CODE.test(text)) continue;
    if (cell.x <= slotColumnX) continue;

    // The date column of the cell is the closest one.
    let best = dateColumns[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const column of dateColumns) {
      const distance = Math.abs(column.x - cell.x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = column;
      }
    }
    const date = toIsoDate(cleanCellText(best.text));
    if (!date) continue;

    // The programme is the column entry closest to the slot marker.
    let programme = '';
    let programmeDistance = Number.POSITIVE_INFINITY;
    for (const entry of programmes) {
      const reference = currentMarker ?? cell;
      const distance = Math.abs(entry.centerY - reference.centerY);
      if (distance < programmeDistance) {
        programmeDistance = distance;
        programme = entry.text;
      }
    }

    rows.push({ programme, slot: currentSlot, date, text });
  }

  return rows;
}

/**
 * Reads the grid of every page of a date sheet PDF.
 *
 * @param buffer The PDF.
 * @param schoolCode School the sheet belongs to.
 * @returns The exam slots of the sheet.
 */
export function parseDateSheetLayout(buffer: Buffer, schoolCode: string): DateSheetSlot[] {
  const code = schoolCode.trim().toLowerCase();
  let slots: DateSheetSlot[] = [];

  for (const pages of [extractPdfLayout(buffer), extractPdfLayout(buffer, { fallbackOnly: true })]) {
    const found: DateSheetSlot[] = [];
    for (const page of pages) {
      for (const row of readPageGrid(page)) {
        for (const subject of splitSubjects(row.text)) {
          found.push({
            schoolCode: code,
            programme: row.programme,
            date: row.date,
            slot: row.slot,
            subjectCode: subject.subjectCode,
            subjectName: subject.subjectName,
            isBackPaper: subject.isBackPaper,
          });
        }
      }
    }
    slots = found;
    if (slots.length > 0) break;
  }

  return slots;
}

/**
 * Downloads one school's date sheet and reads the grid.
 *
 * A sheet that the university has not published yet answers HTTP 404. That
 * is reported as `ok: false` with the reason `not-published-yet`, so the
 * worker can wait for the next session instead of storing an empty sheet.
 *
 * The grid is read with the layout pass. When the layout cannot be rebuilt
 * (the Biotechnology sheet prints all its dates on one line), the plain text
 * of the PDF is used instead: the papers are then read, but their date can
 * only be matched with the date columns by position, so the dates of such a
 * sheet are approximate.
 *
 * @param schoolCode School code, e.g. `soe`.
 * @param options Month, year, timeout and download override.
 * @returns The exam slots of the sheet.
 */
export async function fetchDateSheet(
  schoolCode: string,
  options: DateSheetOptions = {},
): Promise<DateSheetResult> {
  const code = schoolCode.trim().toLowerCase();
  // The running session, not "December of the current year": the December
  // sheet of the current year is only the right file while the monsoon
  // session is running.
  const session = resolveRunningDateSheetSession();
  const month = options.month ?? session.month;
  const year = options.year ?? session.year;

  // Which file actually exists?
  //
  // The academic session and the calendar year do not line up: on 15
  // November 2026 the running session's end-semester sheet had been
  // published in DECEMBER 2025, not December 2026 - so a single hard-coded
  // month/year found nothing and the exam date sheet stayed empty for
  // EVERY school.
  //
  // So the candidates are tried in order and the FIRST one that answers
  // with a PDF wins. An explicit month and year are a PREFERENCE, not a
  // restriction: the caller passes the running session, and "not published
  // for that exact month" is a perfectly normal state.
  //
  // Each miss is a 404, which costs nothing.
  const preference: Array<{ month: string; year: number }> =
    options.month && options.year
      ? [{ month: options.month, year: options.year }]
      : [{ month, year }];
  const fallbacks: Array<{ month: string; year: number }> = [
    // The session that has just finished: its sheet is the previous
    // December (or June).
    { month: 'dec', year: year - 1 },
    { month: 'jun', year: year - 1 },
    { month: 'jun', year },
    { month: 'dec', year: year + 1 },
  ];
  const candidates = [...preference];
  for (const fallback of fallbacks) {
    if (!candidates.some((c) => c.month === fallback.month && c.year === fallback.year)) {
      candidates.push(fallback);
    }
  }

  const fetchImpl = options.fetchImpl ?? fetchWithTlsTolerance;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastReason = 'not-published-yet';
  let lastUrl = buildDateSheetUrl(code, month, year);

  for (const candidate of candidates) {
    const url = buildDateSheetUrl(code, candidate.month, candidate.year);
    lastUrl = url;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        headers: { 'User-Agent': 'GBUOne-Worker/1.0 (student project)' },
        signal: controller.signal,
      });

      if (response.status === 404) {
        lastReason = 'not-published-yet';
        continue;
      }
      if (!response.ok) {
        lastReason = `http-${response.status}`;
        continue;
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0) {
        lastReason = 'empty-response';
        continue;
      }
      if (bytes.length > MAX_BYTES) {
        return { slots: [], ok: false, url, reason: 'too-large' };
      }
      if (!bytes.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
        return { slots: [], ok: false, url, reason: 'not-a-pdf' };
      }

      const text = extractPdfText(bytes);
      if (text.isScanned) {
        // The sheet has no usable text layer: it is a scan, or it carries a
        // subsetted font without a ToUnicode CMap. Either way it has to be
        // rasterised and read with OCR.
        const ocrText = await ocrPdfText(bytes, `${code}.pdf`);
        if (ocrText && ocrText.trim().length > 40) {
          const ocrSlots = parseDateSheetText(ocrText, code);
          if (ocrSlots.length > 0) {
            return { slots: ocrSlots, ok: true, url };
          }
        }
        return { slots: [], ok: false, url, reason: 'scanned-pdf' };
      }

      let slots = parseDateSheetLayout(bytes, code);
      if (slots.length === 0) {
        // Fall back to the plain text reading when the layout cannot be rebuilt.
        slots = parseDateSheetText(text.text, code);
      }
      if (slots.length === 0) {
        // Nothing could be read out of the text layer. One more chance: the
        // sheet may be a scan, or a font without a ToUnicode map that the
        // detector did not catch. Rasterising and reading it with OCR is
        // slower but it is the difference between a date sheet and no date
        // sheet for a whole school.
        const ocrText = await ocrPdfText(bytes, `${code}.pdf`);
        if (ocrText && ocrText.trim().length > 40) {
          const ocrSlots = parseDateSheetText(ocrText, code);
          if (ocrSlots.length > 0) {
            return { slots: ocrSlots, ok: true, url };
          }
        }
        return { slots: [], ok: false, url, reason: 'no-slots-found' };
      }

      return { slots, ok: true, url };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'fetch-failed';
      // A network error on one candidate is not a reason to give up on the
      // others, but a real failure is worth reporting.
      lastReason = reason;
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  // No candidate answered with a sheet.
  return { slots: [], ok: false, url: lastUrl, reason: lastReason };
}

/**
 * Reads a PDF that has no usable text layer, by rasterising it and running
 * Tesseract over the pages.
 *
 * Returns an empty string when the rasteriser or Tesseract is not installed
 * - the worker then reports "scanned-pdf" instead of pretending the sheet
 * has no slots.
 */
async function ocrPdfText(bytes: Buffer, fileName: string): Promise<string> {
  if (!isTesseractAvailable()) return '';
  const pages = await rasterisePdf(bytes, fileName);
  if (pages.length === 0) return '';
  const parts: string[] = [];
  for (const page of pages) {
    const result = await runTesseract({
      bytes: readFileSync(page),
      fileName: path.basename(page),
      kind: 'image',
    });
    if (result.ok && result.text) parts.push(result.text);
  }
  return parts.join('\n');
}

/**
 * True when a class key names no real programme.
 *
 * The key "general_sem3_2024_2029" means the sheet printed no programme name
 * and the school does not name one either. Storing such a row would put a
 * key in the database that no student can ever match.
 */
function isUnresolvedClassKey(canonicalKey: string, schoolCode: string): boolean {
  if (!canonicalKey.startsWith('general_') && canonicalKey !== 'general') return false;
  // A school that publishes ONE programme does not print its name.
  return !slugForSchool(schoolCode);
}

/**
 * Reads date sheet slots from a PDF buffer and maps to ExamDateSlot[].
 */
export function parsePdfDateSheet(
  buffer: Buffer,
  options: DateSheetParseOptions = {},
): ExamDateSlot[] {
  const schoolCode = options.schoolCode ?? 'soict';
  let dateSheetSlots = parseDateSheetLayout(buffer, schoolCode);
  let pdfText = '';
  if (dateSheetSlots.length === 0) {
    const textRes = extractPdfText(buffer);
    if (!textRes.isScanned && textRes.text) {
      pdfText = textRes.text;
      dateSheetSlots = parseDateSheetText(textRes.text, schoolCode);
    }
  }

  let examType = options.examType;
  if (!examType) {
    if (!pdfText) {
      const textRes = extractPdfText(buffer);
      pdfText = textRes.text || '';
    }
    examType = /mid\s*[- ]?sem/i.test(pdfText) ? 'mid_sem' : 'end_sem';
  }

  const usable: DateSheetSlot[] = [];
  let unresolved = 0;
  for (const slot of dateSheetSlots) {
    // A slot whose programme could NOT be resolved to a real programme is
    // dropped rather than stored.
    //
    // The School of ICT's sheet cannot be read by the layout pass, so its
    // plain-text fallback ends up taking SUBJECT names for programme names.
    // Those rows would be written with nonsense class keys ("cyber_security",
    // "programming") that no student can match - and, worse, they collide on
    // the slot key, so the real rows for that school are overwritten and
    // lost. A school with no readable programme is better off with no date
    // sheet than with a wrong one.
    const canonicalKey = buildCanonicalClassKey(
      slot.programme,
      undefined,
      undefined,
      slot.schoolCode,
    );
    if (isUnresolvedClassKey(canonicalKey, slot.schoolCode)) {
      unresolved += 1;
      continue;
    }
    usable.push(slot);
  }
  if (unresolved > 0) {
    console.warn(
      `Worker: ${unresolved} date sheet slot(s) of ${dateSheetSlots[0]?.schoolCode ?? '?'} ` +
        'had no readable programme and were skipped',
    );
  }

  return usable.map((slot) => {
    // The slot key carries the CANONICAL class key, so two cohorts of one
    // programme (`Batch 2022-2026` and `Batch 2025-2029`) are two rows and
    // never overwrite each other. The row keeps the BASE class key, because
    // that is the value the database is filtered on.
    //
    // The school code is passed because the School of Law publishes its date
    // sheet with an EMPTY programme column - the cell holds only
    // "2024-2029 II" - so the school is the only thing that names the
    // programme.
    const canonicalKey = buildCanonicalClassKey(
      slot.programme,
      undefined,
      undefined,
      slot.schoolCode,
    );
    const classKey = baseClassKeyOf(canonicalKey);
    const key = dateSlotKey(
      slot.schoolCode,
      slot.date,
      slot.slot,
      slot.subjectCode ?? '',
      slot.subjectName,
      canonicalKey,
    );
    const shiftTime =
      examType === 'mid_sem'
        ? slot.slot === 'morning'
          ? '10:00 AM - 11:30 AM'
          : '03:30 PM - 05:00 PM'
        : slot.slot === 'morning'
          ? '09:30 AM - 12:30 PM'
          : '02:00 PM - 05:00 PM';
    return {
      slotKey: key,
      schoolCode: slot.schoolCode,
      programme: slot.programme,
      classKey,
      examDate: slot.date,
      slot: slot.slot,
      shiftTime,
      subjectCode: slot.subjectCode ?? '',
      subjectName: slot.subjectName,
      examType: examType ?? 'end_sem',
      isBackPaper: slot.isBackPaper,
      sourceUrl: options.sourceUrl,
    };
  });
}

/**
 * Universal date sheet ingestion: handles PDF, Excel (.xlsx, .xls), or CSV.
 */
export function parseAnyDateSheet(
  buffer: ArrayBuffer | Buffer | string,
  fileName?: string,
  options?: DateSheetParseOptions,
): ExamDateSlot[] {
  const buf = Buffer.isBuffer(buffer)
    ? buffer
    : typeof buffer === 'string'
      ? Buffer.from(buffer, 'utf8')
      : Buffer.from(buffer);

  const isPdf =
    (fileName && fileName.toLowerCase().endsWith('.pdf')) ||
    buf.subarray(0, 1024).toString('latin1').includes('%PDF-');

  if (isPdf) {
    return parsePdfDateSheet(buf, options);
  }
  return parseExcelDateSheet(buffer, options);
}

