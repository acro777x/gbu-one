/**
 * The canonical class key ("section") of the app and the worker.
 *
 * There are exactly two shapes:
 *
 *   canonical : `{programme}_sem{n}[_{batch}][_{section}]`
 *               e.g. `btech_cse_sem3_2025_2029_b`
 *   base      : `{programme}_sem{n}`
 *               e.g. `btech_cse_sem3`
 *
 * The canonical key is the identity of ONE class: the programme, the
 * semester, the cohort (the batch) and the section letter. It is what
 * distinguishes `B.Tech (CSE) Batch (2022-2026)` from `B.Tech (CSE) Batch
 * (2025-2029)`, so it is the part of a date-sheet slot key that keeps two
 * cohorts of the same programme apart.
 *
 * The base key is the filter value of the `exam_date_slots.class_key`
 * column: the database is filtered by programme and semester, because that
 * is the level the university publishes its date sheets on.
 *
 * Everything in this file is data and pure functions only, so `src/lib`
 * never has to import from `src/features`.
 */

/** Normalises a class key for the push-targeting comparison. */
export function normaliseClassKey(raw?: string | null): string {
  return (raw || '').trim().toUpperCase();
}

/** True when the value can be used as a class key for push targeting. */
export function isValidClassKey(raw?: string | null): boolean {
  return normaliseClassKey(raw).length > 0;
}

const ROMAN_MAP: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
};

/**
 * The section codes the university publishes, mapped to the programme slug
 * the worker stores in `class_key`.
 *
 * The app knows the student by the published code (`BAI-III-B`), the worker
 * knows the class by the programme slug (`btech_ai`). Without this table a
 * B.Tech AI student (`BAI`) never matched the stored `btech_ai_sem3` rows and
 * was shown somebody else's date sheet.
 */
export const PROGRAMME_SLUG_BY_CODE: Record<string, string> = {
  BCS: 'btech_cse',
  CS: 'int_btech_mtech_cse',
  BAI: 'btech_ai',
  BEC: 'btech_ece',
  'BEC-AI': 'btech_ece',
  BIT: 'btech_it',
  BCA: 'bca',
  MCA: 'mca',
  'MCA-AI': 'mca_ai',
  'MCA-DS': 'mca_ds',
  MBA: 'mba',
  BCOM: 'bcom',
  BCE: 'btech_ce',
  BEE: 'btech_ee',
  BME: 'btech_me',
  UEL: 'btech_ece',
  URA: 'btech_rai',
  EE: 'btech_ee',
  'CSE-CS': 'btech_cse_cyber',
  'CSE-DS': 'btech_cse_ds',
  'CSE-ML': 'btech_cse_ml',
  UVL: 'btech_vlsi',
  IEC: 'int_btech_mtech_ece',
  PCW: 'mtech_cse',
  'MT-AIR': 'mtech_air',
  'MT-DS': 'mtech_ds',
  'MT-SE': 'mtech_se',
  MTP: 'mtech_power',
  UBT: 'bsc_biotech',
  UFS: 'bsc_forensic',
  BT: 'int_btech_mtech_bt',
  UHS: 'bsc_math',
  BHC: 'bsc_chem',
  BHM: 'bsc_math',
  BHP: 'bsc_physics',
  UES: 'bsc_env',
  UFT: 'btech_food',
  UMC: 'btech_math_comp',
  MAC: 'msc_chem',
  MAM: 'msc_math',
  MAP: 'msc_physics',
  MES: 'msc_env',
  MFS: 'msc_fs',
  MOR: 'msc_microbiology',
  MTF: 'mtech_food',
  MTB2: 'mtech_biotech',
  MBT: 'msc_biotech',
  MBT1: 'msc_biotech_1yr',
  MSMB: 'msc_microbiology',
  MLFS: 'msc_life_sciences',
  NMT: 'msc_nuclear_medicine',
  BAEC: 'ba_economics',
  MEN: 'ma_english',
  UHB: 'bsc_psychology',
  IAY: 'bsc_ayurveda',
  IAYBS: 'bsc_ayurveda',
  PhDCS: 'phd_cs',
};

