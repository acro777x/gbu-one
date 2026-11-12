/**
 * Worker pipeline tests.
 *
 * These cover the failure contract of the worker - the part that used to be
 * silently wrong:
 *
 *  1. the OCR text of a notice survives a second upsert,
 *  2. a failed stage makes the run exit non-zero,
 *  3. a failed read is not the same as an empty table,
 *  4. the reads are paged, so a table with more than 1000 rows is read
 *     completely,
 *  5. the source id is a sha256 hash,
 *  6. an undated notice keeps the date it was first seen with.
 *
 * The Supabase client is replaced with an in-memory double, so the tests
 * run without a network and without a database.
 */
import { createHash } from 'crypto';
import { extractAttachments } from '../worker/attachmentPipeline';

type Row = Record<string, unknown>;

/** One row of an in-memory table. */
interface Table {
  rows: Row[];
  /** The rows the double hands out per page. */
  pageSize: number;
  /** When set, every read of this table fails with this message. */
  readError: string | null;
  /** Every upsert payload the worker sent, in order. */
  upserts: Row[][];
}

/** The double of the Supabase client. */
class FakeSupabase {
  readonly tables = new Map<string, Table>();
  /** The number of range() calls, per table. */
  readonly rangeCalls = new Map<string, number>();

  private table(name: string): Table {
    let table = this.tables.get(name);
    if (!table) {
      table = { rows: [], pageSize: 1000, readError: null, upserts: [] };
      this.tables.set(name, table);
    }
    return table;
  }

  /** Fills a table with rows. */
  seed(name: string, rows: Row[]): void {
    this.table(name).rows = [...rows];
  }

  /** Makes every read of a table fail. */
  failReads(name: string, message: string): void {
    this.table(name).readError = message;
  }

  from(name: string): FakeBuilder {
    return new FakeBuilder(this, name);
  }
}

/** The chainable query builder of the double. */
class FakeBuilder {
  private filters: Array<{ column: string; op: string; value: unknown }> = [];
  private rangeWindow: [number, number] | null = null;
  private orderColumn: string | null = null;
  private pending: { kind: 'upsert' | 'insert' | 'update' | 'delete'; rows?: Row[] } | null = null;

  constructor(
    private readonly db: FakeSupabase,
    private readonly tableName: string,
  ) {}

  private get table(): Table {
    return this.db.tables.get(this.tableName) ?? { rows: [], pageSize: 1000, readError: null, upserts: [] };
  }

  select(_columns?: string): FakeBuilder {
    return this;
  }

  order(column: string): FakeBuilder {
    this.orderColumn = column;
    return this;
  }

  eq(column: string, value: unknown): FakeBuilder {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }

  is(column: string, value: unknown): FakeBuilder {
    this.filters.push({ column, op: 'is', value });
    return this;
  }

  in(column: string, values: readonly unknown[]): FakeBuilder {
    this.filters.push({ column, op: 'in', value: values });
    return this;
  }

  neq(column: string, value: unknown): FakeBuilder {
    this.filters.push({ column, op: 'neq', value });
    return this;
  }

  limit(_count: number): FakeBuilder {
    return this;
  }

  range(from: number, to: number): FakeBuilder {
    this.rangeWindow = [from, to];
    const calls = this.db.rangeCalls.get(this.tableName) ?? 0;
    this.db.rangeCalls.set(this.tableName, calls + 1);
    return this;
  }

  upsert(rows: Row[]): FakeBuilder {
    this.pending = { kind: 'upsert', rows };
    return this;
  }

  insert(rows: Row[]): FakeBuilder {
    this.pending = { kind: 'insert', rows };
    return this;
  }

  update(rows: Row[]): FakeBuilder {
    this.pending = { kind: 'update', rows };
    return this;
  }

  delete(): FakeBuilder {
    this.pending = { kind: 'delete' };
    return this;
  }

  maybeSingle(): Promise<{ data: Row | null; error: { message: string } | null }> {
    return this.then() as Promise<{ data: Row | null; error: { message: string } | null }>;
  }

  single(): Promise<{ data: Row | null; error: { message: string } | null }> {
    return this.then() as Promise<{ data: Row | null; error: { message: string } | null }>;
  }

