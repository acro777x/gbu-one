/**
 * GBU One — Results Worker Job
 * Scrapes result announcements from https://exams.gbu.ac.in and https://gbuexam.in
 * Per docs/DATA_SOURCES.md, docs/ARCHITECTURE.md, docs/NOTIFICATIONS.md
 */

import { fetchWithTlsTolerance, isSoft404 } from './noticesJob';
import { WORKER_CONFIG } from './sources.config';
import { fetchWithRetry, politeWait } from './http';
import {
  type ResultRecord,
  checkSchema,
  STAGE_TABLES,
  fetchKnownResultUrls,
  fetchPushedResultUrls,
  markResultPushed,
  markResultSeen,
  upsertResults,
  recordWorkerRun,
  isWorkerSupabaseConfigured,
} from './supabaseClient';
import { sendPushForResults } from './pushSender';

export interface ResultsJobResult {
  totalFound: number;
  newResultsCount: number;
  results: ResultRecord[];
  freshResults: ResultRecord[];
  pushCandidates: ResultRecord[];
  reasons: string[];
}

/** Result announcement keyword pattern */
const RESULT_KEYWORDS_RE =
  /\b(?:result\s+of|grade\s*card|declared|declaration\s+of\s+result|odd\s+sem(?:ester)?|even\s+sem(?:ester)?|end\s+sem(?:ester)?\s+result)\b/i;

/** Exclude notices that are only about admit cards or general circulars without results */
const EXCLUDE_RE = /\b(?:admit\s+card\s+only|tender|mess\s+fee|hostel\s+allotment|admissions?\s+entrance)\b/i;

/**
 * Checks whether a notice or link title announces an examination result
 */
export function isResultAnnouncement(title: string): boolean {
  if (!title || typeof title !== 'string') return false;
  const clean = title.trim();
  if (clean.length < 5) return false;
  if (EXCLUDE_RE.test(clean)) return false;

  if (RESULT_KEYWORDS_RE.test(clean)) return true;

  // Secondary check: has "result" combined with school/programme or semester
  const lower = clean.toLowerCase();
  if (
    lower.includes('result') &&
    (/\b(?:sem|semester|session|b\.?tech|mca|mba|bca|m\.?tech|soict|soe|som|sol)\b/i.test(clean) ||
      /\b(?:declared|published|announced)\b/i.test(clean))
  ) {
    return true;
  }

  return false;
}

/** Map of common roman numerals and numeric ordinals */
const ORDINAL_MAP: Record<string, string> = {
  '1': 'I',
  '1st': 'I',
  first: 'I',
  '2': 'II',
  '2nd': 'II',
  second: 'II',
  '3': 'III',
  '3rd': 'III',
  third: 'III',
  '4': 'IV',
  '4th': 'IV',
  fourth: 'IV',
  '5': 'V',
  '5th': 'V',
  fifth: 'V',
  '6': 'VI',
  '6th': 'VI',
  sixth: 'VI',
  '7': 'VII',
  '7th': 'VII',
  seventh: 'VII',
  '8': 'VIII',
  '8th': 'VIII',
  eighth: 'VIII',
  '9': 'IX',
  '9th': 'IX',
  ninth: 'IX',
  '10': 'X',
  '10th': 'X',
  tenth: 'X',
};

/**
 * Extracts the semester string from title (e.g. 'IV', 'II', 'ODD', 'EVEN')
 */