/** Programme names that mean the same thing on both sides. */
const PROGRAMME_ALIASES: Record<string, string> = {
  bcs: 'btech_cse',
  btech_cs: 'btech_cse',
  btech_cse: 'btech_cse',
  cs: 'int_btech_mtech_cse',
  int_btech_mtech_cse: 'int_btech_mtech_cse',
  bai: 'btech_ai',
  btech_ai: 'btech_ai',
  bec: 'btech_ece',
  btech_ece: 'btech_ece',
  bit: 'btech_it',
  btech_it: 'btech_it',
  bca: 'bca',
  mca: 'mca',
  mca_ai: 'mca_ai',
  mba: 'mba',
  bcom: 'bcom',
  bme: 'btech_me',
  btech_me: 'btech_me',
  bce: 'btech_ce',
  btech_ce: 'btech_ce',
  bee: 'btech_ee',
  btech_ee: 'btech_ee',
  bsc: 'bsc',
  msc: 'msc',
  ballb: 'ballb',
  bballb: 'bballb',
  llm: 'llm',
};

/** The parts of a class key. */
export interface ClassKeyParts {
  /** The canonical programme slug, e.g. `btech_cse`. */
  programme: string;
  /** The semester number, or null when the text does not say. */
  semester: number | null;
  /** The batch the cohort belongs to, e.g. `2025_2029`. */
  batch?: string;
  /** The section letter, e.g. `B`. */
  section?: string;
}

/**
 * A published section code: `BCS-III-B`, `BCS-II A`, `MBA II`,
 * `Ph.D. Biotechnology` (which has no year at all).
 */
const PUBLISHED_SECTION_RE =
  /^([A-Za-z][A-Za-z0-9.&]*?)[-\s]+([IVX]{1,5})(?:[-\s]+([A-Za-z]))?$/;

/**
 * The batch a cohort belongs to, e.g. `Batch (2025-2029)`.
 *
 * The university is not consistent: the date sheets print `Batch -2025-2030`
 * while the prospectus prints `Batch (2025-2029)`, so the separator between
 * the word and the first year is optional.
 */
const BATCH_RE = /batch\s*[-–—:]?\s*\(?\s*(\d{4})\s*[-–—]\s*(\d{4})\s*\)?/i;

/**
 * A bare year range, e.g. `2022-2026`, used when the text names the cohort
 * without the word "batch". The span has to look like a course length, so a
 * session range (`2026-2027`) is never mistaken for a cohort.
 */
const BARE_BATCH_RE = /(?:^|[^\d])(\d{4})\s*[-–—]\s*(\d{4})(?!\d)/;

/** Normalises a programme slug: lower case, `[a-z0-9_]` only. */
function normaliseProgramme(value?: string | null): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Normalises a batch to `YYYY_YYYY`, e.g. `2025-2029` -> `2025_2029`.
 */
function normaliseBatch(value?: string | null): string | undefined {
  const raw = (value || '').trim().toLowerCase();
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || undefined;
}

/** Normalises a section letter to a lower case slug, e.g. `B` -> `b`. */
function normaliseSection(value?: string | null): string | undefined {
  const raw = (value || '').trim().toLowerCase();
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || undefined;
}

/**
 * The programme of a key, with the aliases folded in, so `bcs` and
 * `btech_cse` name the same programme.
 */
function aliasProgramme(value?: string | null): string {
  const programme = normaliseProgramme(value);
  if (!programme) return '';
  return (
    PROGRAMME_ALIASES[programme] ??
    PROGRAMME_SLUG_BY_CODE[programme.toUpperCase()] ??
    programme
  );
}

/**
 * Reads the cohort a programme text names, e.g. `Batch (2025-2029)` or
 * `Batch -2025-2030`.
 */