  then(
    resolve?: (value: { data: unknown; error: { message: string } | null }) => unknown,
  ): Promise<{ data: unknown; error: { message: string } | null }> {
    const result = this.execute();
    return Promise.resolve(result).then(resolve as never);
  }

  private execute(): { data: unknown; error: { message: string } | null } {
    const table = this.table;
    const pending = this.pending;

    if (pending) {
      if (pending.kind === 'upsert') {
        const rows = pending.rows ?? [];
        table.upserts.push(rows);
        for (const row of rows) {
          const key = String(row.source_id ?? row.file_url ?? row.event_key ?? row.slot_key ?? '');
          const existing = table.rows.find((candidate) =>
            Object.entries(row).some(([column, value]) => candidate[column] === value && column.endsWith('_id') || candidate[column] === value && column === 'file_url'),
          );
          if (existing) {
            Object.assign(existing, row);
          } else {
            table.rows.push({ ...row });
          }
          void key;
        }
        return { data: null, error: null };
      }
      if (pending.kind === 'insert') {
        table.rows.push(...(pending.rows ?? []));
        return { data: null, error: null };
      }
      if (pending.kind === 'update') {
        const patch = pending.rows ?? [];
        const matched = this.matching();
        for (const row of matched) Object.assign(row, patch);
        return { data: null, error: null };
      }
      if (pending.kind === 'delete') {
        const matched = this.matching();
        table.rows = table.rows.filter((row) => !matched.includes(row));
        return { data: null, error: null };
      }
    }

    if (table.readError) {
      return { data: null, error: { message: table.readError } };
    }

    let rows = this.matching();
    if (this.orderColumn) {
      const column = this.orderColumn;
      rows = [...rows].sort((a, b) => {
        const left = String(a[column] ?? '');
        const right = String(b[column] ?? '');
        return left < right ? -1 : left > right ? 1 : 0;
      });
    }
    if (this.rangeWindow) {
      const [from, to] = this.rangeWindow;
      rows = rows.slice(from, to + 1);
    }
    return { data: rows, error: null };
  }

  /** The rows that pass every filter of the chain. */
  private matching(): Row[] {
    const table = this.table;
    return table.rows.filter((row) =>
      this.filters.every(({ column, op, value }) => {
        switch (op) {
          case 'eq':
            return row[column] === value;
          case 'is':
            return value === null ? row[column] === null || row[column] === undefined : row[column] === value;
          case 'in':
            return Array.isArray(value) && value.includes(row[column]);
          case 'neq':
            return row[column] !== value;
          default:
            return true;
        }
      }),
    );
  }
}

const fakeDb = new FakeSupabase();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: (name: string) => fakeDb.from(name),
  })),
}));

import {
  fetchKnownSourceIds,
  upsertNotices,
  saveNoticeRawText,
  checkSchema,
  deleteLegacyNoticeRows,
  STAGE_TABLES,
} from '../worker/supabaseClient';
import { generateSourceId, enrichScrapedNotice } from '../worker/noticesJob';
import { StageFailures } from '../worker/runStages';

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  };
  fakeDb.tables.clear();
  fakeDb.rangeCalls.clear();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('worker pipeline: the OCR text survives a second upsert', () => {
  it('does not overwrite raw_text when the notice is upserted again', async () => {
    fakeDb.seed('notices', []);

    const notice = enrichScrapedNotice({
      source: 'main',
      rawTitle: 'Revised Schedule for Mid Semester Examination Autumn 2026',
      url: 'https://www.gbu.ac.in/Admissions/DownloadFile?nName=MidSem.pdf',
      dateStr: '18/10/2026',
    });

    // The first run stores the notice and the text the OCR produced.
    const first = await upsertNotices([notice]);
    expect(first.written).toBe(1);
    expect(first.failed).toBe(0);
    await saveNoticeRawText(notice.sourceId, 'OCR TEXT OF THE NOTICE');

    // The second run upserts the very same notice again.
    const second = await upsertNotices([notice]);
    expect(second.written).toBe(1);

    const stored = fakeDb.tables.get('notices')?.rows ?? [];
    expect(stored).toHaveLength(1);
    expect(stored[0].raw_text).toBe('OCR TEXT OF THE NOTICE');
  });

  it('never sends raw_text in the bulk upsert payload', async () => {
    fakeDb.seed('notices', []);
    const notice = enrichScrapedNotice({
      source: 'main',
      rawTitle: 'Fee Submission Notice',
      url: 'https://www.gbu.ac.in/fee.pdf',
      dateStr: '18/10/2026',
    });

    await upsertNotices([notice]);

    const upserts = fakeDb.tables.get('notices')?.upserts ?? [];
    expect(upserts.length).toBeGreaterThan(0);
    for (const payload of upserts) {
      for (const row of payload) {
        expect(Object.prototype.hasOwnProperty.call(row, 'raw_text')).toBe(false);
      }
    }
  });
});

