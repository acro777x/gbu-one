/**
 * GBU One — Notices Scraper & Enrichment Worker Job
 * Scrapes https://test.gbu.ac.in/page/notices and https://exams.gbu.ac.in
 * Per docs/DATA_SOURCES.md, docs/ARCHITECTURE.md, docs/NOTIFICATIONS.md
 */

import crypto from 'crypto';
import {
  NoticeItem,
  cleanNoticeTitle,
  classifyNotice,
  detectNoticeAudience,
  calculateNoticeImportance,
  extractNoticeDeadline,
  groupNoticeThreads,
} from '../src/features/notices/noticeService';
import { SOURCE_KEYS, WORKER_CONFIG } from './sources.config';
import { fetchWithRetry, politeWait } from './http';
import { ALWAYS_FETCH, type SourceScheduler } from './sourceScheduler';

export interface ScrapedRawNotice {
  source: 'main' | 'exams' | 'hostel' | 'ohms' | 'csms' | 'digiforms' | 'other';
  rawTitle: string;
  url: string;
  dateStr: string;
}

/** How one source fared during a run. */
export interface SourceParseResult {
  /** The source key, e.g. `main` or `exams`. */
  source: string;
  /** How many notices the source yielded. */
  count: number;
  /** True when the source could not be read at all. */
  failed: boolean;
  /** True when the source answered but yielded nothing (layout change?). */
  suspicious: boolean;
  /**
   * True when the source was not read at all because its interval had not
   * elapsed. Such a source is NOT suspicious: it was never asked.
   */
  skipped: boolean;
  /** The reason the source failed, when it did. */
  reason?: string;
}

export interface NoticesWorkerResult {
  totalScraped: number;
  newNoticesCount: number;
  highPriorityPushCount: number;
  notices: NoticeItem[];
  pushCandidates: NoticeItem[];
  /** sourceIds first seen this run (safe to push; never old items). */
  newSourceIds: string[];
  timestamp: string;
  /** One entry per source that was read, so the caller can guard per source. */
  sourceResults: SourceParseResult[];
}

/**
 * Generates the deterministic sourceId of a notice.
 *
 * The hash is a full SHA-256 digest. A 32-bit hash collides at about 2 000
 * notices (p ~ 0.4 %), and a collision silently overwrites an unrelated
 * notice, so the full digest is used.
 */
export function generateSourceId(source: string, url: string, dateStr: string): string {
  // Normalize test.gbu.ac.in mirror to www.gbu.ac.in (they are byte-identical)
  const normalizedUrl = url.replace(/test\.gbu\.ac\.in/gi, 'www.gbu.ac.in');
  const input = `${source}_${normalizedUrl.trim().toLowerCase()}_${dateStr.trim()}`;
  const sha = crypto.createHash('sha256').update(input).digest('hex');
  return `src_${sha}`;
}

/**
 * Fetches a URL while tolerating GBU's expired/untrusted TLS chain.
 * Verified 2026-10-20: `www.gbu.ac.in` fails strict validation with
 * CERT_HAS_EXPIRED. Undici/Node in CI throws the same. We therefore use a
 * per-request insecure dispatcher scoped ONLY to *.gbu.ac.in / mygbu.in —
 * never a global NODE_TLS_REJECT_UNAUTHORIZED=0. See docs/DATA_SOURCES.md.
 */
export async function fetchWithTlsTolerance(url: string, init?: RequestInit): Promise<Response> {
  const needsInsecure = /(^|\.)gbu\.ac\.in$|mygbu\.in$/i.test(new URL(url).hostname);
  if (!needsInsecure) {
    return fetch(url, init);
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const { Agent, fetch: undiciFetch } = require('undici') as typeof import('undici');
    const agent = new Agent({ connect: { rejectUnauthorized: false } });
    return (await undiciFetch(url, {
      ...init,
      dispatcher: agent,
    } as Parameters<typeof undiciFetch>[1])) as unknown as Response;
  } catch {
    // Fallback: plain fetch (works wherever the chain validates).
    return fetch(url, init);
  }
}

/**
 * GBU soft-404 trap: unknown paths return HTTP 200 with a ~38,725-byte
 * "404 - Page not found" page. Never treat that as notice data.
 */
