/**
 * The question-paper library cache.
 *
 * The project rule is: "every main screen renders from local cache, then
 * refreshes". The PYQ screen did not - it kept its cache in AsyncStorage,
 * which is unindexed, unpruned and not transactional, so after a restart
 * the student only ever saw the bundled catalogue, and a student on a
 * patchy connection in the library building saw nothing at all.
 *
 * The cache now lives in SQLite, like the notices, the timetable and the
 * events. These tests pin that, and pin the migration from the old
 * AsyncStorage mirror.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readCachedPyqPapers, writeCachedPyqPapers } from '../src/lib/db';
import {
  PYQ_PAPERS_CACHE_KEY,
  cacheRowToItem,
  itemToCacheRow,
  mergeWithCatalogue,
  readCachedPapers,
  writeCachedPapers,
} from '../src/features/pyq/usePyqQuery';
import type { PYQItem } from '../src/features/pyq/pyqService';

const PAPER: PYQItem = {
  id: 'paper-1',
  school: 'SOICT',
  programme: 'BCS',
  semester: 'II',
  subjectCode: 'CSE205',
  subjectName: 'Data Structures & Algorithms',
  year: 2025,
  examType: 'End Sem',
  downloads: 12,
  status: 'approved',
  fileUrl: 'https://example.supabase.co/storage/v1/object/public/pyq/x.pdf',
  hasFile: true,
};

describe('the PYQ cache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    // The fake SQLite in tests/setup.ts keeps its tables between tests, so
    // the cache is emptied through the public API.
    writeCachedPyqPapers(
      [{ ...itemToCacheRow(PAPER, Date.now()) }],
      0,
    );
  });

  it('round-trips a paper through SQLite', () => {
    writeCachedPyqPapers([itemToCacheRow(PAPER, Date.now())]);
    const rows = readCachedPyqPapers();
    expect(rows.length).toBeGreaterThan(0);
    const found = rows.find((r) => r.id === PAPER.id);
    expect(found).toBeDefined();
    expect(found!.subjectCode).toBe('CSE205');
    expect(found!.school).toBe('SOICT');
    expect(found!.downloads).toBe(12);
  });

  it('reads a cached paper back into the shape the screen renders', () => {
    const item = cacheRowToItem(itemToCacheRow(PAPER, Date.now()));
    expect(item.id).toBe(PAPER.id);
    expect(item.subjectName).toBe(PAPER.subjectName);
    expect(item.examType).toBe('End Sem');
    expect(item.status).toBe('approved');
    expect(item.hasFile).toBe(true);
  });

  it('keeps only the newest papers', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      ...itemToCacheRow({ ...PAPER, id: `paper-${index}` }, Date.now() - index * 1000),
    }));
    writeCachedPyqPapers(many, 5);
    const rows = readCachedPyqPapers();
    expect(rows.length).toBeLessThanOrEqual(5);
    // The newest one must survive.
    expect(rows.some((r) => r.id === 'paper-0')).toBe(true);
  });

  it('migrates the old AsyncStorage cache into SQLite', async () => {
    // A device that upgrades mid-session still has the papers it had.
    await AsyncStorage.setItem(PYQ_PAPERS_CACHE_KEY, JSON.stringify([PAPER]));
    writeCachedPyqPapers([], 0); // empty the SQLite cache
    expect(readCachedPyqPapers().some((r) => r.id === PAPER.id)).toBe(false);

    const papers = await readCachedPapers();
    expect(papers.some((p) => p.id === PAPER.id)).toBe(true);
    // And it is now in SQLite, so the AsyncStorage mirror is only read once.
    expect(readCachedPyqPapers().some((r) => r.id === PAPER.id)).toBe(true);
  });

  it('writes both stores, so the first paint has something', async () => {
    await writeCachedPapers([PAPER]);
    expect(readCachedPyqPapers().some((r) => r.id === PAPER.id)).toBe(true);
    const mirror = await AsyncStorage.getItem(PYQ_PAPERS_CACHE_KEY);
    expect(mirror).not.toBeNull();
    expect(JSON.parse(mirror as string)).toHaveLength(1);
  });

  it('keeps the university catalogue when there is nothing live', () => {
    // The browse has to stay COMPLETE: a subject with no uploaded paper is
    // still offered, and it is marked as such.
    const merged = mergeWithCatalogue([]);
    expect(merged.length).toBeGreaterThan(0);
    expect(merged.every((p) => typeof p.id === 'string')).toBe(true);
  });
});