describe('worker pipeline: a failed stage sets a non-zero exit code', () => {
  it('reports the failing stage and asks for exit code 1', () => {
    const failures = new StageFailures();
    expect(failures.exitCode()).toBe(0);

    failures.record('calendar', 'the academic calendar could not be read');

    expect(failures.exitCode()).toBe(1);
    expect(failures.list()).toEqual(['calendar']);
  });

  it('keeps every failing stage, so one failure does not hide another', () => {
    const failures = new StageFailures();
    failures.record('notices', 'empty parse');
    failures.record('timetable', 'push failed');

    expect(failures.exitCode()).toBe(1);
    expect(failures.list()).toEqual(['notices', 'timetable']);
  });

  it('exits zero when every stage worked', () => {
    const failures = new StageFailures();
    failures.recordOk('notices');
    failures.recordOk('calendar');
    expect(failures.exitCode()).toBe(0);
    expect(failures.list()).toEqual([]);
  });
});

describe('worker pipeline: a failed read is not an empty table', () => {
  it('reports the failure instead of an empty set', async () => {
    fakeDb.failReads('notices', 'connection refused');

    const known = await fetchKnownSourceIds();

    expect(known.ok).toBe(false);
    expect(known.error).toContain('connection refused');
    expect(known.ids.size).toBe(0);
  });

  it('reports an empty table as a successful read', async () => {
    fakeDb.seed('notices', []);

    const known = await fetchKnownSourceIds();

    expect(known.ok).toBe(true);
    expect(known.error).toBeNull();
    expect(known.ids.size).toBe(0);
  });

  it('reports a missing table as a failed read', async () => {
    fakeDb.failReads('notices', 'relation "public.notices" does not exist');

    const known = await fetchKnownSourceIds();

    expect(known.ok).toBe(false);
    expect(known.error).toContain('does not exist');
  });
});

describe('worker pipeline: the reads are paged', () => {
  it('reads past the 1000 rows PostgREST returns by default', async () => {
    const rows = Array.from({ length: 2500 }, (_, index) => ({
      source_id: `src_${String(index).padStart(5, '0')}`,
    }));
    fakeDb.seed('notices', rows);

    const known = await fetchKnownSourceIds();

    expect(known.ok).toBe(true);
    expect(known.ids.size).toBe(2500);
    // More than one page had to be read.
    expect(fakeDb.rangeCalls.get('notices') ?? 0).toBeGreaterThan(1);
  });

  it('finds the schema missing when a required table cannot be read', async () => {
    fakeDb.failReads('notices', 'relation "public.notices" does not exist');

    const check = await checkSchema();

    expect(check.ok).toBe(false);
    expect(check.missing).toContain('notices');
  });

  it('finds the results push log missing when the results stage cannot run', async () => {
    fakeDb.failReads(
      'results_push_log',
      'relation "public.results_push_log" does not exist',
    );

    const check = await checkSchema(STAGE_TABLES);

    expect(check.ok).toBe(false);
    expect(check.missing).toContain('results_push_log');
  });
});