export function isSoft404(html: string): boolean {
  if (!html) return true;
  if (/404\s*-\s*Page not found/i.test(html)) return true;
  const len = html.length;
  return len >= 38600 && len <= 38900;
}

/**
 * Totally empty parse = layout change, not "no notices". Callers must NOT
 * overwrite stored data in that case.
 */
export function isEmptyParseSuspicious(items: unknown[]): boolean {
  return items.length === 0;
}

/**
 * Parses HTML table rows from GBU main notices page (test.gbu.ac.in/page/notices)
 *
 * GBU's notices page is a single server-rendered table:
 *   <table class="table table-condensed table-striped">
 *     <tr><th>Date</th><th>Title</th></tr>
 *     <tr><td>01 Oct 2026</td>
 *         <td><a href="/Admissions/DownloadFile?nName=..." target="_blank">Title</a></td></tr>
 *
 * Notes (verified against the live page - see docs/GBU_WEB_STRUCTURE.md):
 * - The date cell uses `DD Mon YYYY` (e.g. "01 Oct 2026"). Other GBU pages use
 *   `DD-MM-YYYY`, so both are accepted.
 * - The date MUST be anchored to the first <td> of the row. A loose date regex
 *   also matches digit runs inside the `nName` filename (e.g. "25-08-2026"),
 *   which produced 12 false positives and left 201 real rows undated.
 * - There is no pagination: /page/notices returns all 213 notices in one page.
 */
const GBU_NOTICE_ROW_RE =
  /<tr[^>]*>\s*<td[^>]*>\s*(\d{2}\s+[A-Za-z]{3}\s+\d{4}|\d{2}[-/.]\d{2}[-/.]\d{4})\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;

/**
 * GBU publishes titles with HTML entities (e.g. "University&#39;s", "NCC &amp; Selection").
 * Decode the common ones so titles are human-readable.
 */
function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

export function parseMainNoticesHtml(html: string): ScrapedRawNotice[] {
  const results: ScrapedRawNotice[] = [];
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = GBU_NOTICE_ROW_RE.exec(html)) !== null) {
    const dateStr = rowMatch[1].trim();
    const cellContent = rowMatch[2];

    // Find the anchor inside this row's title cell
    const linkMatch = cellContent.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    let href = linkMatch[1].trim();
    // GBU sometimes emits `~/Content/...` which 404s - resolve against the root.
    href = href.replace(/^~\//, '/');
    if (!href.startsWith('http')) {
      href = `https://www.gbu.ac.in${href.startsWith('/') ? '' : '/'}${href}`;
    }
    const rawTitle = decodeHtmlEntities(linkMatch[2].replace(/<[^>]+>/g, '').trim());

    if (rawTitle.length > 2) {
      results.push({
        source: 'main',
        rawTitle,
        url: href,
        dateStr,
      });
    }
  }

  return results;
}

/**
 * Reads the publication date of an exams-portal notice.
 *
 * The date has to be read from the date paragraph only. The old regex
 * searched the whole notice block, so a date inside an attachment file name
 * (`.../Sheet_25-08-2026.pdf`) became the publication date of the notice.
 */