function extractBatch(text: string): string | undefined {
  const named = BATCH_RE.exec(text);
  if (named) return `${named[1]}_${named[2]}`;

  const bare = BARE_BATCH_RE.exec(text);
  if (bare) {
    const start = Number(bare[1]);
    const end = Number(bare[2]);
    const span = end - start;
    // A cohort runs for two to six years; anything else is a session or a
    // year range that has nothing to do with the class.
    if (span >= 2 && span <= 6) return `${bare[1]}_${bare[2]}`;
  }
  return undefined;
}

/**
 * Builds the canonical class key out of its parts.
 *
 * This is the ONE place the canonical key is built. Everything else - the
 * parser, the worker, the app - goes through it, so two cohorts of one
 * programme can never end up with the same key.
 */
export function canonicalClassKeyOf(parts: ClassKeyParts): string {
  // An empty programme would produce a malformed key like "_sem1", so the
  // last-resort name is used instead. It is only reached when the text
  // carries no programme at all AND the school is unknown.
  const programme = normaliseProgramme(parts.programme) || 'general';
  const base =
    parts.semester !== null && parts.semester !== undefined
      ? `${programme}_sem${parts.semester}`
      : programme;
  const batch = normaliseBatch(parts.batch);
  const section = normaliseSection(parts.section);
  return [base, batch, section].filter(Boolean).join('_');
}

/**
 * Builds the base class key out of its parts: the programme and the
 * semester, without the batch and the section.
 */
function baseClassKeyOfParts(parts: ClassKeyParts): string {
  const programme = normaliseProgramme(parts.programme);
  return parts.semester !== null && parts.semester !== undefined
    ? `${programme}_sem${parts.semester}`
    : programme;
}

/**
 * Splits a class key into its parts.
 *
 * The canonical form is `<programme>_sem<n>[_<batch>][_<section>]`, e.g.
 * `btech_cse_sem3_2025_2029_b`. The base form (`btech_cse_sem3`) is the one
 * the worker stores in `class_key`.
 */
export function parseCanonicalClassKey(rawKey: string): ClassKeyParts {
  const key = (rawKey ?? '').trim().toLowerCase();
  const match = /^(.+?)_sem(\d+)(?:_(.+))?$/.exec(key);
  if (!match) {
    return { programme: normaliseProgramme(key), semester: null };
  }
  const programme = normaliseProgramme(match[1]);
  const semester = Number.parseInt(match[2], 10);
  const rest = (match[3] ?? '').split('_').filter(Boolean);

  let batch: string | undefined;
  let section: string | undefined;
  if (rest.length >= 2 && /^\d{4}$/.test(rest[0]) && /^\d{4}$/.test(rest[1])) {
    batch = `${rest[0]}_${rest[1]}`;
    if (rest.length > 2 && /^[a-z]$/.test(rest[2])) section = rest[2].toUpperCase();
  } else if (rest.length === 1 && /^[a-z]$/.test(rest[0])) {
    section = rest[0].toUpperCase();
  } else if (rest.length > 0) {
    batch = rest.join('_');
  }

  return {
    programme,
    semester: Number.isFinite(semester) ? semester : null,
    ...(batch ? { batch } : {}),
    ...(section ? { section } : {}),
  };
}

/**
 * The base of a class key: the programme and the semester without the batch
 * and the section. This is the value the worker stores in `class_key`, so it
 * is also what the database can be filtered on.
 */
export function baseClassKeyOf(rawKey: string): string {
  const key = (rawKey ?? '').trim();
  const parts = parseCanonicalClassKey(key);
  if (parts.semester !== null) return baseClassKeyOfParts(parts);
  // The key is not in the canonical shape (a published section code such as
  // `BCS-III-B`, or a programme name), so it is read as text.
  return baseClassKeyOfParts(parseClassKeyParts(key));
}

/**
 * Reads the programme, the semester, the batch and the section out of a
 * programme text or a published section code.
 */
