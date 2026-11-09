import {
  publishNoticeToCampus,
  updateNoticeOnCampus,
  deleteNoticeFromCampus,
  fetchCloudNotices,
  getLocalDeletedNoticeIds,
  setLocalDeletedNoticeIds,
  LOCAL_ADMIN_NOTICES_KEY,
  LOCAL_DELETED_NOTICES_KEY,
} from '../src/features/notices/adminNoticesService';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Admin Notices Service & Cloud Sync Pipeline', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = jest.fn((url: string, init?: RequestInit) => {
      if (url.includes('notices.json')) {
        if (!init?.method || init.method === 'GET') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                notices: [
                  {
                    id: 'seed_notice_1',
                    source: 'admin',
                    sourceId: 'seed_notice_1',
                    title: 'Important Mid Sem Exam Schedule Released',
                    cleanTitle: 'Mid Sem Exam Schedule Released',
                    postedAt: '2026-11-01T10:00:00Z',
                    fileUrl: 'https://www.gbu.ac.in/notice.pdf',
                    fileType: 'pdf',
                    category: 'exam',
                    audience: { all: true },
                    importance: 4,
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

  it('fetches cloud notices and includes published admin notices', async () => {
    const res = await fetchCloudNotices();
    expect(res.notices.length).toBeGreaterThan(0);
    expect(res.notices[0].source).toBe('admin');
    expect(res.notices[0].id).toBe('seed_notice_1');
  });

  it('publishes a new notice to campus and saves to local storage', async () => {
    const res = await publishNoticeToCampus({
      title: 'Diwali Campus Holiday Notification 2026',
      category: 'other',
      importance: 5,
      fileUrl: 'https://www.gbu.ac.in/diwali.pdf',
    });

    expect(res.ok).toBe(true);
    expect(res.notice).toBeDefined();
    expect(res.notice?.title).toBe('Diwali Campus Holiday Notification 2026');
    expect(res.notice?.fileType).toBe('pdf');
    expect(res.notice?.source).toBe('admin');

    const storedRaw = await AsyncStorage.getItem(LOCAL_ADMIN_NOTICES_KEY);
    expect(storedRaw).toBeTruthy();
    const stored = JSON.parse(storedRaw!);
    expect(stored.some((n: any) => n.title.includes('Diwali'))).toBe(true);
  });

  it('permanently deletes a notice and filters it via tombstones', async () => {
    // Delete seed_notice_1
    const delRes = await deleteNoticeFromCampus('seed_notice_1');
    expect(delRes.ok).toBe(true);

    const deletedIds = await getLocalDeletedNoticeIds();
    expect(deletedIds).toContain('seed_notice_1');

    // Next fetch should exclude it
    const cloudRes = await fetchCloudNotices();
    expect(cloudRes.notices.find((n) => n.id === 'seed_notice_1')).toBeUndefined();
  });

  it('updates an existing notice and persists changes', async () => {
    const updateRes = await updateNoticeOnCampus('seed_notice_1', {
      title: 'Revised Mid Sem Schedule Released',
      importance: 5,
    });

    expect(updateRes.ok).toBe(true);
    expect(updateRes.notice?.title).toBe('Revised Mid Sem Schedule Released');
    expect(updateRes.notice?.importance).toBe(5);
  });
});
