/**
 * Unit Tests for Admin Push History, Broadcast Revert, and PYQ Moderation Attribution.
 *
 * Verifies:
 * 1. Admin Broadcast History: fetchCloudNotices accurately loads both cloud and local notices.
 * 2. Broadcast Revert / Recall: revertNoticeBroadcast triggers cloud deletion, local tombstone sync,
 *    and realtime notice_deleted broadcast.
 * 3. PYQ Moderation Attribution: uploader profile metadata (name, student ID, avatar) propagates
 *    on uploadPendingPaper, is stored in row payload, and is accessible on PyqPaperRecord.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  revertNoticeBroadcast,
  fetchCloudNotices,
  setLocalAdminNotices,
  getLocalAdminNotices,
  getLocalDeletedNoticeIds,
  LOCAL_ADMIN_NOTICES_KEY,
  LOCAL_DELETED_NOTICES_KEY,
  NOTICES_REALTIME_CHANNEL,
  ADMIN_NOTICES_STORAGE_URL,
} from '../src/features/notices/adminNoticesService';
import {
  uploadPendingPaper,
  rowToPaper,
  type PyqPaperRecord,
  type UploaderProfile,
} from '../src/features/pyq/pyqRepository';
import {
  buildPaperRow,
  type PyqUploadMeta,
} from '../src/features/pyq/pyqStorage';
import { supabase } from '../src/lib/supabase';

// Mock Realtime Channel
const mockSend = jest.fn().mockResolvedValue({});
const mockSubscribe = jest.fn((callback: (status: string) => void) => {
  callback('SUBSCRIBED');
  return { unsubscribe: jest.fn() };
});
const mockChannel = {
  subscribe: mockSubscribe,
  send: mockSend,
};

// Mock Storage and Table
const mockStorageUpload = jest.fn().mockResolvedValue({ data: { path: 'test.pdf' }, error: null });
const mockStorageRemove = jest.fn().mockResolvedValue({ data: [], error: null });
let lastInsertedRow: Record<string, unknown> | null = null;
const mockInsert = jest.fn((row: Record<string, unknown>): Promise<{ data: any; error: any }> => {
  lastInsertedRow = row;
  return Promise.resolve({ data: row, error: null });
});
const mockFrom = jest.fn((_table?: string) => ({
  insert: mockInsert,
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      order: jest.fn(() => ({
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      })),
    })),
  })),
}));

jest.mock('../src/lib/supabase', () => {
  const actual = jest.requireActual('../src/lib/supabase');
  return {
    ...actual,
    isSupabaseConfigured: true,
    supabase: {
      ...actual.supabase,
      channel: jest.fn(() => mockChannel),
      removeChannel: jest.fn().mockResolvedValue(undefined),
      from: (table: string) => mockFrom(table),
      storage: {
        from: () => ({
          upload: mockStorageUpload,
          remove: mockStorageRemove,
        }),
      },
    },
  };
});

describe('Admin Broadcast History & Revert Service', () => {
  let fetchCalls: { url: string; init?: RequestInit }[] = [];

  beforeEach(async () => {
    await AsyncStorage.clear();
    fetchCalls = [];
    mockSend.mockClear();
    mockSubscribe.mockClear();

    (global as any).fetch = jest.fn((url: string, init?: RequestInit) => {
      fetchCalls.push({ url, init });

      if (url.includes('notices.json')) {
        if (!init?.method || init.method === 'GET') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                notices: [
                  {
                    id: 'cloud_broadcast_1',
                    source: 'admin',
                    sourceId: 'cloud_broadcast_1',
                    title: 'Urgent: Campus Convocation Guidelines Released',
                    cleanTitle: 'Campus Convocation Guidelines Released',
                    postedAt: '2026-11-05T08:00:00Z',
                    fileUrl: 'https://www.gbu.ac.in/convocation.pdf',
                    fileType: 'pdf',
                    category: 'event',
                    audience: { all: true },
                    importance: 5,
                  },
                ],
                deletedIds: [],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ok: true }),
        });
      }

      // Supabase Postgres REST fallback
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetchCloudNotices merges both cloud storage CDN and local offline notices', async () => {
    // Seed a locally published notice that has not yet synced to cloud CDN
    const localNotice = {
      id: 'local_broadcast_2',
      source: 'admin' as const,
      sourceId: 'local_broadcast_2',
      title: 'Mid Sem Exam Time Table Rescheduled',
      cleanTitle: 'Mid Sem Exam Time Table Rescheduled',
      postedAt: '2026-11-06T12:00:00Z',
      fileUrl: 'https://www.gbu.ac.in/rescheduled.pdf',
      fileType: 'pdf' as const,
      category: 'exam' as const,
      audience: { all: true },
      importance: 4,
      isSample: false,
    };
    await setLocalAdminNotices([localNotice]);

    const res = await fetchCloudNotices();

    // Verify both items are present and ordered by postedAt desc
    expect(res.notices).toHaveLength(2);
    expect(res.notices[0].id).toBe('local_broadcast_2'); // Newer
    expect(res.notices[1].id).toBe('cloud_broadcast_1'); // Older
  });

  it('revertNoticeBroadcast triggers cloud deletion, local tombstone, and realtime notice_deleted broadcast', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Recall cloud_broadcast_1
    const result = await revertNoticeBroadcast('cloud_broadcast_1');
    expect(result.ok).toBe(true);

    // 1. Verify tombstone recorded locally
    const tombstones = await getLocalDeletedNoticeIds();
    expect(tombstones).toContain('cloud_broadcast_1');

    // 2. Verify Cloud Storage CDN was updated via PUT with tombstone in deletedIds
    const storagePutCall = fetchCalls.find(
      (c) => c.url.includes('campus-events/notices.json') && c.init?.method === 'PUT',
    );
    expect(storagePutCall).toBeDefined();
    if (storagePutCall?.init?.body) {
      const payload = JSON.parse(String(storagePutCall.init.body));
      expect(payload.deletedIds).toContain('cloud_broadcast_1');
      expect(payload.notices.find((n: any) => n.id === 'cloud_broadcast_1')).toBeUndefined();
    }

    // 3. Verify Supabase Postgres REST DELETE calls were dispatched
    const pgDeleteCalls = fetchCalls.filter((c) => c.init?.method === 'DELETE');
    expect(pgDeleteCalls.length).toBeGreaterThanOrEqual(1);

    // 4. Verify Realtime notice_deleted broadcast was dispatched to connected students.
    //    The channel is private: only a signed-in moderator may join it and
    //    broadcast on it, so the client has to ask for it that way.
    expect(supabase.channel).toHaveBeenCalledWith(NOTICES_REALTIME_CHANNEL, {
      config: { private: true },
    });
    expect(mockSend).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'notice_deleted',
      payload: { id: 'cloud_broadcast_1' },
    });

    // 5. Verify subsequent fetch filters out recalled notice
    const refreshed = await fetchCloudNotices();
    expect(refreshed.notices.find((n) => n.id === 'cloud_broadcast_1')).toBeUndefined();
    expect(refreshed.deletedIds).toContain('cloud_broadcast_1');

    // 6. Verify recall event was logged
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Recalling broadcast notice: cloud_broadcast_1'),
    );
    consoleLogSpy.mockRestore();
  });

  it('fetchCloudNotices loads Postgres notices with custom portal sources pushed by admin', async () => {
    (global as any).fetch = jest.fn((url: string, init?: RequestInit) => {
      if (url.includes('notices.json')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ notices: [], deletedIds: [] }),
        });
      }
      if (url.includes('rest/v1/notices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve([
              {
                id: 'admin_notice_exam_101',
                source: 'exams',
                source_id: 'admin_notice_exam_101',
                title: 'Official End Semester Datesheet Revised',
                clean_title: 'End Semester Datesheet Revised',
                posted_at: '2026-11-07T09:00:00Z',
                file_url: 'https://www.gbu.ac.in/revised.pdf',
                category: 'datesheet',
                importance: 5,
              },
            ]),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    });

    const res = await fetchCloudNotices();
    expect(res.notices).toHaveLength(1);
    expect(res.notices[0].id).toBe('admin_notice_exam_101');
    expect(res.notices[0].source).toBe('exams');
    expect(res.notices[0].importance).toBe(5);
  });
});

describe('PYQ Moderation Queue Student Attribution', () => {
  const SAMPLE_META: PyqUploadMeta = {
    school: 'SOICT',
    programmeCode: 'BCS',
    semester: 'III',
    subjectCode: 'CSE201',
    subjectName: 'Object Oriented Programming with Java',
    year: 2026,
    examType: 'Mid Sem',
  };

  const SAMPLE_FILE = {
    uri: 'file:///path/to/java_exam_2026.pdf',
    name: 'java_exam_2026.pdf',
    mimeType: 'application/pdf',
    size: 2048,
  };

  beforeEach(() => {
    lastInsertedRow = null;
    mockInsert.mockClear();
    mockStorageUpload.mockClear();
  });

  it('buildPaperRow attaches uploader profile metadata when provided', () => {
    const profile: UploaderProfile = {
      name: 'Ashish Khola',
      uniqueStudentId: 'GBU-2026-CS88',
      avatarId: 'avatar_student_3',
    };

    const row = buildPaperRow(SAMPLE_META, 'paper_uuid_101', 'pyq-pending/sample.pdf', 'user_id_auth', profile);

    expect(row.uploader_name).toBe('Ashish Khola');
    // `uploader_id` is a real foreign key to auth.users(id): a device id
    // (or any string that is not a uuid) must never be written into it.
    expect(row.uploader_id).toBeNull();
    // The device identity has its own column.
    expect(row.uploader_student_id).toBe('GBU-2026-CS88');
    expect(row.uploader_avatar).toBe('avatar_student_3');
    expect(row.subject_code).toBe('CSE201');
    expect(row.status).toBe('pending');
  });

  it('uploadPendingPaper propagates uploader profile into supabase insertion payload', async () => {
    const profile: UploaderProfile = {
      name: 'Aarav Sharma',
      uniqueStudentId: 'GBU-SOICT-9921',
      avatarId: 'avatar_cat_5',
    };

    const res = await uploadPendingPaper(
      SAMPLE_FILE,
      SAMPLE_META,
      'auth_user_aarav',
      profile,
    );

    expect(res.ok).toBe(true);
    expect(mockStorageUpload).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();

    // Verify row passed to Postgres includes student attribution metadata
    expect(lastInsertedRow).toBeDefined();
    expect(lastInsertedRow?.uploader_name).toBe('Aarav Sharma');
    expect(lastInsertedRow?.uploader_student_id).toBe('GBU-SOICT-9921');
    expect(lastInsertedRow?.uploader_avatar).toBe('avatar_cat_5');
    // The auth foreign key stays empty for an id that is not a uuid.
    expect(lastInsertedRow?.uploader_id).toBeNull();
  });

  it('uploadPendingPaper does not retry with a thinner row when the insert is refused', async () => {
    const profile: UploaderProfile = {
      name: 'Ananya Verma',
      uniqueStudentId: 'GBU-SOICT-7733',
      avatarId: 'avatar_student_2',
    };

    // The insert fails once. There is NO second, thinner insert any more:
    // the columns exist in the schema, and the old fallback wrote a row
    // without them, which turned every contributor into an anonymous
    // "GBU Contributor".
    let callCount = 0;
    mockInsert.mockImplementation((row: Record<string, unknown>) => {
      callCount += 1;
      lastInsertedRow = row;
      return Promise.resolve({ data: null, error: { message: 'column "uploader_name" does not exist' } });
    });

    const res = await uploadPendingPaper(
      SAMPLE_FILE,
      SAMPLE_META,
      'auth_user_ananya',
      profile,
    );

    expect(res.ok).toBe(false);
    expect(callCount).toBe(1);
    expect(lastInsertedRow).toBeDefined();
    // The attribution is still on the row that was attempted.
    expect(lastInsertedRow?.uploader_name).toBe('Ananya Verma');
    expect(lastInsertedRow?.uploader_student_id).toBe('GBU-SOICT-7733');

    // Put the default insert behaviour back for the tests that follow.
    mockInsert.mockImplementation((row: Record<string, unknown>) => {
      lastInsertedRow = row;
      return Promise.resolve({ data: row, error: null });
    });
  });

  it('uploadPendingPaper writes a guest upload without an auth owner', async () => {
    const res = await uploadPendingPaper(
      SAMPLE_FILE,
      SAMPLE_META,
      'auth_user_guest',
    );

    expect(res.ok).toBe(true);
    expect(lastInsertedRow).toBeDefined();
    // A guest has no auth user: the foreign key must be NULL.
    expect(lastInsertedRow?.uploader_id).toBeNull();
    expect(lastInsertedRow?.uploader_name).toBe('');
    expect(lastInsertedRow?.uploader_avatar).toBe('');
  });

  it('rowToPaper properly parses and maps student attribution fields from database rows', () => {
    const dbRow = {
      id: 'paper_row_123',
      school: 'SOICT',
      programme_code: 'BCS',
      semester: 'III',
      subject_code: 'CSE201',
      subject_name: 'Object Oriented Programming',
      year: 2026,
      exam_type: 'Mid Sem',
      downloads: 14,
      status: 'pending',
      file_path: 'pyq-pending/sample.pdf',
      uploader_id: 'GBU-2026-CS88',
      uploader_name: 'Ashish Khola',
      uploader_avatar: 'avatar_cat_5',
    };

    const paper = rowToPaper(dbRow, 'https://test.supabase.co');

    expect(paper.id).toBe('paper_row_123');
    expect(paper.uploader_name).toBe('Ashish Khola');
    expect(paper.uploader_id).toBe('GBU-2026-CS88');
    expect(paper.uploader_avatar).toBe('avatar_cat_5');

    // Also verify camelCase backward compatibility
    const camelRow = {
      id: 'paper_row_456',
      school: 'SOICT',
      programme_code: 'BCS',
      semester: 'III',
      subject_code: 'CSE205',
      subject_name: 'Data Structures',
      year: 2026,
      exam_type: 'End Sem',
      status: 'pending',
      file_path: 'pyq-pending/sample2.pdf',
      uploaderId: 'GBU-SOICT-4421',
      uploaderName: 'Priya Sharma',
      uploaderAvatar: 'avatar_student_1',
    };

    const camelPaper = rowToPaper(camelRow, 'https://test.supabase.co');
    expect(camelPaper.uploader_name).toBe('Priya Sharma');
    expect(camelPaper.uploader_id).toBe('GBU-SOICT-4421');
    expect(camelPaper.uploader_avatar).toBe('avatar_student_1');
  });

  it('PyqPaperRecord properly reflects uploader attribution fields and formatting', () => {
    const paper: PyqPaperRecord = {
      id: 'paper_999',
      school: 'SOICT',
      programmeCode: 'BCS',
      semester: 'III',
      subjectCode: 'CSE201',
      subjectName: 'Object Oriented Programming',
      year: 2026,
      examType: 'Mid Sem',
      downloads: 42,
      status: 'pending',
      fileUrl: 'pyq-pending/test.pdf',
      uploaderId: 'GBU-SOICT-9921',
      uploader_name: 'Aarav Sharma',
      uploader_id: 'GBU-SOICT-9921',
      uploader_avatar: 'avatar_cat_5',
    };

    expect(paper.uploader_name).toBe('Aarav Sharma');
    expect(paper.uploader_id).toBe('GBU-SOICT-9921');
    expect(paper.uploader_avatar).toBe('avatar_cat_5');

    // Test attribution format matching Admin UI Tab 3
    const attributionString = `Uploaded by: ${paper.uploader_name || 'Anonymous Student'} (${paper.uploader_id || 'GBU-STUDENT'})`;
    expect(attributionString).toBe('Uploaded by: Aarav Sharma (GBU-SOICT-9921)');

    // Test fallback attribution format when fields are empty
    const anonymousPaper: PyqPaperRecord = {
      ...paper,
      uploader_name: undefined,
      uploader_id: undefined,
    };
    const fallbackString = `Uploaded by: ${anonymousPaper.uploader_name || 'Anonymous Student'} (${anonymousPaper.uploader_id || 'GBU-STUDENT'})`;
    expect(fallbackString).toBe('Uploaded by: Anonymous Student (GBU-STUDENT)');
  });
});
