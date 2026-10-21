/**
 * GBU One - the live class catalogue.
 *
 * The university publishes its sections in the timetable API itself, and the
 * codes change between sessions (`BCS-II A` in one year, `BCS-III-A` in the
 * next). Hard-coding a programme list in the app means the stored class key
 * drifts out of sync and the student sees an empty timetable.
 *
 * So the catalogue is derived from the live data: the provider lists the
 * sections the university currently runs, and the class picker is built from
 * those. The bundled list is only the offline fallback.
 *
 * The published codes are not consistent:
 *   - second year uses a space  -> `BCS-II A`
 *   - other years use a dash    -> `BCS-III-A`
 *   - other programmes use their own shapes -> `MBA II`, `BCA-I A`,
 *     `MT-AIR-II-A`, `Ph.D. Biotechnology`
 * The parser below therefore reads the code the university publishes instead
 * of reconstructing one, and the app stores that exact string.
 */
import {
  lookupProgramme,
  parseGBUClassCode,
  type ClassRef,
} from './timetableProvider';

export interface CatalogueProgramme {
  /** The prefix the university publishes in the section code, e.g. `BCS`. */
  code: string;
  /** The readable name, e.g. `B.Tech (CS)`. */
  name: string;
  /** The school, e.g. `SOICT`. */
  school: string;
  /** The department, e.g. `CSE`. */
  dept: string;
  /** The university's own programme code, e.g. `CSE-Cyber` for `CSE-CS-I`. */
  apiCode: string;
}

export interface CatalogueSection {
  /** The exact section code the API publishes, e.g. `BCS-II B`. */
  section: string;
  /** The school. */
  school: string;
  /** The readable programme name. */
  programme: string;
  /** The published programme prefix, e.g. `BCS`. */
  programmeCode: string;
  /** The year as the university writes it, e.g. `II`. */
  year: string;
  /** The section letter, e.g. `B`. */
  sectionLetter: string;
}

/** The parts of a published section code. */
export interface PublishedSectionParts {
  /** The published programme prefix, e.g. `BCS` or `CSE-CS`. */
  programmeCode: string;
  /** The year as the university writes it, e.g. `II`. Empty when it has none. */
  year: string;
  /** The section letter, e.g. `B`. `General` when the batch has one section. */
  sectionLetter: string;
}

/** A row of the live class list, as the provider returns it. */
export type CatalogueSource = Pick<ClassRef, 'section'> &
  Partial<Pick<ClassRef, 'school' | 'programme' | 'programmeCode'>>;

const ROMAN_BY_NUMBER: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
};

const YEAR_LABELS: Record<string, string> = {
  I: '1st Year',
  II: '2nd Year',
  III: '3rd Year',
  IV: '4th Year',
  V: '5th Year',
  VI: '6th Year',
  VII: '7th Year',
  VIII: '8th Year',
};

const ROMAN_VALUES: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
};

/**
 * The offline fallback: the classes the university published when the
 * catalogue was last refreshed. It is only used when the live list cannot be
 * reached, and the app says so when it falls back to it.
 */