export function extractExamsNoticeDate(block: string): string | null {
  // The paragraphs (or spans) that carry a date, and only those.
  const dateBlockRe =
    /<(?:p|span|div|time|small)\b[^>]*\bclass\s*=\s*["'][^"']*\b(?:date|posted|publish\w*)\b[^"']*["'][^>]*>([\s\S]{0,200}?)<\/(?:p|span|div|time|small)>/gi;
  let match: RegExpExecArray | null;
  while ((match = dateBlockRe.exec(block)) !== null) {
    const found = match[1].match(
      /([0-3]?[0-9][/.-][0-1]?[0-9][/.-][2-9][0-9]{3}|[0-3]?[0-9]\s+[A-Za-z]{3,9}\s+[2-9][0-9]{3})/,
    );
    if (found) return found[1].trim();
  }

  // "Posted on: 01-7-2026" and "Date: 10-10-2026" inside a short paragraph.
  const labelledRe =
    /(?:Posted\s+on|Date|Published(?:\s+on)?)\s*:?\s*([0-3]?[0-9][/.-][0-1]?[0-9][/.-][2-9][0-9]{3}|[0-3]?[0-9]\s+[A-Za-z]{3,9}\s+[2-9][0-9]{3})/i;
  const labelled = labelledRe.exec(block);
  if (labelled) return labelled[1].trim();

  return null;
}

/**
 * Parses HTML from Exams portal (exams.gbu.ac.in)
 */
export function parseExamsNoticesHtml(html: string): ScrapedRawNotice[] {
  const results: ScrapedRawNotice[] = [];

  // 1. Structure on https://exams.gbu.ac.in: <div class="notice-item ...">
  const blockRegex =
    /<div\b[^>]*class\s*=\s*"[^"]*notice-item[^"]*"[^>]*>([\s\S]*?)(?=<div\b[^>]*class\s*=\s*"[^"]*notice-item[^"]*"[^>]*>|$)/gi;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const block = blockMatch[1];
    const hMatch = block.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
    const linkMatch = block.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const dateStr = extractExamsNoticeDate(block);

    if (hMatch && linkMatch) {
      const title = decodeHtmlEntities(hMatch[1].replace(/<[^>]+>/g, '').trim());
      let href = linkMatch[1].trim();
      if (!href.startsWith('http')) {
        href = `https://exams.gbu.ac.in${href.startsWith('/') ? '' : '/'}${href}`;
      }
      if (title.length > 2 && !/^view\s+attachment$/i.test(title)) {
        results.push({
          source: 'exams',
          rawTitle: title,
          url: href,
          // A notice without a readable date keeps the "undated" marker, so
          // it is not re-dated to today on every run.
          dateStr: dateStr ?? 'undated',
        });
      }
    }
  }

  // 2. Fallback: table rows or direct links with descriptive anchor text
  const linkRegex =
    /<a\s+[^>]*href=["']([^"']*(?:uploads\/notices\/|admin\/public\/uploads\/)[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1].trim();
    if (!href.startsWith('http')) {
      href = `https://exams.gbu.ac.in${href.startsWith('/') ? '' : '/'}${href}`;
    }
    if (results.some((r) => r.url === href)) continue;

    const rawTitle = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, '').trim());
    if (rawTitle.length > 3 && !/^view\s+attachment$/i.test(rawTitle)) {
      results.push({
        source: 'exams',
        rawTitle,
        url: href,
        dateStr: 'undated',
      });
    }
  }

  return results;
}

/**
 * Parses HTML from Hostel portal (hostels.gbu.ac.in)
 */
export function parseHostelNoticesHtml(html: string): ScrapedRawNotice[] {
  const results: ScrapedRawNotice[] = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"']*(?:allotment|hostel|mess|circular|notice|room)[^"']*\.(?:pdf|docx?|jpe?g|png))["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1].trim();
    if (!href.startsWith('http')) {
      // HTTPS only: the attachment pipeline refuses cleartext downloads.
      href = `https://hostels.gbu.ac.in${href.startsWith('/') ? '' : '/'}${href}`;
    }
    const rawTitle = match[2].replace(/<[^>]+>/g, '').trim();
    if (rawTitle.length > 3) {
      results.push({
        source: 'hostel',
        rawTitle,
        url: href,
        dateStr: 'undated',
      });
    }
  }

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowContent = rowMatch[1];
    const link = rowContent.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const dateMatch = rowContent.match(/(?:<td[^>]*>)?\s*([0-3]?[0-9][/.-][0-1]?[0-9][/.-][2-9][0-9]{3})\s*(?:<\/td>)?/i);
    if (link && !results.some((r) => r.url.includes(link[1]))) {
      let href = link[1].trim();
      if (!href.startsWith('http')) {
        href = `https://hostels.gbu.ac.in${href.startsWith('/') ? '' : '/'}${href}`;
      }
      const rawTitle = link[2].replace(/<[^>]+>/g, '').trim();
      if (rawTitle.length > 3) {
        results.push({
          source: 'hostel',
          rawTitle,
          url: href,
          dateStr: dateMatch ? dateMatch[1].trim() : 'undated',
        });
      }
    }
  }

  return results;
}

