/**
 * GBU One - class alarm preferences.
 *
 * The student chooses how long before a class the alarm rings, so every
 * option, label and wording rule lives here, free of React and native
 * modules, and can be unit tested in Node
 * (tests/notification_preferences.test.ts).
 */

/** AsyncStorage key holding the list of scheduled class alarms. */
export const CLASS_REMINDERS_STORAGE_KEY = '@gbu_one_class_reminders';

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

function isClassReminder(entry: unknown): entry is ClassReminder {
  if (!entry || typeof entry !== 'object') return false;
  const candidate = entry as Partial<ClassReminder>;
  return (
    typeof candidate.slotId === 'string' &&
    candidate.slotId.length > 0 &&
    typeof candidate.leadMinutes === 'number' &&
    Number.isFinite(candidate.leadMinutes)
  );
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
    reminders.push({
      leadMinutes: entry.leadMinutes,
      slotId: entry.slotId,
      subject: typeof entry.subject === 'string' ? entry.subject : '',
      start: typeof entry.start === 'string' ? entry.start : '',
      fireAt: typeof entry.fireAt === 'string' ? entry.fireAt : '',
      channelId: typeof entry.channelId === 'string' ? entry.channelId : '',
    });
  }
  return reminders;
}
