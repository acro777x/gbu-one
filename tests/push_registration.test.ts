/**
 * Unit tests for the app-side push registration policy and the worker's
 * class-targeted timetable push targeting.
 * Per docs/NOTIFICATIONS.md
 */
import {
  TIMETABLE_CHANNEL_ID,
  TIMETABLE_PUSH_PREF_KEY,
  buildDeviceTokenRow,
  canAttemptRegistration,
  isValidSupabaseUserId,
  resolveClassKeyForRow,
  resolveEasProjectId,
} from '../src/lib/pushPolicy';
import { isValidClassKey, normaliseClassKey } from '../src/lib/classKey';
import {
  TIMETABLE_CHANNEL_ID as WORKER_CHANNEL_ID,
  buildTimetablePushMessage,
  selectTokensForClass,
} from '../worker/pushSender';
import type { TimetableChangeRecord } from '../worker/timetableJob';

describe('class key normalisation', () => {
  it('trims and upper-cases section codes', () => {
    expect(normaliseClassKey('  bcs-ii b ')).toBe('BCS-II B');
    expect(normaliseClassKey('BCS-II B')).toBe('BCS-II B');
  });

  it('treats empty values as invalid', () => {
    expect(normaliseClassKey(undefined)).toBe('');
    expect(normaliseClassKey(null)).toBe('');
    expect(normaliseClassKey('   ')).toBe('');
    expect(isValidClassKey('  ')).toBe(false);
    expect(isValidClassKey('BCS-II B')).toBe(true);
  });

  it('normalises the same way on the app and worker side', () => {
    expect(normaliseClassKey('bcs-ii b')).toBe(normaliseClassKey('BCS-II B'));
  });
});

describe('EAS project id resolution', () => {
  it('prefers the app config extra value', () => {
    expect(
      resolveEasProjectId({ extraProjectId: 'extra-id', easConfigProjectId: 'eas-id' }),
    ).toBe('extra-id');
  });

  it('falls back to the build-time eas config', () => {
    expect(resolveEasProjectId({ easConfigProjectId: 'eas-id' })).toBe('eas-id');
  });

  it('returns null when nothing is configured', () => {
    expect(resolveEasProjectId({})).toBeNull();
    expect(resolveEasProjectId({ extraProjectId: '   ' })).toBeNull();
  });
});

describe('push registration preconditions', () => {
  it('refuses to run without Supabase configured', () => {
    const result = canAttemptRegistration({
      supabaseConfigured: false,
      platform: 'android',
      isDevice: true,
    });
    expect(result).toEqual({ ok: false, reason: 'supabase-not-configured' });
  });

  it('refuses to run on web', () => {
    const result = canAttemptRegistration({
      supabaseConfigured: true,
      platform: 'web',
      isDevice: true,
    });
    expect(result).toEqual({ ok: false, reason: 'web-not-supported' });
  });

  it('refuses to run on an emulator or simulator', () => {
    expect(
      canAttemptRegistration({
        supabaseConfigured: true,
        platform: 'android',
        isDevice: false,
      }),
    ).toEqual({ ok: false, reason: 'not-a-physical-device' });
    expect(
      canAttemptRegistration({
        supabaseConfigured: true,
        platform: 'ios',
        isDevice: false,
      }),
    ).toEqual({ ok: false, reason: 'not-a-physical-device' });
  });

  it('proceeds on a physical device', () => {
    expect(
      canAttemptRegistration({
        supabaseConfigured: true,
        platform: 'android',
        isDevice: true,
      }),
    ).toEqual({ ok: true });
  });
});

describe('device token rows', () => {
  it('stores a normalised class key', () => {
    const row = buildDeviceTokenRow({
      token: 'ExponentPushToken[abc]',
      platform: 'android',
      classKey: '  bcs-ii b ',
      userId: null,
    });
    expect(row.token).toBe('ExponentPushToken[abc]');
    expect(row.platform).toBe('android');
    expect(row.class_key).toBe('BCS-II B');
    expect(row.user_id).toBeNull();
  });

  it('stores a null class key when no section is chosen', () => {
    const row = buildDeviceTokenRow({
      token: 'ExponentPushToken[abc]',
      platform: 'android',
      classKey: '',
      userId: null,
    });
    expect(row.class_key).toBeNull();
  });

  it('only links a real Supabase user id', () => {
    expect(isValidSupabaseUserId('usr_1700000000000')).toBe(false);
    expect(isValidSupabaseUserId(null)).toBe(false);
    expect(isValidSupabaseUserId('3f1b6c2e-9a1d-4c2b-8f3d-1a2b3c4d5e6f')).toBe(true);

    const row = buildDeviceTokenRow({
      token: 'ExponentPushToken[abc]',
      platform: 'android',
      classKey: 'BCS-II B',
      userId: 'usr_1700000000000',
    });
    expect(row.user_id).toBeNull();
  });

  it('keeps a valid Supabase user id', () => {
    const row = buildDeviceTokenRow({
      token: 'ExponentPushToken[abc]',
      platform: 'android',
      classKey: 'BCS-II B',
      userId: '3f1b6c2e-9a1d-4c2b-8f3d-1a2b3c4d5e6f',
    });
    expect(row.user_id).toBe('3f1b6c2e-9a1d-4c2b-8f3d-1a2b3c4d5e6f');
  });
});

