/**
 * GBU One — Pure schedule helpers for the Home and Timetable screens.
 *
 * Everything here is free of React and native modules so it can be unit
 * tested in Node (tests/home_timetable_truth.test.ts).
 *
 * Clock convention
 * ----------------
 * GBU publishes period times on a 12-hour clock that starts at 08:30 and runs
 * until 20:30 ("08:30", "09:30", ... "12:30", "01:30" ... "07:30"), so
 * "01:30" is 13:30, not 01:30 in the morning. All slot times are therefore
 * projected onto a "school day" timeline whose origin is 08:30; a wall-clock
 * moment before 08:30 lands before the first period of the day.
 */
import type { NoticeItem } from '../notices/noticeService';
import type { Slot } from './timetableProvider';

export type DayIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SlotStatus = 'LIVE NOW' | 'UP NEXT' | 'SCHEDULED';

export const MS_PER_MINUTE = 60 * 1000;
export const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

/** First period of the GBU school day. */
export const SCHOOL_DAY_START_MINUTES = 8 * 60 + 30;

/** Length of the 12-hour clock the period times are published on. */
export const SCHOOL_CYCLE_MINUTES = 12 * 60;

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Maps a calendar date onto the timetable day index
 * (1 = Monday ... 7 = Sunday). JS getDay() returns 0 for Sunday.
 */
export function dayIndexForDate(date: Date): DayIndex {
  const jsDay = date.getDay();
  return (jsDay === 0 ? 7 : jsDay) as DayIndex;
}

/** Human label for a timetable day index. */
export function dayLabelForIndex(day: DayIndex): string {
  return DAY_LABELS[day - 1] ?? '';
}

/**
 * Parses a "HH:MM" (optionally "h:mm AM/PM") clock string into minutes
 * since midnight. Returns null when the string is not a valid time.
 */
export function clockMinutesOf(time: string): number | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*(am|pm)?\s*$/i.exec(time ?? '');
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) return null;
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  if (hours > 24) return null;
  return hours * 60 + minutes;
}

/**
 * Projects a published period time onto the school-day timeline
 * (08:30 = 0, 12:30 = 240, 01:30 = 300, 07:30 = 660).
 */
export function schoolMinutesOf(time: string): number | null {
  const clock = clockMinutesOf(time);
  if (clock === null) return null;
  const offset = (clock - SCHOOL_DAY_START_MINUTES) % SCHOOL_CYCLE_MINUTES;
  return (offset + SCHOOL_CYCLE_MINUTES) % SCHOOL_CYCLE_MINUTES;
}

/**
 * The current wall-clock moment on the school-day timeline. Values before
 * 08:30 are negative, i.e. before the first period of the day.
 */
export function schoolMinutesOfDate(date: Date): number {
  return (
    date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60 - SCHOOL_DAY_START_MINUTES
  );
}

/** The slot's start/end on the school-day timeline, or null when unparseable. */
export function slotWindow(slot: Slot): { start: number; end: number } | null {
  const start = schoolMinutesOf(slot.start);
  const endRaw = schoolMinutesOf(slot.end);
  if (start === null || endRaw === null) return null;
  const end = endRaw > start ? endRaw : endRaw + SCHOOL_CYCLE_MINUTES;
  return { start, end };
}

/** Length of a slot in minutes, or null when its times are unparseable. */
export function slotDurationMinutes(slot: Slot): number | null {
  const window = slotWindow(slot);
  if (!window) return null;
  return window.end - window.start;
}

/** True when the wall clock sits inside the slot's start/end window. */
export function isSlotLive(slot: Slot, now: Date): boolean {
  const window = slotWindow(slot);
  if (!window) return false;
  const current = schoolMinutesOfDate(now);
  return current >= window.start && current < window.end;
}

/**
 * The class the student should care about right now: the one that is running,
 * otherwise the soonest one that has not started yet. Only today's classes
 * are considered; null means the day is over.
 */
export function findNextSlot(slots: Slot[], now: Date): Slot | null {
  const today = dayIndexForDate(now);
  const current = schoolMinutesOfDate(now);

  const windows = slots
    .filter((slot) => slot.day === today)
    .map((slot) => ({ slot, window: slotWindow(slot) }))
    .filter(
      (entry): entry is { slot: Slot; window: { start: number; end: number } } =>
        entry.window !== null && entry.window.end > current,
    );
  if (windows.length === 0) return null;

  windows.sort((a, b) => {
    const aRunning = current >= a.window.start ? 0 : 1;
    const bRunning = current >= b.window.start ? 0 : 1;
    if (aRunning !== bRunning) return aRunning - bRunning;
    return a.window.start - b.window.start;
  });

  return windows[0].slot;
}

/**
 * Classifies every slot as LIVE NOW, UP NEXT or SCHEDULED using the clock.
 * Only today's slots can be live, and only one slot is UP NEXT.
 */
