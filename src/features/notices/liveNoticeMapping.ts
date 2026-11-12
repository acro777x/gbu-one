/**
 * Maps a notice parsed from a live GBU page into the app's notice model.
 *
 * The live pages are the source of truth; the bundled archive is only a
 * fallback. Keeping the mapping here (and free of React) makes it testable.
 */
import {
  cleanNoticeTitle,
  detectNoticeAudience,
  extractNoticeDeadline,
  calculateNoticeImportance,
  fileTypeForUrl,
  generateCanonicalNoticeId,
  labelForRelatedAttachment,
  type NoticeItem,
} from './noticeService';
import type { LiveNotice } from './liveNotices';

/** The file kind a notice points at, decided from the URL. */
export function fileTypeFor(live: LiveNotice): NoticeItem['fileType'] {
  return fileTypeForUrl(live.fileUrl);
}

/**
 * A live notice becomes an app notice. A notice whose file link is a
 * JavaScript-only modal (the date sheet announcement on the exam portal)
 * keeps the exam portal as its source, so the student can still reach the
 * document from the detail screen.
 */
export function toNoticeItem(live: LiveNotice): NoticeItem {
  const title = live.title ?? '';
  const fileUrl =
    live.fileUrl ??
    (live.attachmentKind === 'modal' ? live.sourceUrl : '') ??
    '';

  const relatedUrls = live.relatedUrls ?? [];
  const relatedUrlsStr = relatedUrls.join(' ');
  // The audience and the deadline are read from the title (and from the
  // recovered attachments), so the school filter chips and the deadline badge
  // work for a live notice exactly as they do for a worker notice.
  const audience = detectNoticeAudience(title, relatedUrlsStr);
  const deadlineAt = extractNoticeDeadline(title);

  const calculatedImportance = calculateNoticeImportance({
    title,
    category: live.category,
    deadlineAt,
    audience,
    postedAt: live.postedAt ?? undefined,
  });
  const importance = Math.max(live.importance ?? 0, calculatedImportance);

  const canonicalId = generateCanonicalNoticeId({
    source: live.source,
    fileUrl,
    title,
    cleanTitle: cleanNoticeTitle(title),
    postedAt: live.postedAt,
  });

  // The school-wise date sheets the exam portal hides inside a modal are
  // documents the student can actually open, so they are carried over as
  // attachments instead of being thrown away with `relatedUrls`.
  const relatedAttachments =
    relatedUrls.length > 0
      ? relatedUrls.map((url) => ({ label: labelForRelatedAttachment(url), url }))
      : undefined;

  return {
    id: canonicalId,
    source: live.source,
    sourceId: canonicalId,
    title,
    cleanTitle: cleanNoticeTitle(title),
    postedAt: live.postedAt ?? new Date().toISOString(),
    fileUrl,
    fileType: fileTypeFor(live),
    category: live.category,
    audience,
    importance,
    deadlineAt,
    relatedUrls: relatedUrls.length > 0 ? relatedUrls : undefined,
    relatedAttachments,
    threadId: null,
    threadUpdateCount: undefined,
    isSample: false,
  };
}

/** Maps a whole batch, dropping anything without a usable title. */
export function toNoticeItems(live: LiveNotice[]): NoticeItem[] {
  return live
    .filter((notice) => !!notice.title)
    .map(toNoticeItem)
    .sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
}

/**
 * True when every notice in the list is flagged as sample data.
 *
 * The screen does not rely on this flag to decide what it shows: the honest
 * signal is the notices status store, which knows whether the list came from
 * the university, from the cache or from the bundled archive.
 */
export function allNoticesAreSample(notices: NoticeItem[]): boolean {
  return notices.length > 0 && notices.every((notice) => notice.isSample === true);
}