export function parseClassKeyParts(
  programmeText: string,
  explicitSemester?: string | number | null,
): ClassKeyParts {
  const raw = (programmeText ?? '').trim();
  const text = raw.toLowerCase();

  // The batch a cohort belongs to, e.g. `2025-2029`.
  const batch = extractBatch(raw);

  // 1. Determine semester number
  let semNumber: number | null = null;
  if (explicitSemester !== undefined && explicitSemester !== null) {
    const semStr = String(explicitSemester).trim().toLowerCase();
    const num = parseInt(semStr.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      semNumber = num;
    } else if (ROMAN_MAP[semStr]) {
      semNumber = ROMAN_MAP[semStr];
    }
  }

  // 2. A published section code (`BAI-III-B`) names the programme exactly.
  const published = PUBLISHED_SECTION_RE.exec(raw);
  let progSlug = '';
  let section: string | undefined;

  if (published) {
    const code = published[1].toUpperCase();
    const year = published[2].toUpperCase();
    const letter = published[3]?.toUpperCase();
    progSlug = PROGRAMME_SLUG_BY_CODE[code] ?? '';
    if (!progSlug) {
      progSlug = normaliseProgramme(code);
    }
    if (letter) section = letter;
    if (semNumber === null && ROMAN_MAP[year]) {
      semNumber = ROMAN_MAP[year];
    }
  }

  if (!progSlug) {
    // 3. Determine programme prefix from a full programme name.
    if (/int(?:egrated)?\s*\.?\s*b\.?\s*tech.*m\.?\s*tech.*cse/i.test(text)) {
      progSlug = 'int_btech_mtech_cse';
    } else if (/b\.?\s*tech.*ai/i.test(text) || /\b(cai)\b/i.test(text)) {
      progSlug = 'btech_ai';
    } else if (/b\.?\s*tech.*(?:it|inf(?:ormation)?\s*tech)/i.test(text)) {
      progSlug = 'btech_it';
    } else if (/b\.?\s*tech.*(?:cse|cs|comp)/i.test(text) || /\bbcs\b/i.test(text)) {
      progSlug = 'btech_cse';
    } else if (/b\.?\s*tech.*ece/i.test(text)) {
      progSlug = 'btech_ece';
    } else if (/b\.?\s*tech.*ee/i.test(text)) {
      progSlug = 'btech_ee';
    } else if (/b\.?\s*tech.*me/i.test(text)) {
      progSlug = 'btech_me';
    } else if (/b\.?\s*tech.*civil/i.test(text)) {
      progSlug = 'btech_ce';
    } else if (/b\.?\s*tech.*biotech/i.test(text)) {
      progSlug = 'btech_bt';
    } else if (/mca.*ai/i.test(text)) {
      progSlug = 'mca_ai';
    } else if (/\bmca\b/i.test(text)) {
      progSlug = 'mca';
    } else if (/\bbca\b/i.test(text)) {
      progSlug = 'bca';
    } else if (/\bmba\b/i.test(text)) {
      progSlug = 'mba';
    } else if (/\bbba\b/i.test(text)) {
      progSlug = 'bba';
    } else if (/ba\s*ll\.?b/i.test(text)) {
      progSlug = 'ballb';
    } else if (/bba\s*ll\.?b/i.test(text)) {
      progSlug = 'bballb';
    } else if (/\bll\.?m/i.test(text)) {
      progSlug = 'llm';
    } else if (/b\.?\s*arch/i.test(text)) {
      progSlug = 'barch';
    } else if (/b\.?\s*des/i.test(text)) {
      progSlug = 'bdes';
    } else if (/m\.?\s*tech.*cse/i.test(text)) {
      progSlug = 'mtech_cse';
    } else if (/m\.?\s*tech.*ai/i.test(text)) {
      progSlug = 'mtech_ai';
    } else if (/m\.?\s*tech/i.test(text)) {
      progSlug = 'mtech';
    } else if (/m\.?\s*sc/i.test(text)) {
      progSlug = 'msc';
    } else if (/b\.?\s*sc/i.test(text)) {
      progSlug = 'bsc';
    } else if (/buddhist\s*(studies|civilization)/i.test(text)) {
      // The School of Basic Science publishes its date sheet under the
      // programme name ("M.A. in Buddhist Studies & Civilization (Batch-...)
      // Semester- I"). Verified against the live sheet on 2026-11-13.
      if (/ph\.?\s*d|doctor/i.test(text)) {
        progSlug = 'phd_buddhist_studies';
      } else if (/m\.?\s*a\b|master/i.test(text)) {
        progSlug = 'ma_buddhist_studies';
      } else if (/hons/i.test(text)) {
        progSlug = 'ba_hons_buddhist_studies';
      } else {
        progSlug = 'buddhist_studies';
      }
    } else if (/\bll\.?b\b|legal/i.test(text)) {
      // The School of Law publishes its date sheet with an EMPTY programme
      // column (the cell holds only "2024-2029 II"), so the programme has to
      // be recognised from the school rather than from the text.
      progSlug = 'llb';
    } else {
      progSlug = normaliseProgramme(text.split(/batch|sem|\d{4}/i)[0]);
    }
  }

  if (semNumber === null) {
    const semMatch =
      text.match(/(\d+)(?:st|nd|rd|th)?\s*(?:sem|semester)/i) ||
      text.match(/(?:sem|semester)\s*[-:_]?\s*(\d+|[ivx]+)/i) ||
      text.match(/(?:_|-|\s)(\d+)$/) ||
      text.match(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/i);

    if (semMatch) {
      const raw2 = semMatch[1].toLowerCase();
      semNumber = ROMAN_MAP[raw2] || parseInt(raw2, 10) || null;
    }
  }

  return {
    programme: progSlug,
    semester: semNumber,
    ...(batch ? { batch } : {}),
    ...(section ? { section } : {}),
  };
}