export const FALLBACK_CATALOGUE: Array<{
  code: string;
  apiCode: string;
  name: string;
  school: string;
  sections: string[];
}> = [
  {
    code: 'UBT',
    apiCode: 'UBT',
    name: 'B.Sc. (H) in Biotechnology with Research',
    school: 'SOBT',
    sections: ['UBT-I-A', 'UBT-I-B', 'UBT-II', 'UBT-III', 'UBT-IV'],
  },
  {
    code: 'UFS',
    apiCode: 'UFS',
    name: 'B.Sc. Forensic Science',
    school: 'SOBT',
    sections: ['UFS-I', 'UFS-II', 'UFS-III'],
  },
  {
    code: 'IAY',
    apiCode: 'IBTAB',
    name: 'BSc MSc Ayurveda Biology',
    school: 'SOBT',
    sections: ['IAY-I'],
  },
  {
    code: 'IAYBS',
    apiCode: 'IBTAB',
    name: 'BSc MSc Ayurveda Biology',
    school: 'SOBT',
    sections: ['IAYBS-II'],
  },
  {
    code: 'BT',
    apiCode: 'BT',
    name: 'Int. B.Tech.+M.Tech./M.B.A.-Biotech.',
    school: 'SOBT',
    sections: ['BT-I', 'BT-II', 'BT-III', 'BT-IV', 'BT-V'],
  },
  {
    code: 'MTB2',
    apiCode: 'MTB',
    name: 'M. Tech. (Biotechnology)',
    school: 'SOBT',
    sections: ['MTB2-I', 'MTB2-II'],
  },
  {
    code: 'MBT',
    apiCode: 'MBT',
    name: 'M.Sc. Biotechnology',
    school: 'SOBT',
    sections: ['MBT-I', 'MBT-II'],
  },
  {
    code: 'MBT1',
    apiCode: 'MBTR',
    name: 'MSc Biotechnology (1Yr)',
    school: 'SOBT',
    sections: ['MBT1-I'],
  },
  {
    code: 'MSMB',
    apiCode: 'MSMB',
    name: 'MSc Microbiology',
    school: 'SOBT',
    sections: ['MSMB-I', 'MSMB-II'],
  },
  {
    code: 'MLFS',
    apiCode: 'MSLS',
    name: 'MSc-Life Sciences',
    school: 'SOBT',
    sections: ['MLFS-I', 'MLFS-II'],
  },
  {
    code: 'NMT',
    apiCode: 'NMT',
    name: 'MSc. Nuclear Medicine Technology',
    school: 'SOBT',
    sections: ['NMT-I'],
  },
  {
    code: 'Ph.D. Biotechnology',
    apiCode: 'PhDBT',
    name: 'Ph.D. Biotechnology',
    school: 'SOBT',
    sections: ['Ph.D. Biotechnology'],
  },
  {
    code: 'BCE',
    apiCode: 'BEE',
    name: 'B.Tech (CE)',
    school: 'SOE',
    sections: ['BCE-I'],
  },
  {
    code: 'BEE',
    apiCode: 'BEE',
    name: 'B.Tech (Electrical Engineering)',
    school: 'SOE',
    sections: ['BEE-I', 'BEE-II', 'BEE-III', 'BEE-IV'],
  },
  {
    code: 'BME',
    apiCode: 'BME',
    name: 'B.Tech (ME)',
    school: 'SOE',
    sections: ['BME-I', 'BME-II', 'BME-III', 'BME-IV'],
  },
  {
    code: 'UEL',
    apiCode: 'UEL',
    name: 'B.Tech. (Electrical and Computer Engineering)',
    school: 'SOE',
    sections: ['UEL-II', 'UEL-III', 'UEL-IV'],
  },
  {
    code: 'URA',
    apiCode: 'URA',
    name: 'B.Tech. (Robotics and Artificial Intelligence)',
    school: 'SOE',
    sections: ['URA-II', 'URA-III'],
  },
  {
    code: 'EE',
    apiCode: 'EE',
    name: 'B.Tech.+M.Tech./M.B.A. (EE)',
    school: 'SOE',
    sections: ['EE-IV'],
  },
  {
    code: 'MTP',
    apiCode: 'MTP',
    name: 'M.Tech (Power System)',
    school: 'SOE',
    sections: ['MTP-I', 'MTP-II'],
  },
  {
    code: 'UHB',
    apiCode: 'UHB',
    name: 'B. Sc. Applied Psychology',
    school: 'SOHSS',
    sections: ['UHB-I'],
  },
  {
    code: 'BAEC',
    apiCode: 'BAEC',
    name: 'B.A. (H) Economics',
    school: 'SOHSS',
    sections: ['BAEC-I', 'BAEC-III'],
  },
  {
    code: 'MEN',
    apiCode: 'MEN',
    name: 'M.A. (English)',
    school: 'SOHSS',
    sections: ['MEN-I', 'MEN-II'],
  },
  {
    code: 'BCA',
    apiCode: 'BCA',
    name: 'B.C.A.',
    school: 'SOICT',
    sections: ['BCA-I A', 'BCA-II-A', 'BCA-II-B', 'BCA-III'],
  },
  {
    code: 'BCS',
    apiCode: 'BCS',
    name: 'B.Tech (CS)',
    school: 'SOICT',
    sections: [
      'BCS-I-A',
      'BCS-I-B',
      'BCS-I-C',
      'BCS-II A',
      'BCS-II B',
      'BCS-II C',
      'BCS-II D',
      'BCS-III-A',
      'BCS-III-B',
      'BCS-III-C',
      'BCS-III-D',
      'BCS-IV-A',
      'BCS-IV-B',
    ],
  },
  {
    code: 'BEC',
    apiCode: 'BEC',
    name: 'B.Tech (EC)',
    school: 'SOICT',
    sections: ['BEC-I', 'BEC-II', 'BEC-III', 'BEC-IV-A'],
  },
  {
    code: 'BIT',
    apiCode: 'BIT',
    name: 'B.Tech (IT)',
    school: 'SOICT',
    sections: ['BIT-I', 'BIT-II', 'BIT-III', 'BIT-IV'],
  },
  {
    code: 'BEC-AI',
    apiCode: 'BEC-AIML',
    name: 'B.Tech ECE AI&ML',
    school: 'SOICT',
    sections: ['BEC-AI-III', 'BEC-AI-IV'],
  },
  {
    code: 'BAI',
    apiCode: 'BAI',
    name: 'B.Tech. (Artificial Intelligence)',
    school: 'SOICT',
    sections: ['BAI-I-A', 'BAI-I-B', 'BAI-II', 'BAI-II-B', 'BAI-III', 'BAI-III-B', 'BAI-IV'],
  },
  {
    code: 'CSE-CS',
    apiCode: 'CSE-Cyber',
    name: 'B.Tech. CSE Cyber Security',
    school: 'SOICT',
    sections: ['CSE-CS-I', 'CSE-CS-II', 'CSE-CS-III', 'CSE-CS-IV'],
  },
  {
    code: 'CSE-DS',
    apiCode: 'CSE-DS',
    name: 'B.Tech. CSE Data Science',
    school: 'SOICT',
    sections: ['CSE-DS-I', 'CSE-DS-II', 'CSE-DS-III', 'CSE-DS-IV'],
  },
  {
    code: 'CSE-ML',
    apiCode: 'CSE-ML',
    name: 'B.Tech. CSE Machine Learning',
    school: 'SOICT',
    sections: ['CSE-ML-III', 'CSE-ML-IV'],
  },
  {
    code: 'UVL',
    apiCode: 'PVD',
    name: 'B.Tech. EC VLSI',
    school: 'SOICT',
    sections: ['UVL-III'],
  },
  {
    code: 'CS',
    apiCode: 'ICS',
    name: 'B.Tech.-M.Tech. (CS)',
    school: 'SOICT',
    sections: ['CS-I-A', 'CS-II-A', 'CS-III-A', 'CS-IV-A'],
  },
  {
    code: 'IEC',
    apiCode: 'EC',
    name: 'B.Tech.-M.Tech. (EC)',
    school: 'SOICT',
    sections: ['IEC-IX'],
  },
  {
    code: 'PCW',
    apiCode: 'PCW',
    name: 'M.Tech (CSE) Weekend',
    school: 'SOICT',
    sections: ['PCW-II'],
  },
  {
    code: 'MT-AIR',
    apiCode: 'MTA',
    name: 'M.Tech. (AIR)',
    school: 'SOICT',
    sections: ['MT-AIR-I', 'MT-AIR-II-A'],
  },
  {
    code: 'MT-DS',
    apiCode: 'MDS',
    name: 'M.Tech. (DS)',
    school: 'SOICT',
    sections: ['MT-DS-I', 'MT-DS-II'],
  },
  {
    code: 'MT-SE',
    apiCode: 'MTS',
    name: 'M.Tech. (SE)',
    school: 'SOICT',
    sections: ['MT-SE-I', 'MT-SE-II'],
  },
  {
    code: 'MCA-AI',
    apiCode: 'MCA',
    name: 'MCA',
    school: 'SOICT',
    sections: ['MCA-AI-I', 'MCA-AI-II'],
  },
  {
    code: 'MCA-DS',
    apiCode: 'MCA',
    name: 'MCA',
    school: 'SOICT',
    sections: ['MCA-DS-I', 'MCA-DS-II'],
  },
  {
    code: 'PhDCS',
    apiCode: 'PhDCS',
    name: 'Ph.D. Computer Science and Engineering',
    school: 'SOICT',
    sections: ['PhDCS-I'],
  },
  {
    code: 'BCOM',
    apiCode: 'BCOM',
    name: 'B.Com. (Hons)',
    school: 'SOM',
    sections: ['BCOM-I-A', 'BCOM-I-B', 'BCOM-I-C'],
  },
  {
    code: 'MBA',
    apiCode: 'MBA',
    name: 'MBA',
    school: 'SOM',
    sections: ['MBA-I-A', 'MBA II'],
  },
  {
    code: 'UHS',
    apiCode: 'UHS',
    name: 'B.Sc. (H) (Mathematics, Statistics, Economics)',
    school: 'SOVSAS',
    sections: ['UHS-I', 'UHS-II'],
  },
  {
    code: 'BHC',
    apiCode: 'BHC',
    name: 'B.Sc. (H) Chemistry',
    school: 'SOVSAS',
    sections: ['BHC-I', 'BHC-II', 'BHC-III', 'BHC-IV'],
  },
  {
    code: 'BHM',
    apiCode: 'BHM',
    name: 'B.Sc. (H) Mathematics',
    school: 'SOVSAS',
    sections: ['BHM-I', 'BHM-II', 'BHM-III', 'BHM-IV'],
  },
  {
    code: 'BHP',
    apiCode: 'BHP',
    name: 'B.Sc. (H) Physics',
    school: 'SOVSAS',
    sections: ['BHP-I', 'BHP-II', 'BHP-III', 'BHP-IV'],
  },
  {
    code: 'UES',
    apiCode: 'UES',
    name: 'B.Sc. Environment Science',
    school: 'SOVSAS',
    sections: ['UES-I', 'UES-II', 'UES-III'],
  },
  {
    code: 'UFT',
    apiCode: 'UFT',
    name: 'B.Tech. (Food Processing Technology)',
    school: 'SOVSAS',
    sections: ['UFT-I', 'UFT-II', 'UFT-III', 'UFT-IV'],
  },
  {
    code: 'UMC',
    apiCode: 'UMC',
    name: 'B.Tech. (Mathematics and Comuting)',
    school: 'SOVSAS',
    sections: ['UMC-I', 'UMC-II'],
  },
  {
    code: 'MAC',
    apiCode: 'MAC',
    name: 'M.Sc. (Applied Chemistry)',
    school: 'SOVSAS',
    sections: ['MAC-I', 'MAC-II'],
  },
  {
    code: 'MAM',
    apiCode: 'MAM',
    name: 'M.Sc. (Applied Mathematics)',
    school: 'SOVSAS',
    sections: ['MAM-I', 'MAM-II'],
  },
  {
    code: 'MAP',
    apiCode: 'MAP',
    name: 'M.Sc. (Applied Physics)',
    school: 'SOVSAS',
    sections: ['MAP-I', 'MAP-II'],
  },
  {
    code: 'MES',
    apiCode: 'MES',
    name: 'M.Sc. (Environmental Science)',
    school: 'SOVSAS',
    sections: ['MES-I', 'MES-II'],
  },
  {
    code: 'MFS',
    apiCode: 'MFS',
    name: 'M.Sc. (Food Science)',
    school: 'SOVSAS',
    sections: ['MFS-I', 'MFS-II'],
  },
  {
    code: 'MOR',
    apiCode: 'MOR',
    name: 'M.Sc. in Operations Research and Computer Applications',
    school: 'SOVSAS',
    sections: ['MOR-I'],
  },
  {
    code: 'MTF',
    apiCode: 'MTF',
    name: 'M.Tech. (Food Technology)',
    school: 'SOVSAS',
    sections: ['MTF-I', 'MTF-II'],
  },
];

