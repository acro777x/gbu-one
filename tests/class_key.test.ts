/**
 * The canonical class key.
 *
 * The canonical key (`btech_cse_sem3_2025_2029_b`) is the identity of ONE
 * class; the base key (`btech_cse_sem3`) is the value the database is
 * filtered on. These tests pin the two apart: the base key is always a
 * prefix of the canonical key, and two cohorts of one programme share the
 * base key but never the slot key.
 */
import {
  baseClassKeyOf,
  buildCanonicalClassKey,
  buildClassKey,
  canonicalClassKeyOf,
  dateSlotKey,
  matchClassKey,
  parseCanonicalClassKey,
  parseClassKeyParts,
  resolveClassKeys,
} from '../src/lib/classKey';
import { parseExcelDateSheet } from '../src/features/exams/examDateSheetParser';
import { parseAnyDateSheet } from '../worker/examDateSheet';

describe('the canonical class key', () => {
  it('round-trips through its parts', () => {
    const parts = parseCanonicalClassKey('btech_cse_sem3_2025_2029_b');
    expect(parts).toEqual({
      programme: 'btech_cse',
      semester: 3,
      batch: '2025_2029',
      section: 'B',
    });

    // The key is rebuilt from the parts, so reading a key and writing it
    // back cannot change it.
    expect(canonicalClassKeyOf(parts)).toBe('btech_cse_sem3_2025_2029_b');
    expect(parseCanonicalClassKey(canonicalClassKeyOf(parts))).toEqual(parts);
  });

  it('reads a published section code and a programme text into the same parts', () => {
    expect(parseClassKeyParts('BCS-III-B')).toEqual({
      programme: 'btech_cse',
      semester: 3,
      section: 'B',
    });
    expect(parseClassKeyParts('B. Tech. (CSE) Batch (2025-2029) 3rd Semester')).toEqual({
      programme: 'btech_cse',
      semester: 3,
      batch: '2025_2029',
    });
    // The date sheets print the cohort without brackets: `Batch -2025-2030`.
    expect(parseClassKeyParts('Bachelor of Architecture Batch -2025-2030 (I Semester )').batch).toBe(
      '2025_2030',
    );
  });

  it('keeps the base key a prefix of the canonical key', () => {
    const canonical = 'btech_cse_sem3_2025_2029_b';
    const base = baseClassKeyOf(canonical);

    expect(base).toBe('btech_cse_sem3');
    expect(canonical.startsWith(base)).toBe(true);
    // The base key is what the database is filtered on, so it never names
    // the cohort or the section.
    expect(buildClassKey('B. Tech. (CSE) Batch (2025-2029) 3rd Semester')).toBe('btech_cse_sem3');
    expect(buildCanonicalClassKey('B. Tech. (CSE) Batch (2025-2029) 3rd Semester')).toBe(
      'btech_cse_sem3_2025_2029',
    );
  });

  it('gives two cohorts of one programme two slot keys and one base key', () => {
    const older = resolveClassKeys('B.Tech (CSE) Batch (2022-2026) Sem 3');
    const newer = resolveClassKeys('B.Tech (CSE) Batch (2025-2029) Sem 3');

    expect(older.canonical).toBe('btech_cse_sem3_2022_2026');
    expect(newer.canonical).toBe('btech_cse_sem3_2025_2029');
    // The same programme and the same semester: the base key is the same.
    expect(older.base).toBe('btech_cse_sem3');
    expect(newer.base).toBe(older.base);
    // The slot key is the canonical key, so the cohorts stay apart.
    expect(older.canonical).not.toBe(newer.canonical);

    const olderSlot = dateSlotKey(
      'soict',
      '2026-12-14',
      'morning',
      'CSE201',
      'Scientific Computing',
      older.canonical,
    );
    const newerSlot = dateSlotKey(
      'soict',
      '2026-12-14',
      'morning',
      'CSE201',
      'Scientific Computing',
      newer.canonical,
    );
    expect(olderSlot).not.toBe(newerSlot);
    expect(olderSlot).toContain('btech_cse_sem3_2022_2026');
    expect(newerSlot).toContain('btech_cse_sem3_2025_2029');
  });

  it('keeps two cohorts of one programme apart in a parsed date sheet', () => {
    const csv = [
      'Date,Shift,Programme,Semester,Course Code,Course Name,Paper ID',
      '14-12-2026,Morning 09:30-12:30,B.Tech (CSE) Batch (2022-2026),Sem 3,CSE201,Scientific Computing,101',
      '14-12-2026,Morning 09:30-12:30,B.Tech (CSE) Batch (2025-2029),Sem 3,CSE201,Scientific Computing,102',
    ].join('\n');

    const slots = parseExcelDateSheet(csv, { examType: 'end_sem', schoolCode: 'soict' });
    expect(slots).toHaveLength(2);
    // Two cohorts of one programme are two rows, not one row that overwrites
    // the other.
    expect(slots[0].slotKey).not.toBe(slots[1].slotKey);
    // Both are the same class for the database, which filters on the base key.
    expect(slots[0].classKey).toBe('btech_cse_sem3');
    expect(slots[1].classKey).toBe('btech_cse_sem3');
  });

  it('matches a key that does not name the batch or the section', () => {
    // The date sheet is published per programme, so a slot that only knows
    // the programme matches every cohort and every section of it.
    expect(matchClassKey('btech_cse_sem3', 'btech_cse_sem3_2025_2029_b')).toBe(true);
    expect(matchClassKey('btech_cse_sem3_2025_2029', 'btech_cse_sem3')).toBe(true);
    expect(matchClassKey('btech_cse_sem3_b', 'btech_cse_sem3')).toBe(true);
    // The programme is matched through its aliases.
    expect(matchClassKey('bcs_sem3', 'btech_cse_sem3')).toBe(true);
    // A published section code names the same class as the slug.
    expect(matchClassKey('BCS-III-B', 'btech_cse_sem3')).toBe(true);
  });

  it('never matches two different batches or two different sections', () => {
    expect(matchClassKey('btech_cse_sem3_2022_2026', 'btech_cse_sem3_2025_2029')).toBe(false);
    expect(matchClassKey('btech_cse_sem3_a', 'btech_cse_sem3_b')).toBe(false);
    expect(matchClassKey('btech_cse_sem3_2025_2029_a', 'btech_cse_sem3_2025_2029_b')).toBe(false);
    // A different programme or a different semester is never a match.
    expect(matchClassKey('btech_ai_sem3', 'btech_cse_sem3')).toBe(false);
    expect(matchClassKey('btech_cse_sem4', 'btech_cse_sem3')).toBe(false);
  });

  it('reads a date sheet of the worker into a canonical slot key', () => {
    const csv = [
      'Date,Shift,Programme,Semester,Course Code,Course Name,Paper ID',
      '14-12-2026,Morning 09:30-12:30,B.Tech (CSE) Batch (2025-2029),Sem 3,CSE201,Scientific Computing,101',
    ].join('\n');

    const slots = parseAnyDateSheet(csv, 'soe-end-sem.csv', {
      examType: 'end_sem',
      schoolCode: 'soe',
    });
    expect(slots).toHaveLength(1);
    // The slot key carries the cohort, the row carries the filter value.
    expect(slots[0].slotKey).toContain('btech_cse_sem3_2025_2029');
    expect(slots[0].classKey).toBe('btech_cse_sem3');
  });

  it('names the programme of the two schools that publish no timetable', () => {
    // The School of Law publishes its date sheet with an EMPTY programme
    // column - the cell holds only "2024-2029 II" - so the school is the
    // only thing that names the programme. Verified against the live sheet
    // on 2026-11-13.
    expect(buildCanonicalClassKey('2024-2029 III', undefined, undefined, 'soljg')).toBe(
      'llb_sem3_2024_2029',
    );
    expect(buildCanonicalClassKey('2023-2028 V', undefined, undefined, 'soljg')).toBe(
      'llb_sem5_2023_2028',
    );

    // The School of Basic Science publishes the Buddhist Studies programmes
    // by name.
    expect(
      buildCanonicalClassKey(
        'M.A. in Buddhist Studies & Civilization (Batch-2025-2027) Semester- I',
      ),
    ).toBe('ma_buddhist_studies_sem1_2025_2027');
    expect(
      buildCanonicalClassKey(
        'B.A. (Hons.) in Buddhist Studies & Civilization (Batch- 2025-2029) Semester- I',
      ),
    ).toBe('ba_hons_buddhist_studies_sem1_2025_2029');
  });

  it('never produces a malformed key when the programme is unknown', () => {
    // It used to produce "_sem1_2025_2030" - a key with a leading
    // underscore that no other school would ever match.
    const key = buildCanonicalClassKey('2025-2030 I');
    expect(key.startsWith('_')).toBe(false);
    expect(key).toBe('general_sem1_2025_2030');
  });
});
