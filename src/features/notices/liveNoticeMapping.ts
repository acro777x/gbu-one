/**
 * Maps a notice parsed from a live GBU page into the app's notice model.
 *
 * The live pages are the source of truth; the bundled sample is only a
 * fallback. Keeping the mapping here (and free of React) makes it testable.
 */
import { cleanNoticeTitle, type NoticeItem } from './noticeService';
import type { LiveNotice } from './liveNotices';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

/** The file kind a notice points at, decided from the URL. */
export function fileTypeFor(live: LiveNotice): NoticeItem['fileType'] {
  const url = (live.fileUrl ?? '').toLowerCase();
  if (!url) return 'html';
  if (IMAGE_EXTENSIONS.some((extension) => url.includes(extension))) return 'image';
  if (url.includes('.pdf')) return 'pdf';
  return 'html';
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

  return {
    id: live.id,
    source: live.source,
    sourceId: live.id,
    title,
    cleanTitle: cleanNoticeTitle(title),
    postedAt: live.postedAt ?? new Date().toISOString(),
    fileUrl,
    fileType: fileTypeFor(live),
    category: live.category,
    audience: { all: true },
    importance: live.importance,
    deadlineAt: null,
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

/** True when every notice in the list is the bundled sample. */
export function allNoticesAreSample(notices: NoticeItem[]): boolean {
  return notices.length > 0 && notices.every((notice) => notice.isSample === true);
}