const API_CODE_BY_PREFIX: Record<string, string> = FALLBACK_CATALOGUE.reduce(
  (acc, programme) => {
    acc[programme.code.toUpperCase()] = programme.apiCode;
    return acc;
  },
  {} as Record<string, string>,
);

/** The numeric value of a roman year, e.g. `IV` -> 4. */
function yearValue(year: string): number {
  return ROMAN_VALUES[(year || '').trim().toUpperCase()] ?? 0;
}

/**
 * Normalises a year label so `2nd Year`, `II` and `Year 2` all compare equal.
 */
export function normaliseYearLabel(value: string): string {
  const raw = (value || '').trim().toLowerCase();
  if (!raw) return '';

  const words: Record<string, string> = {
    first: 'I',
    second: 'II',
    third: 'III',
    fourth: 'IV',
    fifth: 'V',
    sixth: 'VI',
    seventh: 'VII',
    eighth: 'VIII',
  };
  if (words[raw]) return words[raw];

  const ordinal = raw.match(/\b([1-8])(?:st|nd|rd|th)\b/);
  if (ordinal) return ROMAN_BY_NUMBER[Number(ordinal[1])];

  const yearDigit = raw.match(/\byear\s*([1-8])\b/);
  if (yearDigit) return ROMAN_BY_NUMBER[Number(yearDigit[1])];

  const roman = raw.match(/\b([ivx]{1,5})\b/);
  if (roman) return roman[1].toUpperCase();

  const digit = raw.match(/\b([1-8])\b/);
  if (digit) return ROMAN_BY_NUMBER[Number(digit[1])];

  return raw.toUpperCase();
}

