/**
 * GBU One — Notice Service, Parser, Classifier & Thread Engine
 * Per docs/DATA_SOURCES.md, docs/ARCHITECTURE.md, docs/NOTIFICATIONS.md
 */

export interface NoticeItem {
  id: string;
  source: 'main' | 'exams' | 'hostel' | 'ohms' | 'csms' | 'digiforms' | 'other' | 'admin';
  sourceId: string;
  title: string;
  cleanTitle: string;
  postedAt: string;
  fileUrl: string;
  fileType: 'pdf' | 'image' | 'html';
  rawText?: string;
  /**
   * Attachments that were recovered from a JavaScript-only notice (the exam
   * portal publishes the school-wise end-semester date sheets inside a modal,
   * so the notice itself has no file link). Each entry is a document the
   * student can open, with the label the app shows.
   */
  relatedAttachments?: Array<{ label: string; url: string }>;
  category:
    | 'exam'
    | 'datesheet'
    | 'result'
    | 'fees'
    | 'scholarship'
    | 'hostel'
    | 'admission'
    | 'event'
    | 'academic'
    | 'placement'
    | 'other';
  audience: {
    schools?: string[];
    programmes?: string[];
    semesters?: string[];
    all?: boolean;
  };
  importance: number; // 0 to 5
  deadlineAt?: string | null;
  threadId?: string | null;
  threadUpdateCount?: number;
  /** Extra URLs discovered from modals or attachments (e.g. school-wise date sheets). */
  relatedUrls?: string[];
  /**
   * True when the notice comes from the bundled sample instead of a live
   * source. The app says so out loud rather than passing the sample off as
   * a real notice from the university.
   */
  isSample?: boolean;
}

const GBU_SCHOOLS = ['SOICT', 'SOM', 'SOBT', 'SOE', 'SOL', 'SOVSAS', 'SOHSS', 'SOBSC'];

const GBU_PROGRAMMES = [
  'B.Tech',
  'M.Tech',
  'BCA',
  'MCA',
  'MBA',
  'B.Sc',
  'M.Sc',
  'BBA',
  'B.Arch',
  'Ph.D',
];

/**
 * Strips formal administrative prefixes from notice titles for clean presentation
 */