export function computeSlotStatuses(slots: Slot[], now: Date): Record<string, SlotStatus> {
  const today = dayIndexForDate(now);
  const current = schoolMinutesOfDate(now);

  let nextId: string | null = null;
  let nextStart = Number.POSITIVE_INFINITY;
  for (const slot of slots) {
    if (slot.day !== today) continue;
    const window = slotWindow(slot);
    if (!window) continue;
    if (window.start > current && window.start < nextStart) {
      nextStart = window.start;
      nextId = slot.id;
    }
  }

  const statuses: Record<string, SlotStatus> = {};
  for (const slot of slots) {
    const window = slotWindow(slot);
    if (window && slot.day === today && current >= window.start && current < window.end) {
      statuses[slot.id] = 'LIVE NOW';
    } else if (slot.id === nextId) {
      statuses[slot.id] = 'UP NEXT';
    } else {
      statuses[slot.id] = 'SCHEDULED';
    }
  }
  return statuses;
}

/** "1h 2m", "45m" or "2h". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

/** Badge text for the Home "Up Next" card, derived from the real slot times. */
export function nextSlotBadge(slot: Slot | null, now: Date): string {
  if (!slot) return 'No more classes today';
  const window = slotWindow(slot);
  if (!window) return 'No more classes today';
  const current = schoolMinutesOfDate(now);
  if (current < window.start) {
    const remaining = window.start - current;
    return remaining < 1 ? 'Starting now' : `${formatDuration(remaining)} left`;
  }
  if (current < window.end) {
    return `Live now • ${formatDuration(window.end - current)} left`;
  }
  return 'No more classes today';
}

/** Elapsed fraction of the class (0..100) for the progress bar. */
export function slotProgressPercent(slot: Slot | null, now: Date): number {
  if (!slot) return 0;
  const window = slotWindow(slot);
  if (!window) return 0;
  const current = schoolMinutesOfDate(now);
  if (current <= window.start) return 0;
  if (current >= window.end) return 100;
  const total = window.end - window.start;
  if (total <= 0) return 0;
  return Math.round(((current - window.start) / total) * 100);
}

/**
 * The moment the slot starts today, or null when the slot is not scheduled
 * today. The returned moment can already be in the past.
 */
export function slotStartToday(slot: Slot, now: Date): Date | null {
  const start = schoolMinutesOf(slot.start);
  if (start === null) return null;
  if (slot.day !== dayIndexForDate(now)) return null;

  const wallMinutes = SCHOOL_DAY_START_MINUTES + start;
  const candidate = new Date(now);
  candidate.setHours(Math.floor(wallMinutes / 60), wallMinutes % 60, 0, 0);
  return candidate;
}

/**
 * The next calendar moment at which the slot runs, used to schedule the
 * class reminder. Null when the slot has no usable start time.
 */
export function nextSlotDate(slot: Slot, now: Date): Date | null {
  const start = schoolMinutesOf(slot.start);
  if (start === null) return null;

  const wallMinutes = SCHOOL_DAY_START_MINUTES + start;
  const candidate = new Date(now);
  candidate.setHours(Math.floor(wallMinutes / 60), wallMinutes % 60, 0, 0);

  let delta = slot.day - dayIndexForDate(candidate);
  if (delta < 0) delta += 7;
  candidate.setDate(candidate.getDate() + delta);

  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 7);
  }
  return candidate;
}

/** Countdown chip text for a notice deadline, e.g. "2 days left" / "Overdue". */
export function deadlineCountdownText(deadlineAt: string, now: Date): string {
  const deadline = new Date(deadlineAt);
  if (Number.isNaN(deadline.getTime())) return 'No deadline';

  const startOfDay = (date: Date): number =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfDay(deadline) - startOfDay(now)) / MS_PER_DAY);

  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `${days} days left`;
}

/** The notices that carry a deadline, soonest first. */
export function selectDeadlineNotices(notices: NoticeItem[], limit = 3): NoticeItem[] {
  return notices
    .filter((notice) => {
      if (!notice.deadlineAt) return false;
      return !Number.isNaN(new Date(notice.deadlineAt).getTime());
    })
    .sort(
      (a, b) =>
        new Date(a.deadlineAt as string).getTime() - new Date(b.deadlineAt as string).getTime(),
    )
    .slice(0, Math.max(0, limit));
}

/**
 * Notices the student has not seen yet. Without a stored "last seen" stamp
 * every notice counts as unread, but an empty feed is never unread.
 */
export function countUnreadNotices(notices: NoticeItem[], lastSeenAt: string | null): number {
  if (notices.length === 0) return 0;
  if (!lastSeenAt) return notices.length;
  const seen = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(seen)) return notices.length;
  return notices.filter((notice) => {
    const posted = new Date(notice.postedAt).getTime();
    return Number.isFinite(posted) && posted > seen;
  }).length;
}

/** The soonest date from the list that has not passed yet. */
export function nearestFutureDate(dates: string[], now: Date): string | null {
  const current = now.getTime();
  let best: string | null = null;
  let bestTime = Number.POSITIVE_INFINITY;
  for (const date of dates) {
    const time = new Date(date).getTime();
    if (!Number.isFinite(time) || time < current) continue;
    if (time < bestTime) {
      bestTime = time;
      best = date;
    }
  }
  return best;
}