/** The readable label of a year, e.g. `II` -> `2nd Year`. */
export function yearLabelOf(year: string): string {
  const normalised = normaliseYearLabel(year);
  if (!normalised) return '';
  return YEAR_LABELS[normalised] ?? `${normalised} Year`;
}

/**
 * Splits a published section code into programme, year and section letter.
 *
 * The separator is whatever the university used, so `BCS-II B`, `BCS-III-A`,
 * `BCA-I A`, `MBA II` and `MT-AIR-II-A` all parse, and a code with no year
 * (`Ph.D. Biotechnology`) keeps its whole text as the programme.
 */
export function parsePublishedSection(section: string): PublishedSectionParts {
  const raw = (section || '').trim();
  if (!raw) return { programmeCode: '', year: '', sectionLetter: 'General' };

  const tokens = raw.split(/[\s-]+/).filter(Boolean);
  const upper = tokens.map((token) => token.toUpperCase());

  let yearIndex = -1;
  for (let i = upper.length - 1; i >= 0; i -= 1) {
    if (!/^[IVX]{1,5}$/.test(upper[i])) continue;
    const trailing = upper.slice(i + 1);
    if (trailing.length === 0 || (trailing.length === 1 && /^[A-Z]$/.test(trailing[0]))) {
      yearIndex = i;
    }
    break;
  }

  if (yearIndex < 0) {
    return { programmeCode: raw, year: '', sectionLetter: 'General' };
  }

  const letter = upper.length === yearIndex + 2 ? tokens[yearIndex + 1] : '';
  return {
    programmeCode: tokens.slice(0, yearIndex).join('-'),
    year: upper[yearIndex],
    sectionLetter: letter ? letter.toUpperCase() : 'General',
  };
}

