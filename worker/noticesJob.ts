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
 * Enriches raw scraped notices with categorization, audience tags, deadlines, and importance scores
 */
export function enrichScrapedNotice(raw: ScrapedRawNotice): NoticeItem {
  const cleanTitle = cleanNoticeTitle(raw.rawTitle);
  const category = classifyNotice(raw.rawTitle);
  const audience = detectNoticeAudience(raw.rawTitle);
  const deadlineAt = extractNoticeDeadline(raw.rawTitle);

  // Normalise posted date
  let postedAt = new Date().toISOString();
  if (raw.dateStr) {
    const parts = raw.dateStr.split(/[/.-]/);
    if (parts.length === 3) {
      let day: number, month: number, year: number;
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        // DD-MM-YYYY or DD/MM/YYYY
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
      }
      try {
        postedAt = new Date(Date.UTC(year, month, day, 6, 0, 0)).toISOString();
      } catch {
        postedAt = new Date().toISOString();
      }
    }
  }

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

  async fetchHtml(url: string, timeoutMs: number = 15000): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': WORKER_CONFIG.userAgent,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }

      return await response.text();
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
        console.warn('Worker: Exams notices fetch failed:', err);
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
      timestamp: new Date().toISOString(),
    };
  }
}
