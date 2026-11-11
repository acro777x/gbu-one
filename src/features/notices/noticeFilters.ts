/**
 * GBU One — Notice Filtering Engine
 * Filters live and cached notices by school, keyword/search, category, and student audience.
 */
import type { NoticeItem } from './noticeService';

export interface NoticeFilters {
  /** Notice categories to keep, e.g. ['datesheet', 'fees']. Empty means all. */
  categories?: string[];
  /** Schools to keep, e.g. ['SOICT', 'SOM']. Empty means all. */
  schools?: string[];
  /** Semesters to keep, e.g. ['II', 'IV']. Empty means all. */
  semesters?: string[];
  /** Keep only the notices that target this student. */
  forMe?: boolean;
  /** Free-text search query across title, cleanTitle, and rawText (OCR text). */
  query?: string;
}

/**
 * Checks if a notice matches the given schools filter (case-insensitive).
 * Matches against audience.schools or directly mentions school in cleanTitle / title.
 */
export function isNoticeMatchingSchools(notice: NoticeItem, targetSchools: string[]): boolean {
  if (targetSchools.length === 0) return true;
  const upperTargets = targetSchools.map((s) => s.toUpperCase());

  // 1. Check structured audience schools
  const noticeSchools = (notice.audience?.schools ?? []).map((s) => s.toUpperCase());
  if (noticeSchools.some((s) => upperTargets.includes(s))) {
    return true;
  }

  // 2. Check title / cleanTitle for explicit school mentions (e.g. "SOICT Exam Datesheet")
  const titleUpper = `${notice.cleanTitle} ${notice.title}`.toUpperCase();
  if (upperTargets.some((s) => titleUpper.includes(s))) {
    return true;
  }

  return false;
}

/**
 * Checks if a notice matches the search query (case-insensitive).
 * Searches cleanTitle, title, rawText (extracted document OCR text), and category.
 */
export function isNoticeMatchingQuery(notice: NoticeItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const inTitle =
    notice.cleanTitle.toLowerCase().includes(q) || notice.title.toLowerCase().includes(q);
  if (inTitle) return true;

  const inText = (notice.rawText ?? '').toLowerCase().includes(q);
  if (inText) return true;

  const inCategory = (notice.category ?? '').toLowerCase().includes(q);
  if (inCategory) return true;

  return false;
}

/**
 * Extracts all unique available schools present in the notices list.
 */
export function extractAvailableSchools(notices: NoticeItem[]): string[] {
  const schools = new Set<string>();
  for (const n of notices) {
    for (const s of n.audience?.schools ?? []) {
      if (s) schools.add(s.toUpperCase());
    }
  }
  return Array.from(schools).sort();
}

/**
 * Extracts all unique categories present in the notices list.
 */
export function extractAvailableCategories(notices: NoticeItem[]): string[] {
  const categories = new Set<string>();
  for (const n of notices) {
    if (n.category) categories.add(n.category.toLowerCase());
  }
  return Array.from(categories).sort();
}

/**
 * Filters notices with the N99-style removable chips:
 * Several filters can be active at once, and a notice has to satisfy all active filter criteria.
 */
export function filterNotices(notices: NoticeItem[], filters: NoticeFilters = {}): NoticeItem[] {
  const categories = (filters.categories ?? []).map((c) => c.toLowerCase());
  const schools = (filters.schools ?? []).map((s) => s.toUpperCase());
  const semesters = (filters.semesters ?? []).map((s) => s.toUpperCase());
  const query = (filters.query ?? '').trim().toLowerCase();

  return notices.filter((n) => {
    // 1. Keyword search (title + extracted OCR rawText)
    if (query && !isNoticeMatchingQuery(n, query)) {
      return false;
    }

    // 2. Category filter
    if (categories.length > 0 && !categories.includes(n.category.toLowerCase())) {
      return false;
    }

    // 3. School filter
    if (schools.length > 0 && !isNoticeMatchingSchools(n, schools)) {
      return false;
    }

    // 4. Semester filter
    if (semesters.length > 0) {
      const noticeSemesters = (n.audience?.semesters ?? []).map((s) => s.toUpperCase());
      if (!noticeSemesters.some((s) => semesters.includes(s))) return false;
    }

    // 5. "For me" filter: high importance (>= 2) or universal notice (audience.all) or school-specific
    if (filters.forMe) {
      const isImportantOrUniversal = n.importance >= 2 || Boolean(n.audience?.all);
      if (!isImportantOrUniversal) {
        return false;
      }
    }

    return true;
  });
}