/** The section letter of a published code, e.g. `BCS-II B` -> `B`. */
export function sectionLetterOf(section: string): string {
  return parsePublishedSection(section).sectionLetter;
}

/** The year of a published code, e.g. `BCS-II B` -> `II`. */
export function yearOf(section: string): string {
  return parsePublishedSection(section).year;
}

/** The university's programme code for a published prefix, e.g. `CSE-CS` -> `CSE-Cyber`. */
export function apiCodeOf(programmeCode: string): string {
  const key = (programmeCode || '').trim().toUpperCase();
  return API_CODE_BY_PREFIX[key] ?? key;
}

/** Whether a published section belongs to a programme (prefix or programme code). */
function belongsToProgramme(section: string, target: string): boolean {
  if (!target) return false;
  const parts = parsePublishedSection(section);
  if (parts.programmeCode.trim().toUpperCase() === target) return true;
  if (apiCodeOf(parts.programmeCode).toUpperCase() === target) return true;
  return parseGBUClassCode(section).programmeCode.trim().toUpperCase() === target;
}

/**
 * The published sections of one programme.
 *
 * The published prefix wins, because the university reuses a programme code
 * for more than one prefix (`BCE` and `BEE` are both coded `BEE`). Only when
 * nothing carries the target as its own prefix is the programme code used,
 * so `CSE-Cyber` still finds `CSE-CS-I`.
 */
