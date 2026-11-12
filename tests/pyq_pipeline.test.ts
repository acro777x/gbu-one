/**
 * GBU One — the PYQ upload / moderation pipeline.
 *
 * These tests pin the five things that used to be broken in a way the
 * student could not see:
 *
 *  1. approving a paper publishes the BYTES of the upload, not a
 *     re-encoded copy of them;
 *  2. a guest upload keeps its identity without breaking the foreign key;
 *  3. the offline queue actually drains;
 *  4. no client file carries a service-role key;
 *  5. the contributor points come from the server, not from the phone.
 */
import fs from 'fs';
import path from 'path';

type Row = Record<string, unknown>;

const state = {
  configured: true,
  session: {
    user: { id: '9f1b7c2e-4a55-4d61-9b0e-2c3d4e5f6a7b', email: 'Owner@GBU.ac.in' },
    access_token: 'session-token',
  } as unknown,
  papers: [] as Row[],
  inserted: [] as Row[],
  updates: [] as Array<{ table: string; patch: Row }>,
  logs: [] as Row[],
  points: [] as Row[],
  moderators: [] as Row[],
  failSubjectCode: null as string | null,
  copyError: null as { message: string } | null,
  copied: [] as Array<{ from: string; to: string; options: unknown }>,
  downloaded: [] as string[],
  removed: [] as string[],
  order: [] as string[],
  etag: 'md5-of-the-upload',
  destinationEtag: null as string | null,
  size: 4242,
};

function resetState() {
  state.configured = true;
  state.session = {
    user: { id: '9f1b7c2e-4a55-4d61-9b0e-2c3d4e5f6a7b', email: 'Owner@GBU.ac.in' },
    access_token: 'session-token',
  };
  state.papers = [];
  state.inserted = [];
  state.updates = [];
  state.logs = [];
  state.points = [];
  state.moderators = [];
  state.failSubjectCode = null;
  state.copyError = null;
  state.copied = [];
  state.downloaded = [];
  state.removed = [];
  state.order = [];
  state.etag = 'md5-of-the-upload';
  state.destinationEtag = null;
  state.size = 4242;
}

function resolveSelect(table: string, filters: Record<string, unknown>): { data: unknown; error: unknown } {
  if (table === 'pyq_contributor_points') {
    return { data: state.points, error: null };
  }
  if (table === 'moderators') {
    const wanted = String(filters.email ?? '').toLowerCase();
    const row = state.moderators.find(
      (item) => String(item.email ?? '').toLowerCase() === wanted,
    );
    return { data: row ?? null, error: null };
  }
  if (table === 'pyq_papers') {
    let rows = state.papers.filter((row) =>
      Object.entries(filters).every(([key, value]) => {
        if (key.startsWith('__')) return true;
        return row[key] === value;
      }),
    );
    const range = filters.__range as [number, number] | undefined;
    if (range) rows = rows.slice(range[0], range[1] + 1);
    const limit = filters.__limit as number | undefined;
    if (typeof limit === 'number') rows = rows.slice(0, limit);
    return { data: rows, error: null };
  }
  return { data: [], error: null };
}

function doInsert(table: string, row: Row): { data: unknown; error: unknown } {
  if (table === 'pyq_papers') {
    if (state.failSubjectCode && row.subject_code === state.failSubjectCode) {
      return { data: null, error: { message: 'row-level security violation' } };
    }
    state.inserted.push(row);
    state.papers.push(row);
    return { data: row, error: null };
  }
  if (table === 'pyq_moderation_log') {
    state.logs.push(row);
    return { data: row, error: null };
  }
  return { data: row, error: null };
}

function doUpdate(
  table: string,
  filters: Record<string, unknown>,
  patch: Row,
): { data: unknown; error: unknown } {
  state.updates.push({ table, patch });
  state.order.push('update');
  if (table === 'pyq_papers') {
    state.papers = state.papers.map((row) =>
      row.id === filters.id ? { ...row, ...patch } : row,
    );
  }
  return { data: null, error: null };
}