describe('worker pipeline: the source id is a sha256 hash', () => {
  it('is 64 hex characters of sha256', () => {
    const id = generateSourceId('main', 'https://www.gbu.ac.in/x.pdf', '01 Oct 2026');

    expect(id).toMatch(/^src_[0-9a-f]{64}$/);
  });

  it('removes the row of the old, shorter id so the notice is not stored twice', async () => {
    const id = generateSourceId('main', 'https://www.gbu.ac.in/x.pdf', '01 Oct 2026');
    // The old id was the first 16 hex characters of the same digest.
    const legacyId = `src_${id.slice(4, 20)}`;
    fakeDb.seed('notices', [
      { source_id: legacyId, title: 'Old row', posted_at: '2026-10-01T00:00:00.000Z' },
    ]);

    const deleted = await deleteLegacyNoticeRows([legacyId], new Set([id]));

    expect(deleted.written).toBe(1);
    expect(fakeDb.tables.get('notices')?.rows ?? []).toHaveLength(0);
  });

  it('keeps an old row whose notice was not seen in this run', async () => {
    const legacyId = 'src_0123456789abcdef';
    fakeDb.seed('notices', [{ source_id: legacyId, title: 'Still published' }]);

    const deleted = await deleteLegacyNoticeRows([legacyId], new Set(['src_other']));

    expect(deleted.written).toBe(0);
    expect(fakeDb.tables.get('notices')?.rows ?? []).toHaveLength(1);
  });

  it('is deterministic for the same notice', () => {
    const a = generateSourceId('main', 'https://www.gbu.ac.in/x.pdf', '01 Oct 2026');
    const b = generateSourceId('main', 'https://www.gbu.ac.in/x.pdf', '01 Oct 2026');
    expect(a).toBe(b);
  });

  it('differs when the url or the date differs', () => {
    const a = generateSourceId('main', 'https://www.gbu.ac.in/x.pdf', '01 Oct 2026');
    const b = generateSourceId('main', 'https://www.gbu.ac.in/y.pdf', '01 Oct 2026');
    const c = generateSourceId('main', 'https://www.gbu.ac.in/x.pdf', '02 Oct 2026');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('is the sha256 of the normalised source, url and date', () => {
    const expected = createHash('sha256')
      .update('main_https://www.gbu.ac.in/x.pdf_01 Oct 2026')
      .digest('hex');
    expect(generateSourceId('main', 'https://www.gbu.ac.in/x.pdf', '01 Oct 2026')).toBe(
      `src_${expected}`,
    );
  });
});

describe('worker pipeline: an undated notice keeps its original date', () => {
  it('does not move to the top on every run', async () => {
    fakeDb.seed('notices', []);

    // The hostel, OHMS, CSMS and DigiForms parsers cannot read a date, so
    // they report "undated".
    const notice = enrichScrapedNotice({
      source: 'hostel',
      rawTitle: 'Second List of Hostel Allotment',
      url: 'https://hostels.gbu.ac.in/allotment.pdf',
      dateStr: 'undated',
    });

    await upsertNotices([notice]);
    const stored = fakeDb.tables.get('notices')?.rows ?? [];
    const firstPostedAt = stored[0]?.posted_at;
    expect(typeof firstPostedAt).toBe('string');

    // A later run sees the same notice. The date must not change, or the
    // notice floats to the top of the list every fifteen minutes.
    await upsertNotices([notice]);
    const after = fakeDb.tables.get('notices')?.rows ?? [];
    expect(after[0]?.posted_at).toBe(firstPostedAt);
  });
});

describe('worker pipeline: a file attached to several notices is fetched once', () => {
  it('downloads the file once and gives every notice the same text', async () => {
    let downloads = 0;
    const text = 'Fee Submission Deadline Extended';
    const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
    const download = async () => {
      downloads += 1;
      return {
        bytes: Buffer.from(
          `%PDF-1.4\n1 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\ntrailer\n%%EOF\n`,
          'latin1',
        ),
        contentType: 'application/pdf',
      };
    };

    const results = await extractAttachments(
      [
        { sourceId: 'src_a', fileUrl: 'https://www.gbu.ac.in/shared.pdf' },
        { sourceId: 'src_b', fileUrl: 'https://www.gbu.ac.in/shared.pdf' },
      ],
      { download },
    );

    expect(results).toHaveLength(2);
    // The file was fetched once, not once per notice.
    expect(downloads).toBe(1);
    expect(results[0].outcome.rawText).toContain('Fee Submission Deadline Extended');
    expect(results[1].outcome.rawText).toContain('Fee Submission Deadline Extended');
  });
});
