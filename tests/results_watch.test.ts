/**
 * Unit tests for the results watch: does a re-published sheet raise exactly one
 * alert, and does an unpublished sheet raise none? (docs/NOTIFICATIONS.md,
 * docs/DATA_SOURCES.md, docs/OPEN_QUESTIONS.md #22.)
 */
import {
  detectSheetChanges,
  isKnownRevision,
  nextWatchState,
  parseWatchState,
  resultAlertBody,
  resultAlertTitle,
  revisionOf,
  sameRevision,
  type ResultsWatchState,
  type SheetFingerprint,
} from '../src/features/exams/resultsWatch';

const sheet = (overrides: Partial<SheetFingerprint> = {}): SheetFingerprint => ({
  code: 'soict',
  school: 'SOICT',
  url: 'https://exams.gbu.ac.in/uploads/results/soict.pdf',
  lastModified: 'Wed, 01 Oct 2026 06:00:00 GMT',
  bytes: 9_500_000,
  ...overrides,
});

describe('revisions', () => {
  it('keeps a known revision and blanks the unknown ones', () => {
    expect(revisionOf(sheet())).toEqual({
      lastModified: 'Wed, 01 Oct 2026 06:00:00 GMT',
      bytes: 9_500_000,
    });
    expect(revisionOf(sheet({ lastModified: null, bytes: null }))).toEqual({
      lastModified: null,
      bytes: null,
    });
  });

  it('treats a sheet with no headers at all as unknown', () => {
    expect(isKnownRevision(revisionOf(sheet({ lastModified: null, bytes: null })))).toBe(false);
    expect(isKnownRevision(revisionOf(sheet({ bytes: null })))).toBe(true);
  });

  it('never calls two unknowns a match unless both are unknown', () => {
    const unknown = { lastModified: null, bytes: null };
    expect(sameRevision(unknown, unknown)).toBe(true);
    // A 404 this time and a real sheet last time is not a change.
    expect(sameRevision({ lastModified: 'x', bytes: 10 }, unknown)).toBe(true);
  });
});

describe('change detection', () => {
  it('says nothing on the first look (there is no baseline)', () => {
    expect(detectSheetChanges({}, [sheet()])).toEqual([]);
  });

  it('says nothing when the revision is unchanged', () => {
    const state = nextWatchState({}, [sheet()]);
    expect(detectSheetChanges(state, [sheet()])).toEqual([]);
  });

  it('reports a revised sheet once the portal republishes it', () => {
    const state = nextWatchState({}, [sheet()]);
    const changes = detectSheetChanges(
      state,
      [sheet({ lastModified: 'Thu, 20 Nov 2026 05:30:00 GMT', bytes: 9_700_000 })],
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ code: 'soict', school: 'SOICT', status: 'revised' });
  });

  it('reports a sheet that appears inside an already-known set', () => {
    const state = nextWatchState({}, [sheet()]);
    const changes = detectSheetChanges(state, [
      sheet(),
      sheet({ code: 'psom', school: 'SOM', url: 'https://x/psom.pdf' }),
    ]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ code: 'psom', status: 'published' });
  });

  it('ignores a sheet the portal does not answer for yet', () => {
    const state = nextWatchState({}, [sheet()]);
    const changes = detectSheetChanges(state, [
      sheet({ lastModified: null, bytes: null }),
    ]);
    expect(changes).toEqual([]);
  });

  it('keeps the stored revision of a sheet that went missing', () => {
    const state = nextWatchState({}, [sheet()]);
    const next = nextWatchState(state as ResultsWatchState, []);
    expect(next.soict).toEqual(state.soict);
  });
});

describe('alert wording', () => {
  it('names the school and the reason', () => {
    const revised = {
      code: 'soict',
      school: 'SOICT',
      url: 'https://x/soict.pdf',
      status: 'revised' as const,
    };
    expect(resultAlertTitle(revised)).toBe('SOICT results published');
    expect(resultAlertBody(revised)).toContain('re-published');

    const published = { ...revised, status: 'published' as const };
    expect(resultAlertBody(published)).toContain('added a new result sheet');
  });
});

describe('stored state', () => {
  it('survives a round trip', () => {
    const state = nextWatchState({}, [sheet()]);
    expect(parseWatchState(JSON.stringify(state))).toEqual(state);
  });

  it('ignores junk instead of throwing', () => {
    expect(parseWatchState(null)).toEqual({});
    expect(parseWatchState('not json')).toEqual({});
    expect(parseWatchState('[1,2,3]')).toEqual({});
    expect(parseWatchState('{"soict":null}')).toEqual({});
    expect(parseWatchState('{"soict":{"lastModified":7,"bytes":"big"}}')).toEqual({
      soict: { lastModified: null, bytes: null },
    });
  });
});