/**
 * Parses announcements and circulars from GBU subdomains (e.g. ohms.gbu.ac.in, csms.gbu.ac.in, digiforms.gbu.ac.in)
 */
export function parseSubdomainHtml(
  html: string,
  source: 'ohms' | 'csms' | 'digiforms' | 'other',
  baseUrl: string,
): ScrapedRawNotice[] {
  const results: ScrapedRawNotice[] = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"']*\.(?:pdf|docx?|jpe?g|png|html?))["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1].trim();
    if (!href.startsWith('http')) {
      href = `${baseUrl.replace(/\/+$/, '')}/${href.replace(/^\/+/, '')}`;
    }
    const rawTitle = match[2].replace(/<[^>]+>/g, '').trim();
    if (rawTitle.length > 3 && !results.some((r) => r.url === href)) {
      results.push({
        source,
        rawTitle,
        url: href,
        dateStr: 'undated',
      });
    }
  }

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowContent = rowMatch[1];
    const link = rowContent.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const dateMatch = rowContent.match(/(?:<td[^>]*>)?\s*([0-3]?[0-9][/.-][0-1]?[0-9][/.-][2-9][0-9]{3})\s*(?:<\/td>)?/i);
    if (link) {
      let href = link[1].trim();
      if (!href.startsWith('http')) {
        href = `${baseUrl.replace(/\/+$/, '')}/${href.replace(/^\/+/, '')}`;
      }
      const rawTitle = link[2].replace(/<[^>]+>/g, '').trim();
      if (rawTitle.length > 3 && !results.some((r) => r.url === href)) {
        results.push({
          source,
          rawTitle,
          url: href,
          dateStr: dateMatch ? dateMatch[1].trim() : 'undated',
        });
      }
    }
  }

  return results;
}

/**
 * The hour (UTC) a published date is anchored to.
 *
 * GBU publishes a day, not a moment. 06:00 UTC is 11:30 in IST, so a
 * notice published this morning is still "published today" when the
 * importance is scored.
 */
const NOTICE_POST_HOUR_UTC = 6;

const GBU_MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Builds an ISO timestamp for a day/month/year, or null when the values do
 * not describe a real date.
 */
