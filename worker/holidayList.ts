/**
 * GBU One — Vacation & holiday list parser (worker).
 *
 * The university publishes one PDF with the list of holidays:
 *   https://www.gbu.ac.in/Content/gbudata/General/List%20of%20Vacation-2026.pdf
 *
 * That file is a single scanned page with no text layer at all, and the
 * whole list is printed in Devanagari. There is no English version of the
 * list anywhere on the site, so the page has to be read with OCR that knows
 * the Devanagari script.
 *
 * The shared OCR runner in `worker/ocrRunner.ts` calls Tesseract without a
 * language argument, which means the default (English) model: it cannot read
 * Devanagari. This module therefore asks Tesseract for `hin+eng` and falls
 * back to the shared runner when the Hindi language data is not installed.
 *
 * The module never invents a date. When Tesseract is missing, when the
 * Hindi language data is missing, or when the recognised text does not hold
 * a single readable row, the result is an explicit "not available" with the
 * reason.
 */
import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { extractPdfImages } from './pdfText';
import { fetchWithTlsTolerance } from './noticesJob';
import { isTesseractAvailable, runTesseract } from './ocrRunner';

/** One holiday of the list. */
export interface Holiday {
  /** Festival name as printed, e.g. `संपत्ति कर`. */
  name: string;
  /** ISO `YYYY-MM-DD` first day, when the list states one. */
  startDate?: string;
  /** ISO `YYYY-MM-DD` last day, when the list states one. */
  endDate?: string;
  /** Day of the week as printed, e.g. `सोमवार`. */
  dayOfWeek?: string;
}

/** Result of a holiday list fetch. */
export interface HolidayListResult {
  holidays: Holiday[];
  ok: boolean;
  /** Present when `ok` is false. */
  reason?: string;
  /** `ocr` when the page was read, `unavailable` when it could not be. */
  method: 'ocr' | 'unavailable';
}

/** Options for {@link fetchHolidays2026}. */
export interface HolidayListOptions {
  url?: string;
  timeoutMs?: number;
  /** Download override; defaults to the worker's TLS-tolerant fetch. */
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  /**
   * OCR override. It receives the page image and has to return the text that
   * Tesseract read from it.
   */
  ocr?: (input: { bytes: Buffer; fileName: string; kind: string }) => Promise<string>;
  /** Languages handed to Tesseract. */
  languages?: string;
}

/** The only copy of the list the university publishes. */
export const HOLIDAY_LIST_2026_URL =
  'https://www.gbu.ac.in/Content/gbudata/General/List%20of%20Vacation-2026.pdf';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BYTES = 15 * 1024 * 1024;
const OCR_TIMEOUT_MS = 120_000;

/** Weekday names in Devanagari, longest first so the full name wins. */
const HINDI_WEEKDAYS = [
  'सोमवार',
  'मंगलवार',
  'मङ्गलवार',
  'बुधवार',
  'बुधवार',
  'गुरुवार',
  'गुरूवार',
  'शुक्रवार',
  'शनिवार',
  'रविवार',
  'सोम',
  'मंगल',
  'बुध',
  'गुरु',
  'शुक्र',
  'शनि',
  'रवि',
];

/** Weekday names in English. */
const ENGLISH_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

/** A date as the list prints it: `15/08/2026`, `15-08-26`, `15.08.2026`. */
const DATE_PATTERN = /(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{2,4})/g;

