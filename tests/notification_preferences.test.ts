/**
 * Unit tests for the class alarm preferences (lead times, firing moment,
 * scheduling rules and notification wording).
 */
import {
  CLASS_REMINDERS_STORAGE_KEY,
  canScheduleReminder,
  fireAtFor,
  formatLeadTime,
  formatLeadTimeVerbose,
  leadTimeOptions,
  parseStoredReminders,
  reminderBody,
  reminderTitle,
} from '../src/features/notifications/notificationPreferences';

describe('lead time options', () => {
  it('offers the lead times the student can pick, shortest first', () => {
    expect(leadTimeOptions().map((option) => option.minutes)).toEqual([
      0, 10, 15, 30, 45, 60, 120,
    ]);
  });

  it('labels every option in a readable way', () => {
    expect(leadTimeOptions().map((option) => option.label)).toEqual([
      'At start',
      '10 min before',
      '15 min before',
      '30 min before',
      '45 min before',
      '1 hour before',
      '2 hours before',
    ]);
  });

  it('returns a fresh list so callers cannot mutate the options', () => {
    const first = leadTimeOptions();
    first[0].label = 'changed';
    expect(leadTimeOptions()[0].label).toBe('At start');
  });
});

describe('formatLeadTime', () => {
  it('returns the chip label for a known option', () => {
    expect(formatLeadTime(0)).toBe('At start');
    expect(formatLeadTime(15)).toBe('15 min before');
    expect(formatLeadTime(30)).toBe('30 min before');
    expect(formatLeadTime(45)).toBe('45 min before');
  });

  it('writes hours instead of minutes for the long leads', () => {
    expect(formatLeadTime(60)).toBe('1 hour before');
    expect(formatLeadTime(120)).toBe('2 hours before');
  });

  it('falls back to a readable label for a lead that is not an option', () => {
    expect(formatLeadTime(5)).toBe('5 min before');
    expect(formatLeadTime(90)).toBe('1 hour 30 min before');
    expect(formatLeadTime(180)).toBe('3 hours before');
  });

  it('spells the lead out in full where the short label reads badly', () => {
    expect(formatLeadTimeVerbose(30)).toBe('30 minutes');
    expect(formatLeadTimeVerbose(60)).toBe('1 hour');
    expect(formatLeadTimeVerbose(120)).toBe('2 hours');
    expect(formatLeadTimeVerbose(1)).toBe('1 minute');
  });
});

describe('fireAtFor', () => {
  const classStart = new Date('2026-10-21T08:30:00.000Z');

  it('fires at the class start when the lead is zero', () => {
    expect(fireAtFor(classStart, 0).getTime()).toBe(classStart.getTime());
  });

  it('fires thirty minutes before the class', () => {
    expect(fireAtFor(classStart, 30).getTime()).toBe(
      new Date('2026-10-21T08:00:00.000Z').getTime(),
    );
  });

  it('fires an hour before the class', () => {
    expect(fireAtFor(classStart, 60).getTime()).toBe(
      new Date('2026-10-21T07:30:00.000Z').getTime(),
    );
  });

  it('does not change the class start it was given', () => {
    fireAtFor(classStart, 30);
    expect(classStart.toISOString()).toBe('2026-10-21T08:30:00.000Z');
  });
});

describe('canScheduleReminder', () => {
  const classStart = new Date('2026-10-21T08:30:00.000Z');

  it('refuses a class that has already started', () => {
    const now = new Date('2026-10-21T08:31:00.000Z');
    const result = canScheduleReminder(classStart, fireAtFor(classStart, 30), now);
    expect(result).toEqual({ ok: false, reason: 'already-started' });
  });

  it('refuses a lead time that has already passed', () => {
    const now = new Date('2026-10-21T08:00:00.000Z');
    const result = canScheduleReminder(classStart, fireAtFor(classStart, 60), now);
    expect(result).toEqual({ ok: false, reason: 'in-the-past' });
  });

  it('allows a reminder that can still fire', () => {
    const now = new Date('2026-10-21T07:00:00.000Z');
    const result = canScheduleReminder(classStart, fireAtFor(classStart, 60), now);
    expect(result).toEqual({ ok: true });
  });

  it('refuses a reminder whose firing moment has just passed', () => {
    const now = new Date('2026-10-21T08:30:00.000Z');
    const result = canScheduleReminder(
      new Date('2026-10-21T09:00:00.000Z'),
      now,
      now,
    );
    expect(result).toEqual({ ok: false, reason: 'in-the-past' });
  });
});

describe('reminder wording', () => {
  it('says the class starts now when the lead is zero', () => {
    expect(reminderTitle('Data Structures', 0)).toBe('Data Structures starts now');
    expect(reminderBody('08:30', 'Room 204', 0)).toBe(
      'The class starts now - 08:30 - Room 204',
    );
  });

  it('says the class starts in 30 minutes for a thirty minute lead', () => {
    expect(reminderTitle('Data Structures', 30)).toBe(
      'Data Structures starts in 30 minutes',
    );
    expect(reminderBody('08:30', 'Room 204', 30)).toBe(
      'The class starts in 30 minutes - 08:30 - Room 204',
    );
  });

  it('says the class starts in 1 hour, not in 60 minutes, for an hour lead', () => {
    expect(reminderTitle('Data Structures', 60)).toBe(
      'Data Structures starts in 1 hour',
    );
    expect(reminderBody('08:30', 'Room 204', 60)).toBe(
      'The class starts in 1 hour - 08:30 - Room 204',
    );
    expect(reminderBody('08:30', 'Room 204', 60)).not.toContain('60 minutes');
  });

  it('keeps the singular and the plural right', () => {
    expect(reminderTitle('Data Structures', 120)).toBe(
      'Data Structures starts in 2 hours',
    );
    expect(reminderTitle('Data Structures', 1)).toBe(
      'Data Structures starts in 1 minute',
    );
  });

  it('drops the room when the class has none', () => {
    expect(reminderBody('08:30', undefined, 30)).toBe(
      'The class starts in 30 minutes - 08:30',
    );
  });
});

describe('stored alarms', () => {
  it('uses one storage key for the whole list', () => {
    expect(CLASS_REMINDERS_STORAGE_KEY).toBe('@gbu_one_class_reminders');
  });

  it('reads back the alarms that were stored', () => {
    const stored = JSON.stringify([
      {
        leadMinutes: 30,
        slotId: 'mock-BCS-II B-1-1',
        subject: 'Data Structures',
        start: '08:30',
        fireAt: '2026-10-21T08:00:00.000Z',
        channelId: 'timetable_changes',
      },
    ]);
    expect(parseStoredReminders(stored)).toEqual([
      {
        leadMinutes: 30,
        slotId: 'mock-BCS-II B-1-1',
        subject: 'Data Structures',
        start: '08:30',
        fireAt: '2026-10-21T08:00:00.000Z',
        channelId: 'timetable_changes',
      },
    ]);
  });

  it('survives a broken or missing stored list', () => {
    expect(parseStoredReminders(null)).toEqual([]);
    expect(parseStoredReminders('not json')).toEqual([]);
    expect(parseStoredReminders('{"leadMinutes":30}')).toEqual([]);
  });

  it('drops entries that are not usable alarms', () => {
    const stored = JSON.stringify([{ leadMinutes: 'soon' }, { slotId: 'x' }, null]);
    expect(parseStoredReminders(stored)).toEqual([]);
  });
});