function createBuilder(table: string, mode: string, filters: Record<string, unknown>, payload?: Row) {
  const builder: Record<string, unknown> = {
    _table: table,
    _mode: mode,
    _filters: filters,
    _payload: payload,
    select: () => createBuilder(table, 'select', filters),
    eq: (column: string, value: unknown) =>
      createBuilder(table, mode, { ...filters, [column]: value }, payload),
    ilike: (column: string, value: unknown) =>
      createBuilder(table, mode, { ...filters, [column]: value }, payload),
    order: () => createBuilder(table, mode, filters, payload),
    range: (from: number, to: number) =>
      Promise.resolve(resolveSelect(table, { ...filters, __range: [from, to] })),
    limit: (count: number) =>
      Promise.resolve(resolveSelect(table, { ...filters, __limit: count })),
    maybeSingle: () => {
      const result = resolveSelect(table, filters);
      const first = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
      return Promise.resolve({ data: first, error: result.error });
    },
    insert: (row: Row) => Promise.resolve(doInsert(table, row)),
    update: (patch: Row) => createBuilder(table, 'update', filters, patch),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      if (mode === 'update') {
        return Promise.resolve(doUpdate(table, filters, payload ?? {})).then(resolve, reject);
      }
      return Promise.resolve(resolveSelect(table, filters)).then(resolve, reject);
    },
  };
  return builder;
}

jest.mock('../src/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return state.configured;
  },
  supabase: {
    auth: {
      getSession: jest.fn(() =>
        Promise.resolve({
          data: { session: state.session },
          error: null,
        }),
      ),
    },
    from: (table: string) => createBuilder(table, 'select', {}),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    storage: {
      from: (bucket: string) => ({
        upload: jest.fn(() => {
          state.order.push('upload');
          return Promise.resolve({ data: {}, error: null });
        }),
        // The server-side copy: the bytes never enter the app.
        copy: jest.fn((from: string, to: string, options: unknown) => {
          state.order.push('copy');
          state.copied.push({ from, to, options });
          if (state.copyError) {
            return Promise.resolve({ data: null, error: state.copyError });
          }
          return Promise.resolve({ data: { path: to }, error: null });
        }),
        list: jest.fn(() => {
          state.order.push('list');
          const etag =
            bucket === 'pyq' && state.destinationEtag ? state.destinationEtag : state.etag;
          return Promise.resolve({
            data: [
              {
                name: '2025-MID-SEM-abc.pdf',
                metadata: { eTag: etag, size: state.size },
              },
            ],
            error: null,
          });
        }),
        remove: jest.fn((paths: string[]) => {
          state.order.push('remove');
          state.removed.push(...paths);
          return Promise.resolve({ data: paths, error: null });
        }),
        createSignedUrl: jest.fn(() =>
          Promise.resolve({ data: { signedUrl: 'https://signed.example/paper' }, error: null }),
        ),
        // If the approve path ever calls this, the bytes go through a JS
        // string and come back corrupted.
        download: jest.fn((path: string) => {
          state.order.push('download');
          state.downloaded.push(path);
          return Promise.resolve({ data: new Blob(['corrupted']), error: null });
        }),
      }),
    },
  },
}));

import {
  applyModeration,
  uploadPendingPaper,
  type PyqPaperRecord,
} from '../src/features/pyq/pyqRepository';
import {
  buildQueuedUpload,
  enqueueUpload,
  flushUploadQueue,
  readUploadQueue,
} from '../src/features/pyq/localUploadQueue';
import { getLeaderboard } from '../src/features/pyq/pyqLeaderboard';
import type { PyqUploadMeta } from '../src/features/pyq/pyqStorage';

const META: PyqUploadMeta = {
  school: 'SOICT',
  programmeCode: 'BCS',
  semester: 'II',
  subjectCode: 'CSE205',
  subjectName: 'Data Structures & Algorithms',
  year: 2025,
  examType: 'Mid Sem',
};

const FILE = {
  uri: 'file:///cache/paper.pdf',
  name: 'paper.pdf',
  mimeType: 'application/pdf',
  size: 2048,
};

const PENDING_PATH = 'pyq-pending/SOICT/BCS/II/CSE205/2025-MID-SEM-abc.pdf';

const PENDING_PAPER: Row = {
  id: 'paper-1',
  school: 'SOICT',
  programme_code: 'BCS',
  semester: 'II',
  subject_code: 'CSE205',
  subject_name: 'Data Structures & Algorithms',
  year: 2025,
  exam_type: 'Mid Sem',
  downloads: 0,
  status: 'pending',
  file_path: PENDING_PATH,
  uploader_id: null,
  uploader_student_id: 'GBU-21ICS045',
  uploader_name: 'Aarav Sharma',
  uploader_avatar: 'tech-scholar',
  file_size_bytes: 2048,
};

