/**
 * The class key of a date sheet must name the programme the sheet is for.
 *
 * The School of ICT publishes its date sheet with the programme in
 * brackets - `B. Tech. (CSE) Batch (2025-2029) 1st Semester` - and the
 * School of Engineering publishes it as `B.Tech. (Civil Engineering)
 * Batch- 2022-2026 (Semester- VII)`. Every one of those names has to land
 * on the key of the right programme, because the key is what the app
 * filters the student's date sheet on.
 *
 * Three real bugs are locked down here:
 *
 *   * `Civil Engineering` contains the letters "ee", so the generic
 *     "engineering" rule gave a Civil student the key of an Electrical
 *     student, and the two programmes shared one date sheet;
 *   * `Cyber Security` contains the letters "it", so a Cyber Security
 *     student was sent to the Information Technology date sheet;
 *   * `B. Tech. (ML)` and `B. Tech. (DS)` matched no rule at all and fell
 *     through to the raw text, which no student could ever pick.
 */
import {
  baseClassKeyOf,
  buildCanonicalClassKey,
  matchClassKey,
} from '../src/lib/classKey';

describe('the class key of a date sheet', () => {
  const cases: Array<[string, string]> = [
    ['B. Tech. (CSE) Batch (2025-2029) 1st Semester', 'btech_cse_sem1_2025_2029'],
    [
      'Int. B. Tech.+ M. Tech. (CSE) Batch (2025-2030) 1st Semester',
      'int_btech_mtech_cse_sem1_2025_2030',
    ],
    [
      '5 Year Integrated B. Tech.- M.Tech (CSE) Batch (2024-2029) 3rd Semester',
      'int_btech_mtech_cse_sem3_2024_2029',
    ],
    [
      'B. Tech. (Cyber Security) Batch (2024-2028) 3rd Semester',
      'btech_cse_cyber_sem3_2024_2028',
    ],
    ['B. Tech. (ML) Batch (2024-2028) 3rd Semester', 'btech_cse_ml_sem3_2024_2028'],
    ['B. Tech. (DS) Batch (2024-2028) 3rd Semester', 'btech_cse_ds_sem3_2024_2028'],
    ['B. Tech. (AI) Batch (2024-2028) 3rd Semester', 'btech_ai_sem3_2024_2028'],
    ['B. Tech. (IT) Batch (2024-2028) 3rd Semester', 'btech_it_sem3_2024_2028'],
    ['B. Tech. (EC) Batch (2024-2028) 3rd Semester', 'btech_ece_sem3_2024_2028'],
    [
      'B.Tech. (Civil Engineering) Batch- 2022-2026 (Semester- VII)',
      'btech_ce_sem7_2022_2026',
    ],
    [
      'B.Tech. (Mechanical Engineering) Batch- 2022-2026 (Semester- VII)',
      'btech_me_sem7_2022_2026',
    ],
    [
      'B.Tech. Electrical Engineering. Batch- 2024-2028 (Semester- III)',
      'btech_ee_sem3_2024_2028',
    ],
  ];

  it.each(cases)('names the right programme: %s', (sheetText, expected) => {
    expect(buildCanonicalClassKey(sheetText)).toBe(expected);
  });

  it('does not let one programme match the date sheet of another', () => {
    const civil = buildCanonicalClassKey(
      'B.Tech. (Civil Engineering) Batch- 2022-2026 (Semester- VII)',
    );
    const mechanical = buildCanonicalClassKey(
      'B.Tech. (Mechanical Engineering) Batch- 2022-2026 (Semester- VII)',
    );
    const cyber = buildCanonicalClassKey(
      'B. Tech. (Cyber Security) Batch (2024-2028) 3rd Semester',
    );
    const it = buildCanonicalClassKey(
      'B. Tech. (IT) Batch (2024-2028) 3rd Semester',
    );

    expect(civil).not.toBe(mechanical);
    expect(matchClassKey(civil, mechanical)).toBe(false);
    expect(matchClassKey(cyber, it)).toBe(false);
  });

  it('does not read the year of a cohort as a semester', () => {
    // The School of Law publishes its date sheet with an empty programme
    // column, so the cell holds only "2024-2029". The year range used to be
    // read as "semester 2029", a key no student can ever match.
    expect(buildCanonicalClassKey('2024-2029', undefined, undefined, 'soljg')).toBe(
      'llb_2024_2029',
    );
    expect(buildCanonicalClassKey('2024-2029 III', undefined, undefined, 'soljg')).toBe(
      'llb_sem3_2024_2029',
    );
  });

  it('reads the hyphenated class codes the university actually publishes', () => {
    // "CSE-CS-II" is the Cyber Security section, but the published-section
    // pattern did not allow a hyphen in the code, so the app asked the
    // database for "cse_cs_ii" and showed a sample date sheet instead.
    expect(buildCanonicalClassKey('CSE-CS-II')).toBe('btech_cse_cyber_sem2');
    expect(buildCanonicalClassKey('CSE-DS-III')).toBe('btech_cse_ds_sem3');
    expect(buildCanonicalClassKey('BEC-AI-III')).toBe('btech_ece_sem3');
    expect(buildCanonicalClassKey('MCA-AI-II')).toBe('mca_ai_sem2');
    // The codes without a hyphen still work.
    expect(buildCanonicalClassKey('BCS-III-B')).toBe('btech_cse_sem3_b');
    expect(buildCanonicalClassKey('BAI-III-B')).toBe('btech_ai_sem3_b');
  });

  it('does not re-read a key as prose when reducing it to a base key', () => {
    // A canonical key without a semester is still a key. Feeding
    // "btech_cse_ml" back through the programme rules matched the "b.tech
    // ... cse" rule and produced "btech_cse", so a Machine Learning
    // student was shown the plain CSE date sheet.
    expect(baseClassKeyOf('btech_cse_ml')).toBe('btech_cse_ml');
    expect(baseClassKeyOf('btech_cse_cyber')).toBe('btech_cse_cyber');
    expect(baseClassKeyOf('btech_cse_sem3_2025_2029_b')).toBe('btech_cse_sem3');

    // A date sheet published per programme has no semester in its key, so
    // it has to match a student who DOES know their semester.
    expect(matchClassKey('btech_cse_cyber_sem2', 'btech_cse_cyber')).toBe(true);
    expect(matchClassKey('btech_cse_ml_sem3', 'btech_cse_ml')).toBe(true);
    expect(matchClassKey('btech_cse_sem3', 'btech_cse_cyber')).toBe(false);
  });

  it('matches a student who knows their section to a slot published per programme', () => {
    expect(matchClassKey('btech_cse_cyber_sem3_2024_2028_b', 'btech_cse_cyber_sem3')).toBe(
      true,
    );
  });
});