describe('class targeting follows the Profile toggle', () => {
  it('targets the class when timetable pushes are on', () => {
    expect(resolveClassKeyForRow('  bcs-ii b ', true)).toBe('BCS-II B');
  });

  it('drops the class when timetable pushes are off', () => {
    expect(resolveClassKeyForRow('BCS-II B', false)).toBeNull();
  });

  it('has no class to target without a section', () => {
    expect(resolveClassKeyForRow(null, true)).toBeNull();
    expect(resolveClassKeyForRow('   ', true)).toBeNull();
  });
});

describe('channel identifiers', () => {
  it('matches the channel the worker pushes to', () => {
    expect(TIMETABLE_CHANNEL_ID).toBe('timetable_changes');
    expect(WORKER_CHANNEL_ID).toBe(TIMETABLE_CHANNEL_ID);
  });

  it('uses the Profile preference key for timetable pushes', () => {
    expect(TIMETABLE_PUSH_PREF_KEY).toBe('@gbu_one_notify_timetable');
  });
});

describe('worker class-targeted token selection', () => {
  const rows = [
    { token: 'ExponentPushToken[one]', class_key: 'BCS-II B' },
    { token: 'ExponentPushToken[two]', class_key: 'bcs-ii b' },
    { token: 'ExponentPushToken[other]', class_key: 'BCS-III A' },
    { token: 'ExponentPushToken[noclass]', class_key: null },
    { token: 'not-an-expo-token', class_key: 'BCS-II B' },
  ];

  it('matches the class case-insensitively and ignores other classes', () => {
    const tokens = selectTokensForClass(rows, 'BCS-II B');
    expect(tokens).toEqual(['ExponentPushToken[one]', 'ExponentPushToken[two]']);
  });

  it('matches when the worker class key uses different casing', () => {
    expect(selectTokensForClass(rows, ' bcs-ii b ')).toHaveLength(2);
  });

  it('never targets a device without a class key', () => {
    expect(selectTokensForClass(rows, '')).toEqual([]);
    expect(selectTokensForClass([{ token: 'ExponentPushToken[noclass]', class_key: null }], 'BCS-II B')).toEqual([]);
  });

  it('ignores non-Expo tokens', () => {
    const tokens = selectTokensForClass([{ token: 'abc123', class_key: 'BCS-II B' }], 'BCS-II B');
    expect(tokens).toEqual([]);
  });
});

describe('timetable push payload', () => {
  const change: TimetableChangeRecord = {
    id: 'chg_1',
    changeKey: 'abcdef0123456789abcdef0123456789',
    classKey: 'BCS-II B',
    semesterSessionId: '39',
    diffCount: 2,
    diffs: [],
    notificationMessage: 'BCS-II B: 2 schedule updates on Monday',
    detectedAt: '2026-10-20T00:00:00.000Z',
  };

  it('carries the class key and change key so the app can deep-link', () => {
    const message = buildTimetablePushMessage(change);
    expect(message.title).toContain('Timetable changed');
    expect(message.body).toBe('BCS-II B: 2 schedule updates on Monday');
    expect(message.data.type).toBe('timetable_change');
    expect(message.data.classKey).toBe('BCS-II B');
    expect(message.data.semesterSessionId).toBe('39');
    expect(message.data.changeKey).toBe(change.changeKey);
    expect(message.data.diffCount).toBe(2);
  });

  it('truncates a long body to 140 characters', () => {
    const long = { ...change, notificationMessage: 'x'.repeat(400) };
    expect(buildTimetablePushMessage(long).body.length).toBe(140);
  });
});
