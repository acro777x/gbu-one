/**
 * The client half of the examinations hub.
 *
 * These tests cover the two things that were plainly broken:
 *  6. "Open Result Sheet (PDF)" could never work, because the lookup
 *     compared `undefined === false`.
 *  7. The results watch compared its baseline over every school, so
 *     switching school raised a false "results published" alert.
 *
 * They also pin down the sample labelling and the canonical class key, which
 * decide whether a student is shown another programme's schedule.
 */
import {
  resultSheetForSchool,
  normaliseSchoolCode,
  PUBLIC_RESULT_SHEETS,
} from '../src/features/exams/resultPortals';
import {
  detectSheetChanges,
  hasBaselineForSchool,
  nextWatchState,
  type SheetFingerprint,
} from '../src/features/exams/resultsWatch';
import { buildCanonicalClassKey, buildClassKey } from '../src/features/exams/examDateSheetParser';
import { getClassDatesheet } from '../src/features/exams/examService';
import { SEED_DECLARED_RESULTS } from '../src/features/exams/useResultsQuery';

const sheet = (overrides: Partial<SheetFingerprint> = {}): SheetFingerprint => ({
  code: 'soict',
  school: 'SOICT',
  url: 'https://exams.gbu.ac.in/uploads/results/soict.pdf',
  lastModified: 'Wed, 01 Oct 2026 06:00:00 GMT',
  bytes: 9_500_000,
  ...overrides,
});

describe('exams client', () => {
  describe('result sheet lookup', () => {
    it('finds the normal (non-special) sheet of a school', () => {
      const found = resultSheetForSchool('SOICT');
      expect(found).toBeDefined();
      expect(found?.code).toBe('soict');
      expect(found?.school).toBe('SOICT');
      // The normal sheets carry no `special` flag at all, so the lookup has
      // to treat a missing flag as "not special".
      expect(found?.special).toBeUndefined();
    });

    it('finds the normal sheet whatever the case of the school code', () => {
      expect(resultSheetForSchool('soict')?.code).toBe('soict');
      expect(resultSheetForSchool('soe')?.code).toBe('soe');
      expect(resultSheetForSchool('som')?.code).toBe('som');
    });

    it('finds the passout sheet only when it is asked for', () => {
      expect(resultSheetForSchool('SOICT', true)?.code).toBe('psoict');
      expect(resultSheetForSchool('SOICT', true)?.special).toBe(true);
      // The normal sheet is never the passout sheet.
      expect(resultSheetForSchool('SOICT', false)?.code).toBe('soict');
    });

    it('finds the sheet of a school that is published under another code', () => {
      // The examination portal publishes `soljg.pdf` and `sovasas.pdf`, the
      // app calls those schools SOL and SOVSAS.
      expect(normaliseSchoolCode('SOLJG')).toBe('SOL');
      expect(normaliseSchoolCode('SOVASAS')).toBe('SOVSAS');
      expect(resultSheetForSchool('SOLJG')?.code).toBe('soljg');
      expect(resultSheetForSchool('SOVASAS')?.code).toBe('sovasas');
    });

    it('has a sheet for every school the university runs', () => {
      const schools = ['SOICT', 'SOBT', 'SOE', 'SOHSS', 'SOL', 'SOM', 'SOBSC', 'SOVSAS'];
      for (const school of schools) {
        expect(resultSheetForSchool(school)).toBeDefined();
      }
      // Every published sheet has a normal and a passout twin.
      expect(PUBLIC_RESULT_SHEETS.filter((s) => !s.special)).toHaveLength(8);
      expect(PUBLIC_RESULT_SHEETS.filter((s) => s.special)).toHaveLength(8);
    });

    it('returns nothing for an unknown school', () => {
      expect(resultSheetForSchool('')).toBeUndefined();
      expect(resultSheetForSchool(null)).toBeUndefined();
      expect(resultSheetForSchool('UNKNOWN_SCHOOL')).toBeUndefined();
    });
  });

  describe('results watch baseline', () => {
    it('is scoped to one school', () => {
      const state = nextWatchState({}, [sheet()]);
      expect(hasBaselineForSchool(state, 'SOICT')).toBe(true);
      // SOM has never been looked at, so it has no baseline.
      expect(hasBaselineForSchool(state, 'SOM')).toBe(false);
      expect(hasBaselineForSchool(state, '')).toBe(false);
      expect(hasBaselineForSchool(state, null)).toBe(false);
    });

    it('does not raise a false alert when the student switches school', () => {
      const state = nextWatchState({}, [sheet()]);
      const changes = detectSheetChanges(state, [
        sheet({ code: 'som', school: 'SOM', url: 'https://exams.gbu.ac.in/uploads/results/som.pdf' }),
      ]);
      expect(changes).toEqual([]);
    });

    it('raises an alert once the new school has a baseline of its own', () => {
      const state = nextWatchState(
        nextWatchState({}, [sheet()]),
        [sheet({ code: 'som', school: 'SOM', url: 'https://exams.gbu.ac.in/uploads/results/som.pdf' })],
      );
      const changes = detectSheetChanges(state, [
        sheet({ code: 'psom', school: 'SOM', url: 'https://exams.gbu.ac.in/uploads/results/passout/psom.pdf' }),
      ]);
      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({ code: 'psom', school: 'SOM', status: 'published' });
    });
  });

  describe('class key and sample labelling', () => {
    it('names the class of a published section code', () => {
      expect(buildClassKey('BAI-III-B')).toBe('btech_ai_sem3');
      expect(buildCanonicalClassKey('BAI-III-B')).toBe('btech_ai_sem3_b');
      expect(buildClassKey('BCS-III-A')).toBe('btech_cse_sem3');
    });

    it('marks the bundled schedule as a sample', () => {
      const sample = getClassDatesheet('btech_cse_sem3', 'end');
      expect(sample.length).toBeGreaterThan(0);
      expect(sample.every((entry) => entry.isSample === true)).toBe(true);
    });

    it('marks the bundled result announcements as a sample', () => {
      expect(SEED_DECLARED_RESULTS.length).toBeGreaterThan(0);
      expect(SEED_DECLARED_RESULTS.every((r) => r.isSample === true)).toBe(true);
    });
  });
});