describe('PYQ upload and moderation pipeline', () => {
  beforeEach(() => {
    resetState();
  });

  describe('1. The published object is byte-identical to the pending one', () => {
    it('copies the object inside storage and never round-trips the bytes', async () => {
      state.papers = [{ ...PENDING_PAPER }];

      const result = await applyModeration('paper-1', 'approve');

      expect(result.ok).toBe(true);

      // The copy is a SERVER side copy from the pending bucket into the
      // public one: the bytes never become a JS string.
      expect(state.copied).toHaveLength(1);
      expect(state.copied[0].from).toBe(PENDING_PATH);
      expect(state.copied[0].to).toBe('SOICT/BCS/II/CSE205/2025-MID-SEM-abc.pdf');
      expect(state.copied[0].options).toEqual({ destinationBucket: 'pyq' });

      // A download would re-encode the bytes (whatwg-fetch builds the body
      // from `xhr.responseText`), so it must never be used to publish.
      expect(state.downloaded).toHaveLength(0);

      // The status is written BEFORE the file is moved, so a failed move
      // can be rolled back.
      expect(state.order.indexOf('update')).toBeLessThan(state.order.indexOf('copy'));
    });

    it('refuses to publish a copy whose fingerprint does not match', async () => {
      state.papers = [{ ...PENDING_PAPER }];
      // The published object has a different etag: it is not the upload.
      state.destinationEtag = 'a-different-file';

      const result = await applyModeration('paper-1', 'approve');

      expect(result.ok).toBe(false);
      // The row is rolled back to pending so the paper can be tried again.
      const rollback = state.updates[state.updates.length - 1];
      expect(rollback.patch.status).toBe('pending');
      expect(rollback.patch.file_path).toBe(PENDING_PATH);
    });

    it('rolls the status back when the copy itself fails', async () => {
      state.papers = [{ ...PENDING_PAPER }];
      state.copyError = { message: 'storage is not reachable' };

      const result = await applyModeration('paper-1', 'approve');

      expect(result.ok).toBe(false);
      const rollback = state.updates[state.updates.length - 1];
      expect(rollback.patch.status).toBe('pending');
      expect(rollback.patch.file_path).toBe(PENDING_PATH);
    });

    it('records the signed-in moderator in the trail', async () => {
      state.papers = [{ ...PENDING_PAPER }];

      await applyModeration('paper-1', 'approve');

      expect(state.logs).toHaveLength(1);
      expect(state.logs[0].moderator_email).toBe('Owner@GBU.ac.in');
      expect(state.logs[0].action).toBe('approve');
    });
  });

  describe('2. A guest upload keeps its identity without breaking the foreign key', () => {
    it('writes uploader_id = null and the device identity in uploader_student_id', async () => {
      const result = await uploadPendingPaper(FILE, META, {
        authUserId: null,
        studentId: 'GBU-99XYZ12',
        name: 'Guest Scholar',
        avatarId: 'tech-scholar',
      });

      expect(result.ok).toBe(true);
      expect(state.inserted).toHaveLength(1);
      const row = state.inserted[0];
      expect(row.uploader_id).toBeNull();
      expect(row.uploader_student_id).toBe('GBU-99XYZ12');
      expect(row.uploader_name).toBe('Guest Scholar');
      expect(row.uploader_avatar).toBe('tech-scholar');
      expect(row.file_size_bytes).toBe(2048);
      expect(row.status).toBe('pending');
    });

    it('writes the real auth id for a signed-in student', async () => {
      await uploadPendingPaper(FILE, META, {
        authUserId: '9F1B7C2E-4A55-4D61-9B0E-2C3D4E5F6A7B',
        studentId: 'GBU-21ICS045',
        name: 'Aarav Sharma',
      });

      expect(state.inserted[0].uploader_id).toBe('9f1b7c2e-4a55-4d61-9b0e-2c3d4e5f6a7b');
      expect(state.inserted[0].uploader_student_id).toBe('GBU-21ICS045');
    });

    it('never drops the attribution columns when the insert is refused', async () => {
      state.failSubjectCode = 'CSE205';

      const result = await uploadPendingPaper(FILE, META, {
        authUserId: null,
        studentId: 'GBU-99XYZ12',
        name: 'Guest Scholar',
      });

      expect(result.ok).toBe(false);
      // There is no second, thinner insert any more.
      expect(state.inserted).toHaveLength(0);
    });
  });

  describe('3. The offline queue drains', () => {
    it('uploads every queued paper and takes it off the phone', async () => {
      const entry = buildQueuedUpload(
        { uri: FILE.uri, name: FILE.name, mimeType: FILE.mimeType, size: FILE.size },
        META,
        new Date('2026-11-12T10:00:00.000Z'),
        { authUserId: null, studentId: 'GBU-99XYZ12', name: 'Guest Scholar' },
      );
      await enqueueUpload(entry);

      const result = await flushUploadQueue({ now: new Date('2026-11-12T10:01:00.000Z') });

      expect(result.uploaded).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.remaining).toHaveLength(0);
      expect(await readUploadQueue()).toHaveLength(0);
      expect(state.inserted).toHaveLength(1);
    });

    it('keeps a failed paper on the phone with a backoff', async () => {
      state.failSubjectCode = 'CSE205';
      const entry = buildQueuedUpload(
        { uri: FILE.uri, name: FILE.name, mimeType: FILE.mimeType, size: FILE.size },
        META,
        new Date('2026-11-12T10:00:00.000Z'),
        { authUserId: null, studentId: 'GBU-99XYZ12', name: 'Guest Scholar' },
      );
      await enqueueUpload(entry);

      const now = new Date('2026-11-12T10:01:00.000Z');
      const result = await flushUploadQueue({ now });

      expect(result.uploaded).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.remaining).toHaveLength(1);
      expect(result.remaining[0].status).toBe('failed');
      expect(result.remaining[0].attempts).toBe(1);
      expect(result.remaining[0].lastError).toBeTruthy();
      // The next attempt is in the future, so the paper is not hammered.
      expect(Date.parse(result.remaining[0].nextAttemptAt ?? '')).toBeGreaterThan(now.getTime());

      const stored = await readUploadQueue();
      expect(stored).toHaveLength(1);
      expect(stored[0].status).toBe('failed');

      // A flush straight afterwards waits for the backoff.
      const second = await flushUploadQueue({ now });
      expect(second.uploaded).toBe(0);
      expect(second.skipped).toBe(1);
    });
  });

  describe('4. No client file carries a service-role key', () => {
    const root = path.resolve(__dirname, '..');

    const clientFiles = [
      'src/features/pyq/pyqRepository.ts',
      'src/features/pyq/pyqStorage.ts',
      'src/features/pyq/pyqService.ts',
      'src/features/pyq/pyqLeaderboard.ts',
      'src/features/pyq/localUploadQueue.ts',
      'src/features/pyq/usePyqQuery.ts',
      'app/(tabs)/pyq.tsx',
      'app/moderation.tsx',
      'app/pyq/leaderboard.tsx',
      'src/components/pyq/PyqLeaderboardPodium.tsx',
    ];

    it('finds no service-role environment variable in the PYQ client', () => {
      for (const file of clientFiles) {
        const source = fs.readFileSync(path.join(root, file), 'utf-8');
        expect(source).not.toMatch(/SERVICE_ROLE/i);
        expect(source).not.toMatch(/EXPO_PUBLIC_ADMIN_SERVICE/);
      }
    });

    it('finds no service-role environment variable anywhere in the app source', () => {
      const offenders: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
            continue;
          }
          if (!/\.(ts|tsx)$/.test(entry.name)) continue;
          const source = fs.readFileSync(full, 'utf-8');
          if (/SERVICE_ROLE/i.test(source)) {
            offenders.push(path.relative(root, full));
          }
        }
      };
      walk(path.join(root, 'src'));
      walk(path.join(root, 'app'));
      expect(offenders).toEqual([]);
    });
  });

  describe('5. The points come from the server, not from the phone', () => {
    it('reads the contributor points from the server-derived view', async () => {
      state.points = [
        {
          uploader_student_id: 'GBU-21ICS045',
          approved_uploads: 3,
          total_downloads: 40,
          points: 999,
        },
      ];

      const board = await getLeaderboard();

      expect(board).toHaveLength(1);
      // The view says 999; a local tally (uploads * 50 + downloads) would
      // say 190. The view is the only source of truth.
      expect(board[0].points).toBe(999);
      expect(board[0].uploadsCount).toBe(3);
    });

    it('has no local points writer left in the app', () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, '..', 'src/features/pyq/pyqLeaderboard.ts'),
        'utf-8',
      );
      expect(source).not.toMatch(/awardUploadPoints/);
      expect(source).not.toMatch(/DEFAULT_LEADERBOARD_SEED/);
    });
  });
});

describe('PyqPaperRecord', () => {
  it('keeps the uploader details the moderation screen shows', () => {
    const record: Partial<PyqPaperRecord> = {
      uploaderStudentId: 'GBU-21ICS045',
      fileSizeBytes: 2048,
    };
    expect(record.uploaderStudentId).toBe('GBU-21ICS045');
  });
});