/**
 * Builds the base class key the database stores in `class_key`: the
 * programme and the semester, e.g. `btech_cse_sem3`.
 *
 * The batch and the section are deliberately left out: the worker writes
 * this value, and the app has to be able to find the rows it wrote.
 */
export function buildClassKey(
  programmeText: string,
  explicitSemester?: string | number | null,
): string {
  return baseClassKeyOfParts(parseClassKeyParts(programmeText, explicitSemester));
}

/**
 * Builds the full identity of a class: the programme, the semester, the
 * batch and the section, e.g. `btech_cse_sem3_2025_2029_b`.
 *
 * This is the key the app uses to tell two cohorts of the same programme
 * apart. The base key (`buildClassKey`) stays the value the database is
 * filtered on.
 *
 * An override of `null` (or an empty string) removes the part, an override
 * of a value replaces it, and an absent override keeps what the text said.
 */
export function buildCanonicalClassKey(
  programmeText: string,
  explicitSemester?: string | number | null,
  overrides?: { batch?: string | null; section?: string | null },
  schoolCode?: string | null,
): string {
  const parts = parseClassKeyParts(programmeText, explicitSemester);
  const batch =
    overrides && 'batch' in overrides
      ? normaliseBatch(overrides.batch)
      : parts.batch;
  const section =
    overrides && 'section' in overrides
      ? normaliseSection(overrides.section)
      : parts.section;
  // A date sheet whose programme column is EMPTY (the School of Law
  // publishes only "2024-2029 II" in that cell) would otherwise produce the
  // key "general_sem3", which collides with every other school that does
  // the same. The school is the only thing that identifies the programme.
  const programme = parts.programme || slugForSchool(schoolCode);
  return canonicalClassKeyOf({
    programme,
    semester: parts.semester,
    ...(batch ? { batch } : {}),
    ...(section ? { section } : {}),
  });
}

/**
 * The programme of a school that publishes one programme, used when the
 * date sheet's programme column is empty.
 *
 * Verified against the live sheets on 2026-11-13: the School of Law
 * (`soljg`) publishes "2024-2029 II" with no programme name, and the School
 * of Basic Science (`sobsc`) publishes the Buddhist Studies programmes.
 */
export const PROGRAMME_SLUG_BY_SCHOOL: Record<string, string> = {
  soljg: 'llb',
  sol: 'llb',
  sobsc: 'buddhist_studies',
};