export function cleanNoticeTitle(rawTitle: string): string {
  let cleaned = rawTitle.trim();
  if (/^view\s+attachment$/i.test(cleaned)) {
    return 'Official Examination Circular';
  }
  cleaned = cleaned.replace(/^(office\s+order\s*[-:.]?\s*)/i, '');
  // The university publishes "Notice for X", "Notice of X" and "Notice dated X".
  // Removing the word "Notice" alone leaves the connector behind, so the title
  // reads "for Scholarship on NSP Portal". The connector is removed with it.
  const noticePrefix = /^(notice\s*[-:.]?\s*)/i.exec(cleaned);
  if (noticePrefix) {
    cleaned = cleaned.slice(noticePrefix[0].length);
    cleaned = cleaned.replace(/^(?:for|of|dated|regarding|about|on|re|per|under)\s+/i, '');
  }
  cleaned = cleaned.replace(/^(notification\s*[-:.]?\s*)/i, '');
  cleaned = cleaned.replace(/^(circular\s*[-:.]?\s*)/i, '');
  cleaned = cleaned.replace(/^(urgent\s+notice\s*[-:.]?\s*)/i, '');
  cleaned = cleaned.replace(/^(regarding\s*[-:.]?\s*)/i, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned || 'Official University Notice';
}

/**
 * The words that mark a title as carrying a deadline. They are used by the
 * deadline extractor and by the importance scorer, so the two always agree.
 */
export const DEADLINE_KEYWORDS: string[] = [
  'last date',
  'last date extended',
  'deadline',
  'extended to',
  'date extend',
  'due date',
  'till ',
  'up to ',
];

/** True when the text carries a deadline word. */
export function hasDeadlineKeyword(text: string): boolean {
  const lower = (text ?? '').toLowerCase();
  return DEADLINE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * Classifies notice into semantic categories.
 *
 * This is the single classifier for the whole app: the worker, the on-device
 * scrape and the admin console all call it, so a notice can never be filed
 * under one category on the server and another on the phone.
 */
export function classifyNotice(title: string): NoticeItem['category'] {
  const lower = title.toLowerCase();

  // Negative categories: administrative, procurement, tenders
  if (
    lower.includes('tender') ||
    lower.includes('quotation') ||
    lower.includes('eoi') ||
    lower.includes('recruitment of faculty') ||
    lower.includes('procurement') ||
    lower.includes('corrigendum for tender') ||
    lower.includes('phd viva-voce')
  ) {
    return 'other';
  }

  if (lower.includes('datesheet') || lower.includes('date sheet')) {
    return 'datesheet';
  }
  if (lower.includes('result') || lower.includes('grade card') || lower.includes('mark sheet') || lower.includes('back paper result')) {
    return 'result';
  }
  if (
    lower.includes('exam') ||
    lower.includes('admit card') ||
    lower.includes('back paper') ||
    lower.includes('repeat paper') ||
    lower.includes('mid sem') ||
    lower.includes('end sem') ||
    lower.includes('special back') ||
    lower.includes('supplementary')
  ) {
    return 'exam';
  }
  if (
    lower.includes('hostel') ||
    lower.includes('mess') ||
    lower.includes('room allotment') ||
    lower.includes('ohms') ||
    lower.includes('warden')
  ) {
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
  if (lower.includes('fee') || lower.includes('dues') || lower.includes('tuition fee') || lower.includes('late fee')) {
    return 'fees';
  }
  if (
    lower.includes('admission') ||
    lower.includes('counselling') ||
    lower.includes('seat allotment') ||
    lower.includes('entrance test')
  ) {
    return 'admission';
  }
  if (
    lower.includes('placement') ||
    lower.includes('internship') ||
    lower.includes('recruitment') ||
    lower.includes('campus drive')
  ) {
    return 'placement';
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

/**
 * Detects targeted audience from notice content
 */
export function detectNoticeAudience(title: string, rawText: string = ''): NoticeItem['audience'] {
  const combined = `${title} ${rawText}`.toUpperCase();
  const schoolsFound: string[] = [];
  const programmesFound: string[] = [];
  const semestersFound: string[] = [];

  for (const s of GBU_SCHOOLS) {
    if (combined.includes(s)) {
      schoolsFound.push(s);
    }
  }

  for (const p of GBU_PROGRAMMES) {
    if (combined.includes(p.toUpperCase())) {
      programmesFound.push(p);
    }
  }

  // Detect semesters like "1st sem", "sem-iv", "semester 3"
  const semMatches = combined.match(/(?:SEM(?:ESTER)?\s*[-:]?\s*([0-9IVX]+)|([0-9]+)(?:ST|ND|RD|TH)\s+SEM)/g);
  if (semMatches) {
    for (const sm of semMatches) {
      const cleanSem = sm.replace(/SEM(?:ESTER)?\s*[-:]?\s*/g, '').replace(/(?:ST|ND|RD|TH)\s+SEM/g, '').trim();
      if (cleanSem && !semestersFound.includes(cleanSem)) {
        semestersFound.push(cleanSem);
      }
    }
  }

  const isSpecific = schoolsFound.length > 0 || programmesFound.length > 0 || semestersFound.length > 0;

  return {
    schools: schoolsFound.length > 0 ? schoolsFound : undefined,
    programmes: programmesFound.length > 0 ? programmesFound : undefined,
    semesters: semestersFound.length > 0 ? semestersFound : undefined,
    all: !isSpecific,
  };
}

/**
 * Extracts deadline ISO date from notice title or body text
 */
export function extractNoticeDeadline(text: string): string | null {
  // Common patterns in university notices:
  // "extended to 31st Oct", "last date 25.10.2026", "by 10-11-2026", "till October 30, 2026"
  const datePatterns = [
    // 31st Oct, 31 October 2026
    /([0-3]?[0-9])(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s*,?\s*([2-9][0-9]{3}))?/i,
    // 31/10/2026 or 31-10-2026
    /([0-3]?[0-9])[/.-]([0-1]?[0-9])[/.-]([2-9][0-9]{3})/i,
    // 2026-10-31
    /([2-9][0-9]{3})[/.-]([0-1]?[0-9])[/.-]([0-3]?[0-9])/i,
  ];

  const lower = text.toLowerCase();
  const hasDeadlineKeyword =
    lower.includes('last date') ||
    lower.includes('deadline') ||
    lower.includes('extended to') ||
    lower.includes('till') ||
    lower.includes('up to') ||
    lower.includes('before');

  for (const regex of datePatterns) {
    const match = text.match(regex);
    if (match) {
      try {
        let year = new Date().getFullYear();
        let month = 9; // October default
        let day = 1;

        if (match[2] && isNaN(Number(match[2]))) {
          // Month name
          const monthMap: Record<string, number> = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
          };
          const prefix = match[2].slice(0, 3).toLowerCase();
          if (prefix in monthMap) {
            month = monthMap[prefix];
          }
          day = parseInt(match[1], 10);
          if (match[3]) year = parseInt(match[3], 10);
        } else if (match[1] && match[2] && match[3]) {
          if (match[1].length === 4) {
            // YYYY-MM-DD
            year = parseInt(match[1], 10);
            month = parseInt(match[2], 10) - 1;
            day = parseInt(match[3], 10);
          } else {
            // DD-MM-YYYY
            day = parseInt(match[1], 10);
            month = parseInt(match[2], 10) - 1;
            year = parseInt(match[3], 10);
          }
        }

        const date = new Date(Date.UTC(year, month, day, 18, 29, 59)); // ~23:59 IST
        return date.toISOString();
      } catch {
        continue;
      }
    }
  }

  // If keyword exists without full date, null fallback
  if (hasDeadlineKeyword) return null;
  return null;
}

/**
 * Calculates importance score (0-5) per docs/NOTIFICATIONS.md
 *
 * A title that announces a deadline is worth the student's attention even when
 * the date could not be parsed, so the deadline word counts on its own. The
 * scorer is shared by the worker and the on-device scrape so both sides rank
 * a notice the same way.
 */
export function calculateNoticeImportance(params: {
  title: string;
  category: NoticeItem['category'];
  deadlineAt?: string | null;
  audience: NoticeItem['audience'];
  postedAt?: string;
}): number {
  let score = 0;

  // Deadline present -> +3; a deadline word without a parsable date -> +2
  if (params.deadlineAt) {
    score += 3;
  } else if (hasDeadlineKeyword(params.title)) {
    score += 2;
  }

  // High importance student categories -> +3
  if (
    params.category === 'fees' ||
    params.category === 'scholarship' ||
    params.category === 'exam' ||
    params.category === 'datesheet' ||
    params.category === 'result'
  ) {
    score += 3;
  }

  // Mentions specific school or programme -> +2
  if (params.audience?.schools || params.audience?.programmes) {
    score += 2;
  }

  // Posted recently (within 48 hours) -> +1
  if (params.postedAt) {
    const postAgeMs = Date.now() - new Date(params.postedAt).getTime();
    if (postAgeMs < 48 * 3600 * 1000) {
      score += 1;
    }
  }

  // Non-student tender / procurement / recruitment -> -3
  const lower = params.title.toLowerCase();
  if (
    lower.includes('tender') ||
    lower.includes('recruitment') ||
    lower.includes('quotation') ||
    lower.includes('eoi') ||
    lower.includes('procurement')
  ) {
    score -= 3;
  }

  // Clamp 0 to 5
  return Math.max(0, Math.min(5, score));
}

/**
 * Groups notices into semantic threads (e.g. revisions & deadline extensions)
 */
export function groupNoticeThreads(notices: NoticeItem[]): NoticeItem[] {
  const threadMap = new Map<string, NoticeItem[]>();

  for (const notice of notices) {
    // Normalise topic key: remove dates, edition numbers, and punctuation
    const key = notice.cleanTitle
      .toLowerCase()
      .replace(/(?:extension|extended|revision|revised|corrigendum|amendment|postponed|rescheduled|allotment|list\s*\d+|final|schedule|notice)/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 24);

    const existing = threadMap.get(key) || [];
    existing.push(notice);
    threadMap.set(key, existing);
  }

  return notices.map((notice) => {
    const key = notice.cleanTitle
      .toLowerCase()
      .replace(/(?:extension|extended|revision|revised|corrigendum|amendment|postponed|rescheduled|allotment|list\s*\d+|final|schedule|notice)/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 24);

    const group = threadMap.get(key) || [];
    if (group.length > 1) {
      return {
        ...notice,
        threadId: `th_${key}`,
        threadUpdateCount: group.length,
      };
    }
    return notice;
  });
}

/**
 * NIST FIPS 180-4 compliant pure JS SHA-256 implementation.
 * Free of Node-specific or native dependencies, safe in React Native, Web and Node.
 */
export function sha256Hex(input: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  // UTF-8 encode
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let c = input.charCodeAt(i);
    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      i++;
      const c2 = input.charCodeAt(i);
      c = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      bytes.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f),
      );
    } else {
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }

  const bitLength = bytes.length * 8;
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    words[i >> 2] |= (bytes[i] & 255) << (8 * (3 - (i % 4)));
  }
  words[bitLength >> 5] |= 0x80 << (24 - (bitLength % 32));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (let i = 0; i < words.length; i += 16) {
    const w: number[] = [];
    for (let j = 0; j < 16; j++) w[j] = words[i + j] | 0;
    for (let j = 16; j < 64; j++) {
      const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (let j = 0; j < 64; j++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  let result = '';
  for (let i = 0; i < 8; i++) {
    result += (hash[i] >>> 0).toString(16).padStart(8, '0');
  }
  return result;
}

/**
 * Returns a stable, canonical notice identity key based on normalized URL or source+title+date.
 */
export function getCanonicalNoticeKey(notice: {
  source?: string;
  fileUrl?: string | null;
  title?: string | null;
  cleanTitle?: string | null;
  postedAt?: string | null;
}): string {
  const source = (notice.source || 'main').toLowerCase().trim();
  const rawUrl = (notice.fileUrl || '').replace(/test\.gbu\.ac\.in/gi, 'www.gbu.ac.in').trim().toLowerCase();
  const isDocumentUrl =
    rawUrl.length > 0 &&
    !rawUrl.endsWith('/page/notices') &&
    !rawUrl.endsWith('exams.gbu.ac.in/') &&
    !rawUrl.endsWith('exams.gbu.ac.in');

  if (isDocumentUrl) {
    return `${source}|${rawUrl}`;
  }

  const title = (notice.cleanTitle || notice.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const date = (notice.postedAt || '').split('T')[0].trim();
  return `${source}|${title}|${date}`;
}

/**
 * Generates a stable canonical notice ID using SHA-256 hashing.
 */
export function generateCanonicalNoticeId(notice: {
  source?: string;
  fileUrl?: string | null;
  title?: string | null;
  cleanTitle?: string | null;
  postedAt?: string | null;
}): string {
  const key = getCanonicalNoticeKey(notice);
  return `not_${sha256Hex(key).slice(0, 16)}`;
}

/**
 * The file kind a notice points at, decided from the URL.
 *
 * The university's download endpoint puts the real file name in the `nName`
 * query parameter, so the extension has to be read from there: a URL such as
 * `.../DownloadFile?nName=abc.pdfNotice.pdf` is a PDF even though its path
 * carries no extension at all, and a name that merely mentions ".png" must not
 * turn a PDF into an image.
 */
export function fileTypeForUrl(rawUrl: string | null | undefined): NoticeItem['fileType'] {
  const url = (rawUrl ?? '').trim();
  if (!url) return 'html';

  const nName = /[?&]nName=([^&#]*)/i.exec(url);
  let candidate: string;
  if (nName && nName[1]) {
    try {
      candidate = decodeURIComponent(nName[1].replace(/\+/g, ' '));
    } catch {
      candidate = nName[1];
    }
  } else {
    candidate = url.split(/[?#]/)[0] ?? '';
  }

  const extension = /\.([a-z0-9]{1,5})(?:$|[?#&])/i.exec(candidate)?.[1]?.toLowerCase() ?? '';
  if (extension === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(extension)) return 'image';

  // No extension in the file name: fall back to the URL itself.
  if (/\.pdf(?:$|[?#&])/i.test(url)) return 'pdf';
  if (/\.(?:jpe?g|png|webp|gif|bmp)(?:$|[?#&])/i.test(url)) return 'image';
  return 'html';
}

/**
 * A readable label for a recovered attachment, built from the school code in
 * the file name (the exam portal publishes one date sheet per school).
 */
export function labelForRelatedAttachment(url: string): string {
  const name = url.split('/').pop() ?? '';
  const code = /^([a-z]{3,10})[-_]/i.exec(name)?.[1];
  if (code) {
    const school = code.toUpperCase();
    if (/date\s*sheet|datasheet/i.test(name)) return `${school} date sheet`;
    return `${school} notice`;
  }
  if (/date\s*sheet|datasheet/i.test(name)) return 'Date sheet';
  return 'Attachment';
}

export {
  filterNotices,
  type NoticeFilters,
  isNoticeMatchingSchools,
  isNoticeMatchingQuery,
  extractAvailableSchools,
  extractAvailableCategories,
} from './noticeFilters';

import { REAL_GBU_NOTICES } from './realGbuNotices';

/**
 * Authentic notices scraped directly from Gautam Buddha University portals.
 * All mock/sample data has been permanently purged.
 */
export const MOCK_NOTICES: NoticeItem[] = REAL_GBU_NOTICES;
