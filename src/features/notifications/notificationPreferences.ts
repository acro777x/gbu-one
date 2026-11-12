/**
 * GBU One - class alarm preferences.
 *
 * The student chooses how long before a class the alarm rings, so every
 * option, label and wording rule lives here, free of React and native
 * modules, and can be unit tested in Node
 * (tests/notification_preferences.test.ts).
 *
 * A class alarm is a *weekly* alarm: the same class meets every week, so a
 * reminder that rang once and then disappeared for the rest of the semester
 * was a bug. The record therefore carries the weekday and the wall-clock
 * time it rings at, so the next occurrence can always be worked out.
 */

/** AsyncStorage key holding the list of scheduled class alarms. */
export const CLASS_REMINDERS_STORAGE_KEY = '@gbu_one_class_reminders';

/**
 * Whether the app has ever asked the OS for the notification permission.
 *
 * The permission prompt is one-shot on iOS and effectively one-shot on
 * Android 13+, so the app has to remember that it asked: without this the
 * screen cannot tell "the student has not been asked yet" from "the student
 * said no", and it would offer an "Enable" button that can do nothing.
 */
export const NOTIFICATION_PERMISSION_ASKED_KEY = '@gbu_one_notifications_asked';

/**
 * What the app knows about the notification permission.
 *
 * - `unknown`  - the student has not been asked yet.
 * - `granted`  - notifications are on.
 * - `denied`   - the student said no, but the OS will ask again.
 * - `blocked`  - the OS will not ask again; only the settings can fix it.
 */
export type NotificationPermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';

/**
 * Works out the permission state from what the OS reported.
 *
 * `blocked` and `denied` are kept apart on purpose: a blocked permission
 * cannot be asked for again, so the only way forward is the system
 * settings, and offering "Try again" there would be a lie.
 */
export function resolvePermissionState(
  permissions: { granted: boolean; canAskAgain?: boolean; status?: string },
  askedBefore: boolean,
): NotificationPermissionState {
  if (permissions.granted) return 'granted';
  if (permissions.status === 'undetermined') return 'unknown';
  if (permissions.status === 'denied') {
    return permissions.canAskAgain === false ? 'blocked' : 'denied';
  }
  // Older Android builds report no status: the local ask flag is the only
  // evidence that the student was asked.
  if (askedBefore) {
    return permissions.canAskAgain === false ? 'blocked' : 'denied';
  }
  return permissions.canAskAgain === false ? 'blocked' : 'unknown';
}

/**
 * How long after the alarm fired the student is still offered the snooze.
 * Past this the alarm counts as missed rather than ringing.
 */
export const RINGED_WINDOW_MINUTES = 30;

/** One scheduled class alarm. */
export interface ClassReminder {
  leadMinutes: number;
  slotId: string;
  subject: string;
  start: string;
  fireAt: string;
  channelId: string;
  /** The notification's own title, so a snooze can rebuild it. */
  title?: string;
  /** The notification's own body, so a snooze can rebuild it. */
  body?: string;
  /** True when the alarm repeats every week for the whole semester. */
  repeatsWeekly?: boolean;
  /** The day the alarm rings on: 0 = Sunday ... 6 = Saturday. */
  weekday?: number;
  /** The wall-clock time the alarm rings at, as "HH:MM" in local time. */
  fireTime?: string;
  /** The OS notification id, so a snooze can replace the alarm it answers. */
  notificationId?: string;
  /** When the alarm was actually delivered to the device. */
  firedAt?: string;
  /** When the student answered the alarm (snoozed or dismissed it). */
  acknowledgedAt?: string;
}

/** One lead time the student can pick. */
export interface LeadTimeOption {
  minutes: number;
  label: string;
}

/** Why a reminder cannot be scheduled. */
export type ReminderRefusalReason = 'already-started' | 'in-the-past';

export type ReminderCheck =
  | { ok: true }
  | { ok: false; reason: ReminderRefusalReason };

/**
 * Where an alarm stands right now.
 *
 * - `armed`       - still waiting to ring.
 * - `ringing`     - its time came and the student has not answered yet.
 * - `missed`      - its time came, nothing was answered and the window
 *                   closed: the student is told, rather than left guessing.
 * - `acknowledged`- the student already snoozed or dismissed it.
 */
export type ReminderState = 'armed' | 'ringing' | 'missed' | 'acknowledged';

const MINUTE_MS = 60 * 1000;

