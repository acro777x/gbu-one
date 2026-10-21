/**
 * GBU One — Notices Scraper & Enrichment Worker Job
 * Scrapes https://test.gbu.ac.in/page/notices and https://exams.gbu.ac.in
 * Per docs/DATA_SOURCES.md, docs/ARCHITECTURE.md, docs/NOTIFICATIONS.md
 */

import {
  NoticeItem,
  cleanNoticeTitle,
  classifyNotice,
  detectNoticeAudience,
  calculateNoticeImportance,
  extractNoticeDeadline,
  groupNoticeThreads,
} from '../src/features/notices/noticeService';
import { WORKER_CONFIG } from './sources.config';

export interface ScrapedRawNotice {
  source: 'main' | 'exams' | 'hostel' | 'ohms' | 'csms' | 'digiforms' | 'other';
  rawTitle: string;
  url: string;
  dateStr: string;
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
}

/**
 * Generates deterministic sourceId hash from source, url, and date
 */
export function generateSourceId(source: string, url: string, dateStr: string): string {
  const input = `${source}_${url.trim().toLowerCase()}_${dateStr.trim()}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `src_${Math.abs(hash).toString(36)}`;
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
      href = `https://test.gbu.ac.in${href.startsWith('/') ? '' : '/'}${href}`;
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
 * Parses HTML from Exams portal (exams.gbu.ac.in)
 */
export function parseExamsNoticesHtml(html: string): ScrapedRawNotice[] {
  const results: ScrapedRawNotice[] = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"']*(?:uploads\/notices\/|admin\/public\/uploads\/)[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1].trim();
    if (!href.startsWith('http')) {
      href = `https://exams.gbu.ac.in${href.startsWith('/') ? '' : '/'}${href}`;
    }
    const rawTitle = match[2].replace(/<[^>]+>/g, '').trim();
    if (rawTitle.length > 3) {
      results.push({
        source: 'exams',
        rawTitle,
        url: href,
        dateStr: new Date().toISOString().split('T')[0],
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
      href = `http://hostels.gbu.ac.in${href.startsWith('/') ? '' : '/'}${href}`;
    }
    const rawTitle = match[2].replace(/<[^>]+>/g, '').trim();
    if (rawTitle.length > 3) {
      results.push({
        source: 'hostel',
        rawTitle,
        url: href,
        dateStr: new Date().toISOString().split('T')[0],
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
        href = `http://hostels.gbu.ac.in${href.startsWith('/') ? '' : '/'}${href}`;
      }
      const rawTitle = link[2].replace(/<[^>]+>/g, '').trim();
      if (rawTitle.length > 3) {
        results.push({
          source: 'hostel',
          rawTitle,
          url: href,
          dateStr: dateMatch ? dateMatch[1].trim() : new Date().toISOString().split('T')[0],
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
        dateStr: new Date().toISOString().split('T')[0],
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
          dateStr: dateMatch ? dateMatch[1].trim() : new Date().toISOString().split('T')[0],
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

export class NoticesWorkerJob {
  private knownSourceIds: Set<string> = new Set();

  constructor(existingSourceIds: string[] = []) {
    this.knownSourceIds = new Set(existingSourceIds);
  }

  /** Seeds the dedupe set from Supabase-stored source_ids (idempotent reruns). */
  seedKnownSourceIds(ids: Iterable<string>): void {
    for (const id of ids) this.knownSourceIds.add(id);
  }

  async fetchHtml(url: string, timeoutMs: number = 15000): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchWithTlsTolerance(url, {
        headers: {
          'User-Agent': WORKER_CONFIG.userAgent,
        },
        signal: controller.signal,
      });

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
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Scrapes, processes and returns enriched notices and push notifications
   */
  async runJob(mockHtmlMap?: Record<string, string>): Promise<NoticesWorkerResult> {
    const scraped: ScrapedRawNotice[] = [];

    // 1. Main notices
    let mainHtml = '';
    if (mockHtmlMap) {
      mainHtml = mockHtmlMap.main || '';
    } else {
      try {
        mainHtml = await this.fetchHtml(WORKER_CONFIG.sources.mainNotices.url);
      } catch (err) {
        console.warn('Worker: Main notices fetch failed, trying fallback:', err);
        try {
          mainHtml = await this.fetchHtml(WORKER_CONFIG.sources.mainNotices.fallbackUrl);
        } catch (e2) {
          console.warn('Worker: Main notices fallback failed:', e2);
        }
      }
    }

    if (mainHtml) {
      const mainItems = parseMainNoticesHtml(mainHtml);
      scraped.push(...mainItems);
    }

    // 2. Exams notices
    let examsHtml = '';
    if (mockHtmlMap) {
      examsHtml = mockHtmlMap.exams || '';
    } else {
      try {
        examsHtml = await this.fetchHtml(WORKER_CONFIG.sources.examsNotices.url);
      } catch (err) {
        console.warn('Worker: Exams notices fetch failed, trying fallback:', err);
        try {
          const fb = WORKER_CONFIG.sources.examsNotices.fallbackUrl;
          if (fb) examsHtml = await this.fetchHtml(fb);
        } catch (e2) {
          console.warn('Worker: Exams fallback failed:', e2);
        }
      }
    }

    if (examsHtml) {
      const examItems = parseExamsNoticesHtml(examsHtml);
      scraped.push(...examItems);
    }

    // 3. Hostel notices
    let hostelHtml = '';
    if (mockHtmlMap) {
      hostelHtml = mockHtmlMap.hostel || '';
    } else {
      try {
        hostelHtml = await this.fetchHtml(WORKER_CONFIG.sources.hostels.url);
      } catch (err) {
        console.warn('Worker: Hostel notices fetch failed:', err);
      }
    }

    if (hostelHtml) {
      const hostelItems = parseHostelNoticesHtml(hostelHtml);
      scraped.push(...hostelItems);
    }

    // 4. OHMS notices
    let ohmsHtml = '';
    if (mockHtmlMap) {
      ohmsHtml = mockHtmlMap.ohms || '';
    } else if (WORKER_CONFIG.sources.ohms) {
      try {
        ohmsHtml = await this.fetchHtml(WORKER_CONFIG.sources.ohms.url);
      } catch (err) {
        console.warn('Worker: OHMS notices fetch failed:', err);
      }
    }
    if (ohmsHtml) {
      const ohmsItems = parseSubdomainHtml(ohmsHtml, 'ohms', WORKER_CONFIG.sources.ohms.url);
      scraped.push(...ohmsItems);
    }

    // 5. CSMS notices
    let csmsHtml = '';
    if (mockHtmlMap) {
      csmsHtml = mockHtmlMap.csms || '';
    } else if (WORKER_CONFIG.sources.csms) {
      try {
        csmsHtml = await this.fetchHtml(WORKER_CONFIG.sources.csms.url);
      } catch (err) {
        console.warn('Worker: CSMS notices fetch failed:', err);
      }
    }
    if (csmsHtml) {
      const csmsItems = parseSubdomainHtml(csmsHtml, 'csms', WORKER_CONFIG.sources.csms.url);
      scraped.push(...csmsItems);
    }

    // 6. DigiForms notices
    let digiHtml = '';
    if (mockHtmlMap) {
      digiHtml = mockHtmlMap.digiforms || '';
    } else if (WORKER_CONFIG.sources.digiforms) {
      try {
        digiHtml = await this.fetchHtml(WORKER_CONFIG.sources.digiforms.url);
      } catch (err) {
        console.warn('Worker: DigiForms notices fetch failed:', err);
      }
    }
    if (digiHtml) {
      const digiItems = parseSubdomainHtml(digiHtml, 'digiforms', WORKER_CONFIG.sources.digiforms.url);
      scraped.push(...digiItems);
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

    // 4. Thread grouping
    const grouped = groupNoticeThreads(enrichedItems);

    // 5. Select push candidates (importance >= 3)
    const pushCandidates = grouped.filter((n) => n.importance >= 3);

    return {
      totalScraped: scraped.length,
      newNoticesCount: newItems.length,
      highPriorityPushCount: pushCandidates.length,
      notices: grouped,
      pushCandidates,
      newSourceIds: newItems.map((n) => n.sourceId),
      timestamp: new Date().toISOString(),
    };
  }
}