export function extractSemester(title: string): string {
  if (!title) return '';

  // 1. Explicit Roman numeral sem (e.g. "Sem - IV", "Semester II", "Sem. VI", "Sem-IVth")
  const romanMatch = title.match(/\bsem(?:ester)?\.?\s*[-–:]?\s*([IVX]+)(?:st|nd|rd|th)?\b/i);
  if (romanMatch) {
    return romanMatch[1].toUpperCase();
  }

  // 2. Roman numeral before Semester (e.g. "IV Semester", "II Sem", "IVth Semester", "IInd Sem")
  const romanBeforeMatch = title.match(/\b([IVX]+)(?:st|nd|rd|th)?\s+sem(?:ester)?\b/i);
  if (romanBeforeMatch) {
    return romanBeforeMatch[1].toUpperCase();
  }

  // 3. Numeric ordinal sem (e.g. "4th Semester", "2nd Sem", "Semester 3")
  const ordinalMatch = title.match(
    /\b(\d+(?:st|nd|rd|th)?|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s*sem(?:ester)?\b/i
  );
  if (ordinalMatch) {
    const key = ordinalMatch[1].toLowerCase();
    if (ORDINAL_MAP[key]) return ORDINAL_MAP[key];
  }

  const numAfterSem = title.match(/\bsem(?:ester)?\.?\s*[-–:]?\s*(\d+)(?:st|nd|rd|th)?\b/i);
  if (numAfterSem && ORDINAL_MAP[numAfterSem[1]]) {
    return ORDINAL_MAP[numAfterSem[1]];
  }

  // 4. ODD / EVEN SEM
  const oddEvenMatch = title.match(/\b(ODD|EVEN)\s+SEM(?:ESTER)?\b/i);
  if (oddEvenMatch) {
    return oddEvenMatch[1].toUpperCase();
  }

  return '';
}

/**
 * Extracts academic year or session from title (e.g. '2025-26', '2026-27')
 */
export function extractAcademicYear(title: string, fallbackDate?: string): string {
  if (title) {
    const rangeMatch = title.match(/\b(20\d{2}\s*[-–/]\s*(?:20)?\d{2})\b/);
    if (rangeMatch) {
      return rangeMatch[1].replace(/\s+/g, '').replace('–', '-');
    }
    const singleYear = title.match(/\b(202[4-9])\b/);
    if (singleYear) {
      const y = parseInt(singleYear[1], 10);
      return `${y}-${String(y + 1).slice(-2)}`;
    }
  }

  if (fallbackDate) {
    const yearMatch = fallbackDate.match(/\b(202[4-9])\b/);
    if (yearMatch) {
      const y = parseInt(yearMatch[1], 10);
      return `${y}-${String(y + 1).slice(-2)}`;
    }
  }

  return '2026-27';
}

/**
 * Extracts programme or school code from announcement title
 */
export function extractProgramme(title: string): string {
  if (!title) return 'All Programmes';

  // 1. Detailed program patterns with specialization (supporting CS/CSE, EC/ECE, IT, AI, EE)
  const cseMatch = title.match(
    /\b(?:B\.?\s*Tech\.?(?:\s*-\s*M\.?\s*Tech\.?)?|Integrated\s+B\.?Tech\.?)\s*(?:\(?\s*(?:CSE|CS|Computer\s+Science(?:\s*&\s*Engineering)?)\s*\)?)/i
  );
  if (cseMatch) return 'B.Tech CSE';

  const eceMatch = title.match(
    /\b(?:B\.?\s*Tech\.?|Integrated\s+B\.?Tech\.?)\s*(?:\(?\s*(?:ECE|EC|Electronics(?:\s*&\s*Communication)?)\s*\)?)/i
  );
  if (eceMatch) return 'B.Tech ECE';

  const itMatch = title.match(
    /\b(?:B\.?\s*Tech\.?|Integrated\s+B\.?Tech\.?)\s*(?:\(?\s*(?:IT|Information\s+Technology)\s*\)?)/i
  );
  if (itMatch) return 'B.Tech IT';

  const aiMatch = title.match(
    /\b(?:B\.?\s*Tech\.?|Integrated\s+B\.?Tech\.?)\s*(?:\(?\s*(?:AI|Artificial\s+Intelligence)\s*\)?)/i
  );
  if (aiMatch) return 'B.Tech AI';

  const eeMatch = title.match(
    /\b(?:B\.?\s*Tech\.?|Integrated\s+B\.?Tech\.?)\s*(?:\(?\s*(?:EE|Electrical(?:\s*Engineering)?)\s*\)?)/i
  );
  if (eeMatch) return 'B.Tech EE';

  const meMatch = title.match(
    /\b(?:B\.?\s*Tech\.?)\s*(?:\(?\s*(?:ME|Mechanical)\s*\)?)/i
  );
  if (meMatch) return 'B.Tech ME';

  const civilMatch = title.match(
    /\b(?:B\.?\s*Tech\.?)\s*(?:\(?\s*(?:Civil|CE)\s*\)?)/i
  );
  if (civilMatch) return 'B.Tech Civil';

  const btMatch = title.match(
    /\b(?:B\.?\s*Tech\.?)\s*(?:\(?\s*(?:BT|Biotech(?:nology)?)\s*\)?)/i
  );
  if (btMatch) return 'B.Tech Biotechnology';

  // 2. Specific degree codes
  if (/\bMCA\b/i.test(title)) return 'MCA';
  if (/\bBCA\b/i.test(title)) return 'BCA';
  if (/\bMBA\b/i.test(title)) return 'MBA';
  if (/\bBBA\b/i.test(title)) return 'BBA';
  if (/\bB\.?\s*Com\b/i.test(title)) return 'B.Com';
  if (/\bM\.?\s*Com\b/i.test(title)) return 'M.Com';
  if (/\bB\.?\s*Arch\b/i.test(title)) return 'B.Arch';
  if (/\bM\.?\s*Arch\b/i.test(title)) return 'M.Arch';
  if (/\bB\.?\s*Des\b/i.test(title)) return 'B.Des';
  if (/\bM\.?\s*Des\b/i.test(title)) return 'M.Des';
  if (/\bB\.?A\.?\s*LL\.?B\b/i.test(title)) return 'B.A. LL.B';
  if (/\bBBA\s*LL\.?B\b/i.test(title)) return 'BBA LL.B';
  if (/\bLL\.?M\b/i.test(title)) return 'LL.M';
  if (/\bLL\.?B\b/i.test(title)) return 'LL.B';
  if (/\bB\.?\s*Pharm\b/i.test(title)) return 'B.Pharm';
  if (/\bM\.?\s*Pharm\b/i.test(title)) return 'M.Pharm';
  if (/\bPh\.?\s*D\b/i.test(title)) return 'Ph.D';
  if (/\bM\.?\s*Tech\b/i.test(title)) return 'M.Tech';
  if (/\bB\.?\s*Tech\b/i.test(title)) return 'B.Tech';
  if (/\bB\.?\s*Sc\b/i.test(title)) return 'B.Sc';
  if (/\bM\.?\s*Sc\b/i.test(title)) return 'M.Sc';
  if (/\bB\.?\s*A\b/i.test(title)) return 'B.A.';
  if (/\bM\.?\s*A\b/i.test(title)) return 'M.A.';

  // 3. School codes
  const schoolMatch = title.match(/\b(SOICT|SOE|SOM|SOL|SOBSC|SOBT|SOHSS|SOVSAS)\b/i);
  if (schoolMatch) return schoolMatch[1].toUpperCase();

  return 'All Programmes';
}

/** Decode simple HTML entities */
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Parses announcement dates in DD-MM-YYYY, DD/MM/YYYY, DD Mon YYYY, or ISO formats
 */
export function parseAnnouncementDate(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString();
  const trimmed = dateStr.trim();
  // Match DD-MM-YYYY, DD/MM/YYYY, or DD.MM.YYYY
  const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00.000Z`;
    const dt = new Date(iso);
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }
  // Match DD-Mon-YYYY, DD Mon YYYY, DD/Mon/YYYY
  const monthNames = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  ];
  const dMonY = trimmed.match(/^(\d{1,2})[\s/-]+([A-Za-z]{3,9})[\s/-]+(\d{4})$/);
  if (dMonY) {
    const [, d, mon, y] = dMonY;
    const monthIndex = monthNames.indexOf(mon.slice(0, 3).toLowerCase());
    if (monthIndex >= 0) {
      const dt = new Date(Date.UTC(Number(y), monthIndex, Number(d), 0, 0, 0));
      if (!isNaN(dt.getTime())) return dt.toISOString();
    }
  }
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

/**
 * Parses HTML from exams.gbu.ac.in or gbuexam.in and returns structured ResultRecords
 */
export function parseResultAnnouncementsHtml(
  html: string,
  baseUrl = 'https://exams.gbu.ac.in'
): ResultRecord[] {
  if (!html || isSoft404(html)) return [];

  const results: ResultRecord[] = [];
  const seenUrls = new Set<string>();

  // Helper to resolve URLs
  const toAbsoluteUrl = (href: string): string => {
    const clean = href.trim().replace(/^~\//, '/');
    if (/^https?:\/\//i.test(clean)) return clean;
    const base = baseUrl.replace(/\/+$/, '');
    return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
  };

  // 1. Structure: <div class="notice-item ...">
  const blockRegex =
    /<div\b[^>]*class\s*=\s*"[^"]*notice-item[^"]*"[^>]*>([\s\S]*?)(?=<div\b[^>]*class\s*=\s*"[^"]*notice-item[^"]*"[^>]*>|$)/gi;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const block = blockMatch[1];
    const hMatch = block.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
    const linkMatch = block.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const dateMatch = block.match(
      /(?:Posted on:|Date:)?\s*([0-3]?[0-9][/.-][0-1]?[0-9][/.-][2-9][0-9]{3}|[0-3]?[0-9][\s/-]+[A-Za-z]{3,9}[\s/-]+[2-9][0-9]{3})/i
    );

    if (hMatch && linkMatch) {
      const rawTitle = decodeEntities(hMatch[1].replace(/<[^>]+>/g, '').trim());
      if (isResultAnnouncement(rawTitle)) {
        const fileUrl = toAbsoluteUrl(linkMatch[1]);
        const urlKey = fileUrl.toLowerCase();
        if (!seenUrls.has(urlKey)) {
          seenUrls.add(urlKey);
          const dateStr = dateMatch ? dateMatch[1].trim() : '';
          results.push({
            title: rawTitle,
            programme: extractProgramme(rawTitle),
            semester: extractSemester(rawTitle),
            academicYear: extractAcademicYear(rawTitle, dateStr),
            fileUrl,
            postedAt: parseAnnouncementDate(dateStr),
          });
        }
      }
    }
  }

  // 2. Table rows: <tr><td>Date</td><td><a href="...">Title</a></td></tr>
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1];
    const link = row.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const dateMatch = row.match(
      /(?:<td[^>]*>)?\s*([0-3]?[0-9][/.-][0-1]?[0-9][/.-][2-9][0-9]{3}|[0-3]?[0-9][\s/-]+[A-Za-z]{3,9}[\s/-]+[2-9][0-9]{3})\s*(?:<\/td>)?/i
    );

    if (link) {
      const title = decodeEntities(link[2].replace(/<[^>]+>/g, '').trim());
      if (isResultAnnouncement(title)) {
        const fileUrl = toAbsoluteUrl(link[1]);
        const urlKey = fileUrl.toLowerCase();
        if (!seenUrls.has(urlKey)) {
          seenUrls.add(urlKey);
          const dateStr = dateMatch ? dateMatch[1].trim() : '';
          results.push({
            title,
            programme: extractProgramme(title),
            semester: extractSemester(title),
            academicYear: extractAcademicYear(title, dateStr),
            fileUrl,
            postedAt: parseAnnouncementDate(dateStr),
          });
        }
      }
    }
  }

  // 3. Direct links with result keywords in anchor text or href
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let singleLink: RegExpExecArray | null;
  while ((singleLink = linkRegex.exec(html)) !== null) {
    const href = singleLink[1].trim();
    const anchorText = decodeEntities(singleLink[2].replace(/<[^>]+>/g, '').trim());

    if (isResultAnnouncement(anchorText)) {
      const fileUrl = toAbsoluteUrl(href);
      const urlKey = fileUrl.toLowerCase();
      if (!seenUrls.has(urlKey)) {
        seenUrls.add(urlKey);
        results.push({
          title: anchorText,
          programme: extractProgramme(anchorText),
          semester: extractSemester(anchorText),
          academicYear: extractAcademicYear(anchorText),
          fileUrl,
          postedAt: new Date().toISOString(),
        });
      }
    }
  }

  return results;
}

/**
 * Worker Job to scrape and track published results
 */
export class ResultsWorkerJob {
  private knownUrls = new Set<string>();

  constructor(knownUrls: string[] = []) {
    this.seedKnownUrls(knownUrls);
  }

  seedKnownUrls(urls: string[]): void {
    for (const url of urls) {
      if (url) this.knownUrls.add(url.trim().toLowerCase());
    }
  }

  /**
   * Scrapes result announcements from exams portal sources
   */
  async runJob(
    sources: Array<{ name: string; url: string; fallbackUrl?: string }> = [
      WORKER_CONFIG.sources.examsNotices,
      WORKER_CONFIG.sources.examResults,
    ]
  ): Promise<ResultsJobResult> {
    const reasons: string[] = [];
    const allResults: ResultRecord[] = [];
    const seenUrls = new Set<string>();

    for (const source of sources) {
      let html = '';
      try {
        await politeWait(source.url, WORKER_CONFIG.sources.examResults.rateLimitMs);
        const res = await fetchWithRetry(
          source.url,
          { headers: { 'User-Agent': WORKER_CONFIG.userAgent } },
          {
            attempts: 3,
            baseDelayMs: 1000,
            timeoutMs: WORKER_CONFIG.sources.examResults.timeoutMs,
            fetchImpl: (target, init) => fetchWithTlsTolerance(target, init),
          },
        );
        if (res.ok) {
          html = await res.text();
        } else if (source.fallbackUrl) {
          await politeWait(source.fallbackUrl, WORKER_CONFIG.sources.examResults.rateLimitMs);
          const fallbackRes = await fetchWithRetry(
            source.fallbackUrl,
            { headers: { 'User-Agent': WORKER_CONFIG.userAgent } },
            {
              attempts: 2,
              baseDelayMs: 1000,
              timeoutMs: WORKER_CONFIG.sources.examResults.timeoutMs,
              fetchImpl: (target, init) => fetchWithTlsTolerance(target, init),
            },
          );
          if (fallbackRes.ok) html = await fallbackRes.text();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        reasons.push(`${source.name} fetch failed: ${msg}`);
      }

      if (html) {
        const items = parseResultAnnouncementsHtml(html, source.url);
        for (const item of items) {
          const urlKey = (item.fileUrl || item.file_url)!.toLowerCase();
          if (!seenUrls.has(urlKey)) {
            seenUrls.add(urlKey);
            allResults.push(item);
          }
        }
      }
    }

    const freshResults = allResults.filter(
      (r) => !this.knownUrls.has(((r.fileUrl || r.file_url) || '').toLowerCase())
    );

    return {
      totalFound: allResults.length,
      newResultsCount: freshResults.length,
      results: allResults,
      freshResults,
      pushCandidates: freshResults,
      reasons,
    };
  }
}

/**
 * Integrates Results Stage into worker/run.ts
 */
export async function runResultsStage(): Promise<void> {
  if (!isWorkerSupabaseConfigured()) {
    console.log(JSON.stringify({ event: 'worker_results_skipped', reason: 'no-supabase' }));
    return;
  }

  try {
    // The push log is a table the worker added on top of the schema. When it
    // is missing, the stage cannot say what was already pushed, so it fails
    // instead of pushing the whole backlog.
    const schema = await checkSchema(STAGE_TABLES);
    if (!schema.ok) {
      const message =
        `the results push log is missing (${schema.missing.join(', ') || 'unknown'}` +
        `${schema.error ? `, ${schema.error}` : ''}). ` +
        'The owner has to paste supabase/schema.sql into the Supabase dashboard.';
      console.error(JSON.stringify({ event: 'worker_results_error', error: message }));
      await recordWorkerRun('results', 'error', 0, 0, message);
      throw new Error(message);
    }

    const known = await fetchKnownResultUrls();
    if (!known.ok) {
      // A failed read must not look like "the table is empty": the first
      // sync would then skip every push and look like a healthy run.
      const message = `known result read failed: ${known.error ?? 'unknown error'}`;
      console.error(JSON.stringify({ event: 'worker_results_error', error: message }));
      await recordWorkerRun('results', 'error', 0, 0, message);
      throw new Error(message);
    }
    const knownUrls = known.rows;

    // The push log is what says whether a result was already announced.
    // The results table only says whether the row is stored.
    //
    // A failed read of the push log is dangerous: without it every result
    // looks unpushed and the whole backlog would be pushed at the devices.
    // The stage therefore fails instead of pushing.
    const pushedRead = await fetchPushedResultUrls();
    if (!pushedRead.ok) {
      const message = `result push log read failed: ${pushedRead.error ?? 'unknown error'}`;
      console.error(JSON.stringify({ event: 'worker_results_error', error: message }));
      await recordWorkerRun('results', 'error', 0, 0, message);
      throw new Error(message);
    }
    const pushedUrls = pushedRead.rows;
    const isFirstSync = knownUrls.size === 0 && pushedUrls.size === 0;

    const job = new ResultsWorkerJob([...knownUrls]);
    const result = await job.runJob();

    console.log(
      JSON.stringify({
        event: 'worker_results_scraped',
        total: result.totalFound,
        fresh: result.newResultsCount,
        pushCandidates: result.pushCandidates.length,
        reasons: result.reasons,
      })
    );

    if (result.results.length > 0) {
      const written = await upsertResults(result.results);
      console.log(JSON.stringify({ event: 'worker_results_upserted', written }));
    }

    // Never blast pushes on initial seed / first sync.
    const pushable = isFirstSync ? [] : result.pushCandidates;
    if (pushable.length > 0) {
      // Every candidate is recorded as "seen" first, so a failed push is
      // retried on the next run instead of being lost.
      for (const candidate of pushable) {
        const url = candidate.fileUrl || candidate.file_url || '';
        if (!url) continue;
        await markResultSeen(url, candidate.programme);
      }

      const receipts = await sendPushForResults(pushable, pushedUrls);
      const sent = receipts.reduce((a, r) => a + r.sent, 0);
      console.log(
        JSON.stringify({
          event: 'worker_results_push',
          sent,
          receipts: receipts.length,
        })
      );

      // Only a confirmed send marks the result as pushed.
      for (const receipt of receipts) {
        if (receipt.sent > 0 && !receipt.skipped) {
          await markResultPushed(receipt.fileUrl, receipt.programme, receipt.sent);
        }
      }
    }

    await recordWorkerRun('results', 'ok', result.totalFound, result.newResultsCount);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ event: 'worker_results_error', error: msg }));
    await recordWorkerRun('results', 'error', 0, 0, msg);
    throw err;
  }
}
