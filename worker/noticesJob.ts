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
  source: 'main' | 'exams' | 'hostel' | 'other';
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
 */
export function parseMainNoticesHtml(html: string): ScrapedRawNotice[] {
  const results: ScrapedRawNotice[] = [];
  // GBU table pattern: <tr> ... <td>date</td> ... <a href="url">title</a> ... </tr>
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowContent = rowMatch[1];
    // Find link
    const linkMatch = rowContent.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    // Find date (e.g. DD/MM/YYYY or DD-MM-YYYY)
    const dateMatch = rowContent.match(/(?:<td[^>]*>)?\s*([0-3]?[0-9][/-][0-1]?[0-9][/-][2-9][0-9]{3})\s*(?:<\/td>)?/i);

    if (linkMatch) {
      let href = linkMatch[1].trim();
      if (!href.startsWith('http')) {
        href = `https://test.gbu.ac.in${href.startsWith('/') ? '' : '/'}${href}`;
      }
      const rawTitle = linkMatch[2].replace(/<[^>]+>/g, '').trim();
      const dateStr = dateMatch ? dateMatch[1].trim() : new Date().toISOString().split('T')[0];

      if (rawTitle.length > 2) {
        results.push({
          source: 'main',
          rawTitle,
          url: href,
          dateStr,
        });
      }
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
 * Enriches raw scraped notices with categorization, audience tags, deadlines, and importance scores
 */
export function enrichScrapedNotice(raw: ScrapedRawNotice): NoticeItem {
  const cleanTitle = cleanNoticeTitle(raw.rawTitle);
  const category = classifyNotice(raw.rawTitle);
  const audience = detectNoticeAudience(raw.rawTitle);
  const deadlineAt = extractNoticeDeadline(raw.rawTitle);

  // Normalise posted date
  let postedAt = new Date().toISOString();
  if (raw.dateStr.includes('/') || raw.dateStr.includes('-')) {
    const parts = raw.dateStr.split(/[/-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
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
    if (mockHtmlMap && mockHtmlMap.main) {
      mainHtml = mockHtmlMap.main;
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
    if (mockHtmlMap && mockHtmlMap.exams) {
      examsHtml = mockHtmlMap.exams;
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

    // 3. Enrich & Deduplicate
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