function selectProgrammeSections(sections: string[], target: string): string[] {
  const wanted = (target || '').trim().toUpperCase();
  if (!wanted) return [];
  const byPrefix = sections.filter(
    (section) =>
      parsePublishedSection(section).programmeCode.trim().toUpperCase() === wanted,
  );
  if (byPrefix.length > 0) return byPrefix;
  return sections.filter((section) => belongsToProgramme(section, wanted));
}

function compareSections(a: string, b: string): number {
  const left = parsePublishedSection(a);
  const right = parsePublishedSection(b);
  return (
    yearValue(left.year) - yearValue(right.year) ||
    left.sectionLetter.localeCompare(right.sectionLetter) ||
    a.localeCompare(b)
  );
}

/**
 * Builds the section code the way the university writes it.
 *
 * The university is not consistent: `BCS-II A` (a space) for the second
 * year, `BCS-III-A` (a dash) for the others. The app therefore stores the
 * code the API actually publishes, and this helper only builds a code when
 * one is not known.
 */
export function buildSectionCode(
  programmeCode: string,
  year: string,
  sectionLetter: string,
  publishedSections: string[] = [],
): string {
  const targetProgramme = (programmeCode || '').trim().toUpperCase();
  const targetYear = normaliseYearLabel(year);
  const targetLetter = (sectionLetter || '').trim().toUpperCase() || 'GENERAL';

  const siblings = selectProgrammeSections(publishedSections, targetProgramme);

  const published = siblings.find((code) => {
    const parts = parsePublishedSection(code);
    return (
      normaliseYearLabel(parts.year) === targetYear &&
      parts.sectionLetter.toUpperCase() === targetLetter
    );
  });
  if (published) return published;

  const prefix = (programmeCode || '').trim();
  if (targetLetter === 'GENERAL') return `${prefix}-${targetYear}`;

  const sameYear = siblings.filter(
    (code) => normaliseYearLabel(parsePublishedSection(code).year) === targetYear,
  );
  const separator = separatorOf(sameYear.length > 0 ? sameYear : siblings);
  return `${prefix}-${targetYear}${separator}${targetLetter}`;
}

/** The separator the university uses for the codes it published. */
function separatorOf(codes: string[]): string {
  let dashed = 0;
  let spaced = 0;
  for (const code of codes) {
    const trimmed = code.trim();
    if (/-[IVX]+-[A-Z]$/i.test(trimmed)) dashed += 1;
    else if (/-[IVX]+\s+[A-Z]$/i.test(trimmed)) spaced += 1;
  }
  return spaced > dashed ? ' ' : '-';
}

/**
 * Groups the published sections into the programmes a student picks from.
 * The programme name comes from the university's own `program_name`, so it is
 * always spelled the way the university spells it.
 */