export function slugForSchool(schoolCode?: string | null): string {
  const code = (schoolCode ?? '').trim().toLowerCase();
  return PROGRAMME_SLUG_BY_SCHOOL[code] ?? '';
}

/**
 * The canonical key and the base key of one class.
 *
 * The worker writes the base key into `exam_date_slots.class_key` (the
 * column the app filters on) and the canonical key into `slot_key` (the
 * unique key of the row), so two cohorts of one programme are two rows.
 */
export function resolveClassKeys(
  programmeText: string,
  explicitSemester?: string | number | null,
): { canonical: string; base: string } {
  const canonical = buildCanonicalClassKey(programmeText, explicitSemester);
  return { canonical, base: baseClassKeyOf(canonical) };
}

/**
 * Reads a class key into its parts, whether it is written in the canonical
 * form (`btech_cse_sem3_2025_2029_b`) or as the published section code the
 * student picked (`BCS-III-B`).
 */
function describeClassKey(rawKey: string): ClassKeyParts {
  const text = (rawKey ?? '').trim();
  const canonical = parseCanonicalClassKey(text.toLowerCase().replace(/[\s-]+/g, '_'));
  if (canonical.semester !== null) return canonical;
  // Not in the canonical shape: it is a published section code or a
  // programme name, so it is read as text. The batch is still taken from
  // the canonical reading, because a published code never names one.
  const parsed = parseClassKeyParts(text);
  return {
    programme: parsed.programme,
    semester: parsed.semester,
    ...(parsed.batch ? { batch: parsed.batch } : {}),
    ...(canonical.batch ? { batch: canonical.batch } : {}),
    ...(parsed.section ? { section: parsed.section } : {}),
    ...(canonical.section ? { section: canonical.section } : {}),
  };
}

/**
 * Checks whether a student's class selection matches a date slot's class key.
 *
 * The comparison is deliberately forgiving: a slot that only knows the
 * programme (`btech_cse_sem3`) matches a student who also knows their
 * section (`btech_cse_sem3_b`), because the date sheet is published per
 * programme. Two keys that both name a batch or a section have to agree on
 * it: `2022_2026` is never `2025_2029`, and section `A` is never `B`.
 */
export function matchClassKey(studentKey?: string | null, slotKey?: string | null): boolean {
  if (!studentKey || !slotKey) return false;
  const sNorm = studentKey.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const dNorm = slotKey.trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (sNorm === dNorm) return true;

  const sParts = describeClassKey(studentKey);
  const dParts = describeClassKey(slotKey);

  // The programme of a key is read through the alias table, so `bcs_sem3`
  // and `btech_cse_sem3` name the same programme.
  const sProgramme = aliasProgramme(sParts.programme);
  const dProgramme = aliasProgramme(dParts.programme);
  if (!sProgramme || !dProgramme) return false;
  if (sProgramme !== dProgramme) return false;

  if (
    sParts.semester !== null &&
    dParts.semester !== null &&
    sParts.semester !== dParts.semester
  ) {
    return false;
  }
  if (sParts.batch && dParts.batch && sParts.batch !== dParts.batch) return false;
  if (sParts.section && dParts.section && sParts.section !== dParts.section) return false;
  return true;
}

/**
 * Deterministic slot key for database idempotency.
 *
 * The class key is part of the key on purpose and it is always there: two
 * cohorts of the same programme (`Batch 2022-2026` and `Batch 2025-2029`)
 * sit in different semesters and must never share a slot. The key that
 * goes in is the CANONICAL class key, because the base key does not name
 * the cohort.
 */
export function dateSlotKey(
  schoolCode: string,
  examDate: string,
  slot: string,
  subjectCode: string,
  subjectName: string,
  classKey: string,
): string {
  const parts = ['datesheet', schoolCode, classKey, examDate, slot, subjectCode, subjectName];
  return parts
    .join(':')
    .toLowerCase()
    .replace(/\s+/g, '-');
}