/**
 * Removes the control characters of a font encoding.
 *
 * The scanned page is read with OCR, but a PDF text layer can still carry a
 * NUL between every character.
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

/** Turns `15/08/2026` into `2026-08-15`. */
function toIsoDate(day: number, month: number, year: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let full = year;
  if (year < 100) full = year >= 70 ? 1900 + year : 2000 + year;
  const probe = new Date(Date.UTC(full, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return `${full}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Finds the weekday of a line, in Devanagari or in English. */
function findDayOfWeek(line: string): string | undefined {
  const lower = line.toLowerCase();
  for (const name of HINDI_WEEKDAYS) {
    if (line.includes(name)) return name;
  }
  for (const name of ENGLISH_WEEKDAYS) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) {
      const match = new RegExp(`\\b${name}\\b`, 'i').exec(line);
      if (match) return match[0];
    }
  }
  return undefined;
}

/**
 * Parses the OCR text of the holiday list.
 *
 * The parser is tolerant: OCR of a scanned table gives ragged lines, so a
 * row is read as "a line that holds at least one date". The festival name is
 * whatever is left of the line once the serial number, the dates and the
 * weekday are taken out.
 *
 * @param text Text read from the scanned page.
 * @returns The holidays of the list, in the order they are printed.
 */
export function parseHolidayTableText(text: string): Holiday[] {
  if (!text) return [];
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => stripControlCharacters(line).trim());

  const holidays: Holiday[] = [];

  for (const line of lines) {
    if (!line) continue;

    DATE_PATTERN.lastIndex = 0;
    const dates: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = DATE_PATTERN.exec(line)) !== null) {
      const iso = toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
      if (iso) dates.push(iso);
    }
    if (dates.length === 0) continue;

    const dayOfWeek = findDayOfWeek(line);

    // The name is the rest of the line: without the serial number, without
    // the dates and without the weekday.
    let rest = line;
    rest = rest.replace(DATE_PATTERN, ' ');
    if (dayOfWeek) {
      const index = rest.toLowerCase().indexOf(dayOfWeek.toLowerCase());
      if (index >= 0) {
        rest = `${rest.slice(0, index)} ${rest.slice(index + dayOfWeek.length)}`;
      }
    }
    rest = rest
      .replace(/^\s*\d{1,3}\s*[.)-]\s*/, '')
      .replace(/[|।॥,;:\s]+$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const holiday: Holiday = { name: rest };
    if (dates.length >= 2) {
      holiday.startDate = dates[0];
      holiday.endDate = dates[1];
    } else {
      holiday.startDate = dates[0];
      holiday.endDate = dates[0];
    }
    if (dayOfWeek) holiday.dayOfWeek = dayOfWeek;

    if (holiday.name.length === 0) holiday.name = 'अवकाश';
    holidays.push(holiday);
  }

  return holidays;
}

/**
 * Reads one page image with Tesseract, asking for the languages the list
 * needs.
 *
 * The shared runner in `worker/ocrRunner.ts` cannot ask for a language, and
 * the default model cannot read Devanagari, so the language is passed here.
 */
async function runTesseractWithLanguages(
  bytes: Buffer,
  fileName: string,
  languages: string,
): Promise<{ text: string; ok: boolean; reason?: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gbu-holiday-ocr-'));
  const file = path.join(dir, fileName);
  try {
    await fs.writeFile(file, bytes);
    const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>(
      (resolve) => {
        const child = execFile(
          'tesseract',
          [file, 'stdout', '-l', languages],
          { timeout: OCR_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 },
          (error, stdout, stderr) => {
            resolve({
              stdout: String(stdout ?? ''),
              stderr: String(stderr ?? ''),
              code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
            });
          },
        );
        child.stdout?.on('data', () => {});
      },
    );
    if (result.code !== 0) {
      const reason = result.stderr.trim().split('\n')[0] || 'tesseract-failed';
      return { text: '', ok: false, reason };
    }
    return { text: result.stdout, ok: true };
  } catch (error) {
    return {
      text: '',
      ok: false,
      reason: error instanceof Error ? error.message : 'tesseract-unavailable',
    };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Downloads the holiday list and reads the scanned page with OCR.
 *
 * @param options URL override, timeout, download and OCR overrides.
 * @returns The holidays of the list, or an explicit "not available".
 */
export async function fetchHolidays2026(
  options: HolidayListOptions = {},
): Promise<HolidayListResult> {
  const url = options.url ?? HOLIDAY_LIST_2026_URL;
  const fetchImpl = options.fetchImpl ?? fetchWithTlsTolerance;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const languages = options.languages ?? 'hin+eng';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let bytes: Buffer;
  try {
    const response = await fetchImpl(url, {
      headers: { 'User-Agent': 'GBUOne-Worker/1.0 (student project)' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { holidays: [], ok: false, method: 'unavailable', reason: `http-${response.status}` };
    }
    bytes = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'fetch-failed';
    return { holidays: [], ok: false, method: 'unavailable', reason };
  } finally {
    clearTimeout(timer);
  }

  if (bytes.length === 0) {
    return { holidays: [], ok: false, method: 'unavailable', reason: 'empty-response' };
  }
  if (bytes.length > MAX_BYTES) {
    return { holidays: [], ok: false, method: 'unavailable', reason: 'too-large' };
  }
  if (!bytes.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
    return { holidays: [], ok: false, method: 'unavailable', reason: 'not-a-pdf' };
  }

  const pages = extractPdfImages(bytes);
  if (pages.length === 0) {
    return { holidays: [], ok: false, method: 'unavailable', reason: 'no-page-images' };
  }

  const runner = options.ocr ?? (async (input: { bytes: Buffer; fileName: string; kind: string }) => {
    if (!isTesseractAvailable()) return '';
    const withLanguage = await runTesseractWithLanguages(input.bytes, input.fileName, languages);
    if (withLanguage.ok) return withLanguage.text;
    // The Hindi language data may be missing: fall back to the shared runner,
    // which reads the page with the default model.
    const shared = await runTesseract({
      bytes: input.bytes,
      fileName: input.fileName,
      kind: input.kind,
    });
    return shared.text;
  });

  const chunks: string[] = [];
  for (let index = 0; index < pages.length; index++) {
    try {
      const text = await runner({
        bytes: pages[index],
        fileName: `holiday-list-p${index + 1}.jpg`,
        kind: 'image',
      });
      if (text) chunks.push(text);
    } catch {
      // One unreadable page must not lose the others.
    }
  }

  const text = chunks.join('\n');
  if (!text.trim()) {
    return {
      holidays: [],
      ok: false,
      method: 'unavailable',
      reason: isTesseractAvailable() ? 'ocr-returned-no-text' : 'ocr-unavailable',
    };
  }

  const holidays = parseHolidayTableText(text);
  if (holidays.length === 0) {
    return {
      holidays: [],
      ok: false,
      method: 'unavailable',
      reason: 'no-holidays-in-ocr-text',
    };
  }

  return { holidays, ok: true, method: 'ocr' };
}