const LEAD_TIME_OPTIONS: readonly LeadTimeOption[] = [
  { minutes: 0, label: 'At start' },
  { minutes: 10, label: '10 min before' },
  { minutes: 15, label: '15 min before' },
  { minutes: 30, label: '30 min before' },
  { minutes: 45, label: '45 min before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 120, label: '2 hours before' },
];

/** The lead times the student can pick, shortest first. */
export function leadTimeOptions(): LeadTimeOption[] {
  return LEAD_TIME_OPTIONS.map((option) => ({ ...option }));
}

/**
 * The chip label for one lead time, e.g. 30 -> "30 min before",
 * 60 -> "1 hour before", 120 -> "2 hours before".
 */
export function formatLeadTime(minutes: number): string {
  const known = LEAD_TIME_OPTIONS.find((option) => option.minutes === minutes);
  if (known) return known.label;

  const total = Math.max(0, Math.round(minutes));
  if (total === 0) return 'At start';

  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min before`;
  if (rest === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'} before`;
  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${rest} min before`;
}

/**
 * The lead time spelled out in full, e.g. 30 -> "30 minutes", 60 -> "1 hour".
 * Used where the short chip label would read badly, such as the toast.
 */
export function formatLeadTimeVerbose(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total === 0) return 'the class start';

  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} ${rest === 1 ? 'minute' : 'minutes'}`;
  if (rest === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${rest} ${rest === 1 ? 'minute' : 'minutes'}`;
}

/** "now", "in 30 minutes", "in 1 hour", "in 2 hours". */
function leadPhrase(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total === 0) return 'now';

  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `in ${rest} ${rest === 1 ? 'minute' : 'minutes'}`;
  if (rest === 0) return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `in ${hours} ${hours === 1 ? 'hour' : 'hours'} ${rest} ${rest === 1 ? 'minute' : 'minutes'}`;
}

/** The moment the alarm rings for a class that starts at classStart. */
export function fireAtFor(classStart: Date, leadMinutes: number): Date {
  const lead = Math.max(0, Math.round(leadMinutes));
  return new Date(classStart.getTime() - lead * MINUTE_MS);
}

/**
 * Whether a reminder may still be scheduled. A class that has already begun
 * cannot be reminded about, and a lead time that has already passed cannot
 * fire either.
 */
export function canScheduleReminder(
  classStart: Date,
  fireAt: Date,
  now: Date,
): ReminderCheck {
  if (classStart.getTime() <= now.getTime()) {
    return { ok: false, reason: 'already-started' };
  }
  if (fireAt.getTime() <= now.getTime()) {
    return { ok: false, reason: 'in-the-past' };
  }
  return { ok: true };
}

/** The notification title for a class alarm. */
export function reminderTitle(subject: string, leadMinutes: number): string {
  return `${subject} starts ${leadPhrase(leadMinutes)}`;
}

/** The notification body for a class alarm. */
export function reminderBody(
  start: string,
  room: string | undefined,
  leadMinutes: number,
): string {
  const where = room && room.trim().length > 0 ? ` - ${room}` : '';
  return `The class starts ${leadPhrase(leadMinutes)} - ${start}${where}`;
}

/** The wall-clock time of a moment, as "HH:MM" in local time. */
export function clockTimeFor(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** The time of day of a moment, split into hours and minutes. */
export function parseClockTime(value: string | undefined | null): {
  hours: number;
  minutes: number;
} | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/**
 * The next time a weekly alarm rings after `from`.
 *
 * The weekday and the wall-clock time are kept separately from `fireAt`, so
 * the next occurrence survives a snooze, a week passing, or the phone being
 * off for a fortnight.
 */
export function nextWeeklyFireAt(
  reminder: ClassReminder,
  from: Date,
): Date | null {
  if (!reminder.repeatsWeekly) return null;
  const weekday = reminder.weekday;
  if (typeof weekday !== 'number' || !Number.isInteger(weekday)) return null;
  if (weekday < 0 || weekday > 6) return null;
  const time = parseClockTime(reminder.fireTime);
  if (!time) return null;

  const candidate = new Date(from.getTime());
  candidate.setHours(time.hours, time.minutes, 0, 0);
  const dayDelta = (weekday - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + dayDelta);
  if (candidate.getTime() <= from.getTime()) {
    candidate.setDate(candidate.getDate() + 7);
  }
  return candidate;
}

/**
 * Moves every weekly alarm whose time has come on to its next occurrence.
 *
 * The OS alarm itself repeats on its own, so this only keeps the stored
 * record honest: the app shows the right fire time and knows which
 * occurrence is still outstanding.
 */
export function advanceRepeatingReminders(
  reminders: ClassReminder[],
  now: Date,
): ClassReminder[] {
  let changed = false;
  const next = reminders.map((reminder) => {
    if (!reminder.repeatsWeekly) return reminder;
    const fireAt = new Date(reminder.fireAt).getTime();
    if (!Number.isFinite(fireAt) || fireAt > now.getTime()) return reminder;
    const following = nextWeeklyFireAt(reminder, now);
    if (!following) return reminder;
    changed = true;
    return {
      ...reminder,
      fireAt: following.toISOString(),
      firedAt: undefined,
      acknowledgedAt: undefined,
    };
  });
  return changed ? next : reminders;
}

/**
 * Fills in the fields a stored alarm needs to repeat and to be rebuilt.
 *
 * `title` and `body` are derived when the caller did not supply them, so a
 * snoozed alarm is never rebuilt as the generic "Class reminder".
 */
export function withRepeatMetadata(reminder: ClassReminder): ClassReminder {
  const fireAt = new Date(reminder.fireAt);
  const valid = Number.isFinite(fireAt.getTime());
  const weekday =
    typeof reminder.weekday === 'number' && Number.isInteger(reminder.weekday)
      ? reminder.weekday
      : valid
        ? fireAt.getDay()
        : undefined;
  const fireTime = reminder.fireTime ?? (valid ? clockTimeFor(fireAt) : undefined);

  const enriched: ClassReminder = {
    ...reminder,
    repeatsWeekly: reminder.repeatsWeekly ?? true,
  };
  if (weekday !== undefined) enriched.weekday = weekday;
  if (fireTime !== undefined) enriched.fireTime = fireTime;
  if (!enriched.title) {
    enriched.title = reminderTitle(reminder.subject, reminder.leadMinutes);
  }
  if (!enriched.body) {
    enriched.body = reminderBody(reminder.start, undefined, reminder.leadMinutes);
  }
  return enriched;
}

/** Where an alarm stands at `now`. */
export function reminderState(reminder: ClassReminder, now: Date): ReminderState {
  if (reminder.acknowledgedAt) return 'acknowledged';
  const fireAt = new Date(reminder.fireAt).getTime();
  if (!Number.isFinite(fireAt)) return 'missed';
  if (fireAt > now.getTime()) return 'armed';
  if (now.getTime() - fireAt <= RINGED_WINDOW_MINUTES * MINUTE_MS) return 'ringing';
  return 'missed';
}

function isClassReminder(entry: unknown): entry is ClassReminder {
  if (!entry || typeof entry !== 'object') return false;
  const candidate = entry as Partial<ClassReminder>;
  if (typeof candidate.slotId !== 'string' || candidate.slotId.length === 0) {
    return false;
  }
  if (
    typeof candidate.leadMinutes !== 'number' ||
    !Number.isFinite(candidate.leadMinutes)
  ) {
    return false;
  }
  // A record whose fire time cannot be read is a broken record: it can never
  // be cancelled and it would show up in the UI as a phantom alarm.
  if (typeof candidate.fireAt !== 'string') return false;
  return Number.isFinite(new Date(candidate.fireAt).getTime());
}

function optionalString(
  value: unknown,
): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Reads the stored alarms, ignoring anything that is not a usable alarm. */
export function parseStoredReminders(raw: string | null): ClassReminder[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];
  const entries = parsed as unknown[];
  const reminders: ClassReminder[] = [];
  for (const entry of entries) {
    if (!isClassReminder(entry)) continue;

    const reminder: ClassReminder = {
      leadMinutes: entry.leadMinutes,
      slotId: entry.slotId,
      subject: typeof entry.subject === 'string' ? entry.subject : '',
      start: typeof entry.start === 'string' ? entry.start : '',
      fireAt: entry.fireAt,
      channelId: typeof entry.channelId === 'string' ? entry.channelId : '',
    };

    // The title and body must survive the round trip: a snooze rebuilds the
    // notification from them, and losing them turns a specific alarm into
    // the generic "Class reminder".
    const title = optionalString(entry.title);
    if (title !== undefined) reminder.title = title;
    const body = optionalString(entry.body);
    if (body !== undefined) reminder.body = body;

    if (typeof entry.repeatsWeekly === 'boolean') {
      reminder.repeatsWeekly = entry.repeatsWeekly;
    }
    if (
      typeof entry.weekday === 'number' &&
      Number.isInteger(entry.weekday) &&
      entry.weekday >= 0 &&
      entry.weekday <= 6
    ) {
      reminder.weekday = entry.weekday;
    }
    const fireTime = optionalString(entry.fireTime);
    if (fireTime !== undefined) reminder.fireTime = fireTime;

    const notificationId = optionalString(entry.notificationId);
    if (notificationId !== undefined) reminder.notificationId = notificationId;
    const firedAt = optionalString(entry.firedAt);
    if (firedAt !== undefined) reminder.firedAt = firedAt;
    const acknowledgedAt = optionalString(entry.acknowledgedAt);
    if (acknowledgedAt !== undefined) reminder.acknowledgedAt = acknowledgedAt;

    reminders.push(reminder);
  }
  return reminders;
}