function toNoticeIso(year: number, monthIndex: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return null;
  if (year < 1990 || year > 2100) return null;
  if (monthIndex < 0 || monthIndex > 11) return null;
  if (day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, monthIndex, day, NOTICE_POST_HOUR_UTC, 0, 0, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString();
}

/**
 * Parses the date shapes GBU publishes.
 *
 * - the main notices page uses `DD Mon YYYY` ("21 Oct 2026"), the month in
 *   upper or lower case;
 * - the exams portal uses `DD-MM-YYYY` ("Posted on: 01-7-2026") and does
 *   not pad the month;
 * - the worker itself writes `YYYY-MM-DD`.
 *
 * Returns null when the text holds no date at all, so the caller can tell
 * "no date" from "a date we understood".
 */
export function parseGbUNoticeDate(value: string): string | null {
  const text = (value || '').trim();
  if (!text) return null;

  // "DD Mon YYYY" - the shape of the main notices table.
  const named = /(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/.exec(text);
  if (named) {
    const month = GBU_MONTH_INDEX[named[2].toLowerCase().slice(0, 3)];
    if (month !== undefined) {
      return toNoticeIso(Number(named[3]), month, Number(named[1]));
    }
  }

  // "YYYY-MM-DD" - the shape the worker writes itself.
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (iso) {
    return toNoticeIso(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  // "DD-MM-YYYY" / "DD/MM/YYYY" - the exams portal shape. The month is not
  // padded there ("01-7-2026"), and the date may carry a label in front
  // of it ("Posted on: 01-7-2026").
  const numeric = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(text);
  if (numeric) {
    return toNoticeIso(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]));
  }

  return null;
}

/**
 * Enriches raw scraped notices with categorization, audience tags, deadlines, and importance scores
 */
export function enrichScrapedNotice(raw: ScrapedRawNotice): NoticeItem {
  const cleanTitle = cleanNoticeTitle(raw.rawTitle);
  const category = classifyNotice(raw.rawTitle);
  const audience = detectNoticeAudience(raw.rawTitle);
  const deadlineAt = extractNoticeDeadline(raw.rawTitle);

  // Normalise posted date. A date we cannot read is treated as "posted
  // now" - the notice is real, only its date is unknown.
  const postedAt = parseGbUNoticeDate(raw.dateStr) ?? new Date().toISOString();

  const importance = calculateNoticeImportance({
    title: raw.rawTitle,
    category,
    deadlineAt,
    audience,
    postedAt,
  });

  const isPdf = raw.url.toLowerCase().endsWith('.pdf');
  const isImage = raw.url.toLowerCase().endsWith('.jpg') || raw.url.toLowerCase().endsWith('.jpeg') || raw.url.toLowerCase().endsWith('.png');

  return {
    id: `not_${generateSourceId(raw.source, raw.url, raw.dateStr)}`,
    source: raw.source,
    sourceId: generateSourceId(raw.source, raw.url, raw.dateStr),
    title: raw.rawTitle,
    cleanTitle,
    postedAt,
    fileUrl: raw.url,
    fileType: isPdf ? 'pdf' : isImage ? 'image' : 'html',
    category,
    audience,
    importance,
    deadlineAt,
  };
}

/** One source the job reads, with the config that governs it. */
interface JobSource {
  /** The key used in `worker_runs.source`. */
  key: string;
  /** The name of the source, for the logs. */
  name: string;
  /** The primary URL. */
  url: string;
  /** The fallback URL, when there is one. */
  fallbackUrl?: string;
  /** How often the source may be fetched, in minutes. */
  intervalMinutes: number;
  /** The pause between two requests to the same host, in ms. */
  rateLimitMs: number;
  /** The timeout of one request, in ms. */
  timeoutMs: number;
}

export class NoticesWorkerJob {
  private knownSourceIds: Set<string> = new Set();
  private readonly scheduler: SourceScheduler;
  /** The sources that were skipped because their interval had not elapsed. */
  readonly skippedSources: Array<{ source: string; reason: string }> = [];

  constructor(
    existingSourceIds: string[] = [],
    options: { scheduler?: SourceScheduler } = {},
  ) {
    this.knownSourceIds = new Set(existingSourceIds);
    this.scheduler = options.scheduler ?? ALWAYS_FETCH;
  }

  /** Seeds the dedupe set from Supabase-stored source_ids (idempotent reruns). */
  seedKnownSourceIds(ids: Iterable<string>): void {
    for (const id of ids) this.knownSourceIds.add(id);
  }

  /**
   * Fetches a page of the university.
   *
   * The request is polite (a pause before the call), bounded (a timeout) and
   * retried with a backoff, as docs/DATA_SOURCES.md requires.
   */
  async fetchHtml(url: string, timeoutMs: number = 15000): Promise<string> {
    await politeWait(url, this.currentRateLimitMs);

    const response = await fetchWithRetry(
      url,
      { headers: { 'User-Agent': WORKER_CONFIG.userAgent } },
      {
        attempts: 3,
        baseDelayMs: 1000,
        timeoutMs,
        fetchImpl: (target, init) => fetchWithTlsTolerance(target, init),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const html = await response.text();

    // GBU soft-404 trap: unknown paths return HTTP 200 with a ~38,725-byte
    // "404 - Page not found" page. Never treat that as data.
    if (isSoft404(html)) {
      throw new Error(`Soft-404 body for ${url}`);
    }

    return html;
  }

  /** The pause that applies to the request that is currently running. */
  private currentRateLimitMs = 1000;

  /**
   * Reads one source.
   *
   * @param mockHtmlMap The fixture map of a test run. When it is given, the
   *   source is read from it and never from the network - a source that is
   *   not in the map is empty.
   * @param mockKey The key of the source in the fixture map.
   * @returns The HTML of the source, or an empty string when the source
   *   could not be read (the reason is in `error`).
   */
  private async readSource(
    source: JobSource,
    mockHtmlMap: Record<string, string> | undefined,
    mockKey: string,
  ): Promise<{ html: string; error?: string; skipped?: string }> {
    if (mockHtmlMap) {
      return { html: mockHtmlMap[mockKey] ?? '' };
    }

    const decision = await this.scheduler.shouldFetch(source.key, source.intervalMinutes);
    if (decision.skip) {
      const reason = `${source.name}: skipped (${decision.reason})`;
      this.skippedSources.push({ source: source.key, reason });
      console.log(JSON.stringify({ event: 'worker_source_skipped', source: source.key, reason: decision.reason }));
      return { html: '', skipped: decision.reason };
    }

    this.currentRateLimitMs = source.rateLimitMs;
    try {
      const html = await this.fetchHtml(source.url, source.timeoutMs);
      await this.scheduler.markFetched(source.key, 0);
      return { html };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Worker: ${source.name} fetch failed, trying fallback:`, message);
      if (source.fallbackUrl) {
        try {
          const html = await this.fetchHtml(source.fallbackUrl, source.timeoutMs);
          await this.scheduler.markFetched(source.key, 0);
          return { html };
        } catch (err2) {
          const fallbackMessage = err2 instanceof Error ? err2.message : String(err2);
          console.warn(`Worker: ${source.name} fallback failed:`, fallbackMessage);
          return { html: '', error: `${message}; fallback: ${fallbackMessage}` };
        }
      }
      return { html: '', error: message };
    }
  }

  /**
   * Scrapes, processes and returns enriched notices and push notifications
   */
  async runJob(mockHtmlMap?: Record<string, string>): Promise<NoticesWorkerResult> {
    const scraped: ScrapedRawNotice[] = [];
    const sourceResults: SourceParseResult[] = [];

    /**
     * Records how one source fared.
     *
     * A source that answered but yielded nothing is "suspicious": the page
     * layout probably changed. The rows that were stored earlier are kept -
     * an empty parse must never be treated as "there are no notices".
     *
     * A source that was skipped because its interval had not elapsed is not
     * suspicious: it was never asked.
     */
    const record = (
      source: string,
      items: unknown[],
      error?: string,
      skipped?: string,
    ): void => {
      const suspicious = !skipped && isEmptyParseSuspicious(items);
      sourceResults.push({
        source,
        count: items.length,
        failed: Boolean(error),
        suspicious,
        skipped: Boolean(skipped),
        reason:
          error ??
          skipped ??
          (suspicious ? 'empty parse (possible layout change)' : undefined),
      });
    };

    // 1. Main notices
    {
      const source: JobSource = {
        key: SOURCE_KEYS.mainNotices,
        name: WORKER_CONFIG.sources.mainNotices.name,
        url: WORKER_CONFIG.sources.mainNotices.url,
        fallbackUrl: WORKER_CONFIG.sources.mainNotices.fallbackUrl,
        intervalMinutes: WORKER_CONFIG.sources.mainNotices.intervalMinutes,
        rateLimitMs: WORKER_CONFIG.sources.mainNotices.rateLimitMs,
        timeoutMs: WORKER_CONFIG.sources.mainNotices.timeoutMs,
      };
      const { html, error, skipped } = await this.readSource(source, mockHtmlMap, 'main');
      const items = html ? parseMainNoticesHtml(html) : [];
      scraped.push(...items);
      record('main', items, error, skipped);
    }

    // 2. Exams notices
    {
      const source: JobSource = {
        key: SOURCE_KEYS.examsNotices,
        name: WORKER_CONFIG.sources.examsNotices.name,
        url: WORKER_CONFIG.sources.examsNotices.url,
        fallbackUrl: WORKER_CONFIG.sources.examsNotices.fallbackUrl,
        intervalMinutes: WORKER_CONFIG.sources.examsNotices.intervalMinutes,
        rateLimitMs: WORKER_CONFIG.sources.examsNotices.rateLimitMs,
        timeoutMs: WORKER_CONFIG.sources.examsNotices.timeoutMs,
      };
      const { html, error, skipped } = await this.readSource(source, mockHtmlMap, 'exams');
      const items = html ? parseExamsNoticesHtml(html) : [];
      scraped.push(...items);
      record('exams', items, error, skipped);
    }

    // 3. Hostel notices
    {
      const source: JobSource = {
        key: SOURCE_KEYS.hostels,
        name: WORKER_CONFIG.sources.hostels.name,
        url: WORKER_CONFIG.sources.hostels.url,
        intervalMinutes: WORKER_CONFIG.sources.hostels.intervalMinutes,
        rateLimitMs: WORKER_CONFIG.sources.hostels.rateLimitMs,
        timeoutMs: WORKER_CONFIG.sources.hostels.timeoutMs,
      };
      const { html, error, skipped } = await this.readSource(source, mockHtmlMap, 'hostel');
      const items = html ? parseHostelNoticesHtml(html) : [];
      scraped.push(...items);
      record('hostel', items, error, skipped);
    }

    // 4. OHMS notices
    {
      const source: JobSource = {
        key: SOURCE_KEYS.ohms,
        name: WORKER_CONFIG.sources.ohms.name,
        url: WORKER_CONFIG.sources.ohms.url,
        intervalMinutes: WORKER_CONFIG.sources.ohms.intervalMinutes,
        rateLimitMs: WORKER_CONFIG.sources.ohms.rateLimitMs,
        timeoutMs: WORKER_CONFIG.sources.ohms.timeoutMs,
      };
      const { html, error, skipped } = await this.readSource(source, mockHtmlMap, 'ohms');
      const items = html ? parseSubdomainHtml(html, 'ohms', WORKER_CONFIG.sources.ohms.url) : [];
      scraped.push(...items);
      record('ohms', items, error, skipped);
    }

    // 5. CSMS notices
    {
      const source: JobSource = {
        key: SOURCE_KEYS.csms,
        name: WORKER_CONFIG.sources.csms.name,
        url: WORKER_CONFIG.sources.csms.url,
        intervalMinutes: WORKER_CONFIG.sources.csms.intervalMinutes,
        rateLimitMs: WORKER_CONFIG.sources.csms.rateLimitMs,
        timeoutMs: WORKER_CONFIG.sources.csms.timeoutMs,
      };
      const { html, error, skipped } = await this.readSource(source, mockHtmlMap, 'csms');
      const items = html ? parseSubdomainHtml(html, 'csms', WORKER_CONFIG.sources.csms.url) : [];
      scraped.push(...items);
      record('csms', items, error, skipped);
    }

    // 6. DigiForms notices
    {
      const source: JobSource = {
        key: SOURCE_KEYS.digiforms,
        name: WORKER_CONFIG.sources.digiforms.name,
        url: WORKER_CONFIG.sources.digiforms.url,
        intervalMinutes: WORKER_CONFIG.sources.digiforms.intervalMinutes,
        rateLimitMs: WORKER_CONFIG.sources.digiforms.rateLimitMs,
        timeoutMs: WORKER_CONFIG.sources.digiforms.timeoutMs,
      };
      const { html, error, skipped } = await this.readSource(source, mockHtmlMap, 'digiforms');
      const items = html
        ? parseSubdomainHtml(html, 'digiforms', WORKER_CONFIG.sources.digiforms.url)
        : [];
      scraped.push(...items);
      record('digiforms', items, error, skipped);
    }

    // 7. Enrich & Deduplicate
    const enrichedItems: NoticeItem[] = [];
    const newItems: NoticeItem[] = [];

    for (const raw of scraped) {
      const enriched = enrichScrapedNotice(raw);
      enrichedItems.push(enriched);

      if (!this.knownSourceIds.has(enriched.sourceId)) {
        this.knownSourceIds.add(enriched.sourceId);
        newItems.push(enriched);
      }
    }

    // 8. Thread grouping
    const grouped = groupNoticeThreads(enrichedItems);

    // 9. Select push candidates (importance >= 3)
    const pushCandidates = grouped.filter((n) => n.importance >= 3);

    return {
      totalScraped: scraped.length,
      newNoticesCount: newItems.length,
      highPriorityPushCount: pushCandidates.length,
      notices: grouped,
      pushCandidates,
      newSourceIds: newItems.map((n) => n.sourceId),
      timestamp: new Date().toISOString(),
      sourceResults,
    };
  }
}