export function groupSectionsIntoProgrammes(
  sections: CatalogueSource[],
): CatalogueProgramme[] {
  const groups = new Map<
    string,
    { code: string; names: Map<string, number>; schools: Map<string, number>; apiCodes: Map<string, number> }
  >();

  for (const entry of sections) {
    const section = (entry.section || '').trim();
    if (!section) continue;
    const code = parsePublishedSection(section).programmeCode;
    if (!code) continue;

    let group = groups.get(code);
    if (!group) {
      group = { code, names: new Map(), schools: new Map(), apiCodes: new Map() };
      groups.set(code, group);
    }
    count(group.names, (entry.programme || '').trim());
    count(group.schools, (entry.school || '').trim());
    count(group.apiCodes, (entry.programmeCode || '').trim());
  }

  const programmes: CatalogueProgramme[] = [];
  for (const group of groups.values()) {
    const known = lookupProgramme(group.code) ?? lookupProgramme(apiCodeOf(group.code));
    programmes.push({
      code: group.code,
      name: majority(group.names) || known?.name || group.code,
      school: majority(group.schools) || known?.school || 'SOICT',
      dept: known?.dept ?? 'CSE',
      apiCode: majority(group.apiCodes) || apiCodeOf(group.code),
    });
  }

  return programmes.sort(
    (a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code),
  );
}

/** The sections of one programme, ordered by year and then by letter. */
export function sectionsForProgramme(
  sections: string[],
  programmeCode: string,
): CatalogueSection[] {
  const target = (programmeCode || '').trim().toUpperCase();
  return selectProgrammeSections(sections, target)
    .map((section) => {
      const parts = parsePublishedSection(section);
      const known =
        lookupProgramme(parts.programmeCode) ?? lookupProgramme(apiCodeOf(parts.programmeCode));
      return {
        section,
        school: known?.school ?? 'SOICT',
        programme: known?.name ?? parts.programmeCode,
        programmeCode: parts.programmeCode,
        year: parts.year,
        sectionLetter: parts.sectionLetter,
      };
    })
    .sort((a, b) => compareSections(a.section, b.section));
}

/** The years a programme actually has sections for, earliest first. */
export function yearsForProgramme(sections: string[], programmeCode: string): string[] {
  const target = (programmeCode || '').trim().toUpperCase();
  const years = new Set<string>();
  for (const section of selectProgrammeSections(sections, target)) {
    const year = parsePublishedSection(section).year;
    if (year) years.add(year);
  }
  return [...years].sort((a, b) => yearValue(a) - yearValue(b));
}

/** The published section codes of one programme and year. */
export function sectionsForYear(
  sections: string[],
  programmeCode: string,
  year: string,
): string[] {
  const target = (programmeCode || '').trim().toUpperCase();
  const wanted = normaliseYearLabel(year);
  return selectProgrammeSections(sections, target)
    .filter(
      (section) => normaliseYearLabel(parsePublishedSection(section).year) === wanted,
    )
    .sort(compareSections);
}

/** The offline fallback: the published class codes the app ships with. */
export function fallbackSections(): string[] {
  return FALLBACK_CATALOGUE.flatMap((programme) => programme.sections);
}

/** The offline fallback: the programmes the app ships with. */
export function fallbackProgrammes(): CatalogueProgramme[] {
  return FALLBACK_CATALOGUE.map((programme) => ({
    code: programme.code,
    name: programme.name,
    school: programme.school,
    dept: lookupProgramme(programme.apiCode)?.dept ?? 'CSE',
    apiCode: programme.apiCode,
  }));
}

/** The schools the university runs programmes in. */
export function schoolsOf(programmes: CatalogueProgramme[]): string[] {
  return [...new Set(programmes.map((programme) => programme.school))].sort();
}

/** The programmes of one school. */
export function schoolProgrammesFor(
  programmes: CatalogueProgramme[],
  school: string,
): CatalogueProgramme[] {
  const wanted = (school || '').trim().toUpperCase();
  return programmes.filter(
    (programme) => programme.school.trim().toUpperCase() === wanted,
  );
}

function count(map: Map<string, number>, value: string): void {
  if (!value) return;
  map.set(value, (map.get(value) ?? 0) + 1);
}

function majority(map: Map<string, number>): string {
  let best = '';
  let bestCount = 0;
  for (const [value, occurrences] of map) {
    if (occurrences > bestCount) {
      best = value;
      bestCount = occurrences;
    }
  }
  return best;
}
