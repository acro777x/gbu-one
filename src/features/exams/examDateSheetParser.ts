/**
 * GBU One — Authentic Date Sheet Parser & Ingestion Engine.
 *
 * Supports parsing both Mid-Semester and End-Semester date sheets published by
 * Gautam Buddha University in either Excel (.xlsx, .xls, .csv) or text/grid formats.
 *
 * Handles:
 *  1. Matrix/Grid format (e.g. Authentic GBU Date Sheet PDF / CSV):
 *     - Header specifying school, exam type, and date range
 *     - Date headers in DD-MM-YYYY columns
 *     - Class rows with Morning and Evening shifts
 *     - Subject codes + names in cells (e.g. "CSE201 Scientific Computing with Python")
 *  2. Tabular/Flat format (Date, Shift, Programme, Semester, Course Code, Course Name, Paper ID)
 *  3. Class-wise canonical key mapping: programmes and semesters map to canonical class keys (e.g. "btech_cse_sem3").
 */

import * as XLSX from 'xlsx';
import type { DatesheetEntry } from './examService';

export interface ExamDateSlot {
  slotKey: string;
  schoolCode: string;
  programme: string;
  batch?: string;
  semester?: string;
  classKey: string;
  examDate: string; // ISO date YYYY-MM-DD
  slot: 'morning' | 'evening';
  shiftTime?: string;
  subjectCode: string;
  subjectName: string;
  paperId?: string;
  examType: 'mid_sem' | 'end_sem' | 'practical';
  isBackPaper: boolean;
  sourceUrl?: string;
}

export interface DateSlotRow {
  slot_key: string;
  school_code: string;
  programme: string;
  exam_date: string;
  slot: 'morning' | 'evening';
  subject_code: string;
  subject_name: string;
  is_back_paper: boolean;
  source_url: string;
  class_key?: string;
  exam_type?: 'mid_sem' | 'end_sem' | 'practical';
  shift_time?: string;
  paper_id?: string;
}

export interface DateSheetParseOptions {
  schoolCode?: string;
  examType?: 'mid_sem' | 'end_sem' | 'practical';
  sourceUrl?: string;
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
  'MTB2': 'mtech_biotech',
  MBT: 'msc_biotech',
  'MBT1': 'msc_biotech_1yr',
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

/** The batch a cohort belongs to, e.g. `Batch (2025-2029)`. */
const BATCH_RE = /batch\s*\(?\s*(\d{4})\s*[-–—]\s*(\d{4})\s*\)?/i;

/** Deterministic slot key for database idempotency. */
export function dateSlotKey(
  schoolCode: string,
  examDate: string,
  slot: string,
  subjectCode: string,
  subjectName: string,
  classKey: string,
): string {
  // The class key is part of the key on purpose: two cohorts of the same
  // programme (`Batch 2022-2026` and `Batch 2025-2029`) sit in different
  // semesters and must never share a slot.
  const parts = ['datesheet', schoolCode, classKey, examDate, slot, subjectCode, subjectName];
  return parts
    .join(':')
    .toLowerCase()
    .replace(/\s+/g, '-');
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
    return { programme: key.replace(/[^a-z0-9]+/g, '_'), semester: null };
  }
  const programme = match[1];
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
  const key = (rawKey ?? '').trim().toLowerCase();
  return key.replace(/(_sem\d+).*$/, '$1');
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
  const batchMatch = BATCH_RE.exec(raw);
  const batch = batchMatch ? `${batchMatch[1]}_${batchMatch[2]}` : undefined;

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
      progSlug = code.toLowerCase().replace(/[^a-z0-9]+/g, '_');
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
    } else if (/ll\.?m/i.test(text)) {
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
    } else {
      progSlug = text
        .split(/batch|sem|\d{4}/i)[0]
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      if (!progSlug) progSlug = 'general';
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
 * Builds the class key the database stores in `class_key`: the programme and
 * the semester, e.g. `btech_cse_sem3`.
 *
 * The batch and the section are deliberately left out: the worker writes this
 * value, and the app has to be able to find the rows it wrote.
 */
export function buildClassKey(programmeText: string, explicitSemester?: string | number | null): string {
  const parts = parseClassKeyParts(programmeText, explicitSemester);
  return parts.semester !== null ? `${parts.programme}_sem${parts.semester}` : parts.programme;
}

/**
 * Builds the full identity of a class: the programme, the semester, the batch
 * and the section, e.g. `btech_cse_sem3_2025_2029_b`.
 *
 * This is the key the app uses to tell two cohorts of the same programme
 * apart. The base key (`buildClassKey`) stays the value the database is
 * filtered on.
 */
export function buildCanonicalClassKey(
  programmeText: string,
  explicitSemester?: string | number | null,
  overrides?: { batch?: string | null; section?: string | null },
): string {
  const parts = parseClassKeyParts(programmeText, explicitSemester);
  const batch = overrides?.batch ?? parts.batch;
  const section = overrides?.section ?? parts.section;
  const base =
    parts.semester !== null ? `${parts.programme}_sem${parts.semester}` : parts.programme;
  return [base, batch, section].filter(Boolean).join('_').toLowerCase();
}

/**
 * Checks whether a student's class selection matches a date slot's class key.
 *
 * The comparison is deliberately forgiving: a slot that only knows the
 * programme (`btech_cse_sem3`) matches a student who also knows their section
 * (`btech_cse_sem3_b`), because the date sheet is published per programme.
 * Two keys that both name a batch or a section have to agree on it.
 */
export function matchClassKey(studentKey?: string | null, slotKey?: string | null): boolean {
  if (!studentKey || !slotKey) return false;
  const sNorm = studentKey.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const dNorm = slotKey.trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (sNorm === dNorm) return true;

  const sParts = parseCanonicalClassKey(sNorm);
  const dParts = parseCanonicalClassKey(dNorm);
  // The programme of a key is read through `buildClassKey`, so `bcs_sem3`
  // and `btech_cse_sem3` name the same programme.
  const sProgramme = buildClassKey(sNorm).replace(/_sem\d+$/, '');
  const dProgramme = buildClassKey(dNorm).replace(/_sem\d+$/, '');

  const alias = (value: string): string => PROGRAMME_ALIASES[value] ?? value;
  if (!sProgramme || !dProgramme) return false;
  if (alias(sProgramme) !== alias(dProgramme)) return false;

  if (sParts.semester !== null && dParts.semester !== null && sParts.semester !== dParts.semester) {
    return false;
  }
  if (sParts.batch && dParts.batch && sParts.batch !== dParts.batch) return false;
  if (sParts.section && dParts.section && sParts.section !== dParts.section) return false;
  return true;
}

/**
 * Parses any date cell value (serial number, Date, or string) into ISO `YYYY-MM-DD`.
 */
export function parseDateValue(val: unknown): string | null {
  if (val === null || val === undefined) return null;

  if (typeof val === 'number') {
    if (val > 20000 && val < 90000) {
      try {
        const d = XLSX.SSF.parse_date_code(val);
        if (d && d.y && d.m && d.d) {
          return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        }
      } catch {
        // fall through
      }
    }
  }

  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const y = val.getUTCFullYear();
      const m = String(val.getUTCMonth() + 1).padStart(2, '0');
      const d = String(val.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(val).trim();
  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Splits a cell like "CSE201 Scientific Computing with Python" or "CSE209Operating System"
 * into code and title.
 */
export function parseSubjectCell(val: string): {
  subjectCode: string;
  subjectName: string;
  isBackPaper: boolean;
  paperId?: string;
} {
  const clean = (val || '').replace(/[\r\n]+/g, ' ').trim();
  const isBackPaper = /\b(back|repeat)\s*paper\b/i.test(clean);
  const withoutBack = clean
    .replace(/\(\s*(back|repeat)\s*paper\s*\)/gi, '')
    .replace(/\b(back|repeat)\s*paper\b/gi, '')
    .trim();

  // Try 1: Code followed by delimiter (space, dash, hyphen, slash)
  const delimMatch = withoutBack.match(
    /^([A-Z]{2,6}[- ]?\d{2,4}[A-Za-z]?)[-–—/\s]+(.*)$/i,
  );
  if (delimMatch) {
    const code = delimMatch[1].replace(/[\s-]+/g, '').toUpperCase();
    const name = delimMatch[2].replace(/^[-–—/\s]+/, '').trim();
    return {
      subjectCode: code,
      subjectName: name || code,
      isBackPaper,
    };
  }

  // Try 2: Code immediately followed by title word with no delimiter (e.g. "CSE209Operating System")
  const noDelimMatch = withoutBack.match(
    /^([A-Z]{2,6}[- ]?\d{2,4})(?=[A-Za-z])(.*)$/i,
  );
  if (noDelimMatch) {
    const code = noDelimMatch[1].replace(/[\s-]+/g, '').toUpperCase();
    const name = noDelimMatch[2].trim();
    return {
      subjectCode: code,
      subjectName: name || code,
      isBackPaper,
    };
  }

  // Try 3: Code only (e.g. "CSE201")
  const codeOnlyMatch = withoutBack.match(
    /^([A-Z]{2,6}[- ]?\d{2,4}[A-Za-z]?)$/i,
  );
  if (codeOnlyMatch) {
    const code = codeOnlyMatch[1].replace(/[\s-]+/g, '').toUpperCase();
    return {
      subjectCode: code,
      subjectName: code,
      isBackPaper,
    };
  }

  // Fallback: If no leading code pattern, use whole string
  return {
    subjectCode: '',
    subjectName: withoutBack,
    isBackPaper,
  };
}

/**
 * Infers school code from text or file headers.
 */
export function inferSchoolCode(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('information and communication') || t.includes('soict') || t.includes('ict')) return 'soict';
  if (t.includes('engineering') || t.includes('soe')) return 'soe';
  if (t.includes('biotechnology') || t.includes('sobt')) return 'sobt';
  if (t.includes('management') || t.includes('som')) return 'som';
  if (t.includes('humanities') || t.includes('sohss')) return 'sohss';
  if (t.includes('law') || t.includes('soljg')) return 'soljg';
  if (t.includes('applied sciences') || t.includes('basic sciences') || t.includes('sobsc')) return 'sobsc';
  if (t.includes('buddhist') || t.includes('sovasas')) return 'sovasas';
  return 'soict';
}

/**
 * Infers exam type from header or text.
 */
export function inferExamType(text: string): 'mid_sem' | 'end_sem' | 'practical' {
  const t = text.toLowerCase();
  if (t.includes('mid-sem') || t.includes('mid sem') || t.includes('midsem')) return 'mid_sem';
  if (t.includes('practical') || t.includes('viva') || t.includes('lab exam')) return 'practical';
  return 'end_sem';
}

/**
 * Parses Excel (.xlsx, .xls) binary buffers, CSV strings, or ArrayBuffers into ExamDateSlot[].
 */
export function parseExcelDateSheet(
  buffer: ArrayBuffer | Buffer | string,
  options: DateSheetParseOptions = {},
): ExamDateSlot[] {
  if (!buffer) return [];

  let wb: XLSX.WorkBook;
  try {
    if (typeof buffer === 'string') {
      wb = XLSX.read(buffer, { type: 'string', raw: true });
    } else if (Buffer.isBuffer(buffer)) {
      wb = XLSX.read(buffer, { type: 'buffer', raw: true });
    } else if (buffer instanceof ArrayBuffer) {
      wb = XLSX.read(new Uint8Array(buffer), { type: 'array', raw: true });
    } else if (ArrayBuffer.isView(buffer as unknown)) {
      const view = buffer as unknown as Uint8Array;
      wb = XLSX.read(view, { type: 'array', raw: true });
    } else {
      return [];
    }
  } catch (err) {
    console.warn('Failed to parse workbook with xlsx:', err);
    return [];
  }

  if (!wb.SheetNames || wb.SheetNames.length === 0) return [];

  const allSlots: ExamDateSlot[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: true,
    });
    if (!rows || rows.length === 0) continue;

    // Detect overall School & ExamType from top 5 rows if not explicitly supplied
    let detectedSchool = options.schoolCode;
    let detectedExamType = options.examType;

    const topText = rows
      .slice(0, 5)
      .map((r) => r.join(' '))
      .join('\n');
    if (!detectedSchool) detectedSchool = inferSchoolCode(topText);
    if (!detectedExamType) detectedExamType = inferExamType(topText);

    // Check if Tabular/Flat format
    let isFlat = false;
    let flatColMap = {
      headerRow: -1,
      date: -1,
      shift: -1,
      prog: -1,
      sem: -1,
      code: -1,
      name: -1,
      paperId: -1,
    };

    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const row = (rows[r] || []).map((c) => String(c || '').trim().toLowerCase());
      const codeIdx = row.findIndex(
        (c) => c.includes('course code') || c.includes('subject code') || c === 'code' || c.includes('paper code'),
      );
      const nameIdx = row.findIndex(
        (c) =>
          c.includes('course name') ||
          c.includes('subject name') ||
          c.includes('course title') ||
          c.includes('subject title') ||
          c === 'title',
      );
      const dateIdx = row.findIndex((c) => c === 'date' || c.includes('exam date'));

      if (codeIdx >= 0 && (nameIdx >= 0 || dateIdx >= 0)) {
        isFlat = true;
        flatColMap = {
          headerRow: r,
          date: dateIdx,
          shift: row.findIndex((c) => c.includes('shift') || c.includes('time') || c.includes('slot')),
          prog: row.findIndex(
            (c) =>
              c.includes('programme') ||
              c.includes('program') ||
              c.includes('course') ||
              c.includes('branch'),
          ),
          sem: row.findIndex((c) => c.includes('semester') || c.includes('sem')),
          code: codeIdx,
          name: nameIdx,
          paperId: row.findIndex((c) => c.includes('paper id') || c.includes('paper_id')),
        };
        break;
      }
    }

    if (isFlat) {
      // -----------------------------------------------------------------
      // Tabular / Flat format parsing
      // -----------------------------------------------------------------
      for (let r = flatColMap.headerRow + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        if (row.length === 0) continue;

        const dateRaw = flatColMap.date >= 0 ? row[flatColMap.date] : null;
        const examDate = parseDateValue(dateRaw);
        if (!examDate) continue;

        const codeRaw = flatColMap.code >= 0 ? String(row[flatColMap.code] || '').trim() : '';
        const nameRaw = flatColMap.name >= 0 ? String(row[flatColMap.name] || '').trim() : '';
        if (!codeRaw && !nameRaw) continue;

        const shiftRaw = flatColMap.shift >= 0 ? String(row[flatColMap.shift] || '').trim() : '';
        const isEvening = /evening|shift\s*2|02:|2\.|2:00|3\.|3:30/i.test(shiftRaw);
        const slot: 'morning' | 'evening' = isEvening ? 'evening' : 'morning';

        const progRaw = flatColMap.prog >= 0 ? String(row[flatColMap.prog] || '').trim() : 'General';
        const semRaw = flatColMap.sem >= 0 ? String(row[flatColMap.sem] || '').trim() : '';
        const fullProg = semRaw ? `${progRaw} ${semRaw}` : progRaw;
        // The slot is identified by the full class key (programme, semester,
        // batch and section), while the row keeps the base key the database
        // is filtered on.
        const canonicalKey = buildCanonicalClassKey(fullProg, semRaw);
        const classKey = baseClassKeyOf(canonicalKey);

        const paperId = flatColMap.paperId >= 0 ? String(row[flatColMap.paperId] || '').trim() : undefined;
        const isBackPaper = /\b(back|repeat)\s*paper\b/i.test(nameRaw) || /\b(back|repeat)\s*paper\b/i.test(codeRaw);

        const key = dateSlotKey(
          detectedSchool,
          examDate,
          slot,
          codeRaw,
          nameRaw || codeRaw,
          canonicalKey,
        );

        const defaultShiftTime =
          detectedExamType === 'mid_sem'
            ? slot === 'morning'
              ? '10:00 AM - 11:30 AM'
              : '03:30 PM - 05:00 PM'
            : slot === 'morning'
              ? '09:30 AM - 12:30 PM'
              : '02:00 PM - 05:00 PM';

        allSlots.push({
          slotKey: key,
          schoolCode: detectedSchool,
          programme: progRaw,
          semester: semRaw || undefined,
          classKey,
          examDate,
          slot,
          shiftTime: shiftRaw || defaultShiftTime,
          subjectCode: codeRaw,
          subjectName: nameRaw || codeRaw,
          paperId,
          examType: detectedExamType,
          isBackPaper,
          sourceUrl: options.sourceUrl,
        });
      }
    } else {
      // -----------------------------------------------------------------
      // Matrix / Grid format parsing (Authentic GBU Date Sheet CSV/Excel)
      // -----------------------------------------------------------------
      let headerRowIdx = -1;
      let dateCols: Array<{ col: number; date: string }> = [];

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r] || [];
        const found: Array<{ col: number; date: string }> = [];
        for (let c = 2; c < row.length; c++) {
          const iso = parseDateValue(row[c]);
          if (iso) found.push({ col: c, date: iso });
        }
        if (found.length >= 2) {
          headerRowIdx = r;
          dateCols = found;
          break;
        }
      }

      if (headerRowIdx >= 0 && dateCols.length > 0) {
        let currentProgramme = '';

        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r] || [];
          if (row.length === 0) continue;

          const col0 = String(row[0] || '').trim();
          const col1 = String(row[1] || '').trim();

          if (col0) currentProgramme = col0;
          if (!currentProgramme && !col0) continue;

          const isEvening = /evening/i.test(col1);
          const slot: 'morning' | 'evening' = isEvening ? 'evening' : 'morning';
          const shiftTime = col1;

          const canonicalKey = buildCanonicalClassKey(currentProgramme);
          const classKey = baseClassKeyOf(canonicalKey);

          for (const dc of dateCols) {
            const cellVal = String(row[dc.col] || '').trim();
            if (!cellVal || cellVal === '*' || cellVal === '-' || cellVal.toUpperCase() === 'NIL') {
              continue;
            }

            const parsed = parseSubjectCell(cellVal);
            const key = dateSlotKey(
              detectedSchool,
              dc.date,
              slot,
              parsed.subjectCode,
              parsed.subjectName,
              canonicalKey,
            );

            allSlots.push({
              slotKey: key,
              schoolCode: detectedSchool,
              programme: currentProgramme,
              classKey,
              examDate: dc.date,
              slot,
              shiftTime,
              subjectCode: parsed.subjectCode,
              subjectName: parsed.subjectName,
              examType: detectedExamType,
              isBackPaper: parsed.isBackPaper,
              sourceUrl: options.sourceUrl,
            });
          }
        }
      }
    }
  }

  return allSlots;
}

/** Converts an ExamDateSlot to a database row. */
export function examSlotToRow(slot: ExamDateSlot): DateSlotRow {
  return {
    slot_key: slot.slotKey,
    school_code: slot.schoolCode,
    programme: slot.programme,
    exam_date: slot.examDate,
    slot: slot.slot,
    subject_code: slot.subjectCode,
    subject_name: slot.subjectName,
    is_back_paper: slot.isBackPaper,
    source_url: slot.sourceUrl || '',
    class_key: slot.classKey,
    exam_type: slot.examType,
    shift_time: slot.shiftTime || '',
    paper_id: slot.paperId || '',
  };
}

/** Converts a database row to an ExamDateSlot. */
export function rowToExamSlot(row: DateSlotRow): ExamDateSlot {
  return {
    slotKey: row.slot_key,
    schoolCode: row.school_code,
    programme: row.programme,
    examDate: row.exam_date,
    slot: row.slot,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    isBackPaper: Boolean(row.is_back_paper),
    sourceUrl: row.source_url,
    classKey: row.class_key || buildClassKey(row.programme),
    examType: row.exam_type || 'end_sem',
    shiftTime: row.shift_time,
    paperId: row.paper_id,
  };
}

/** Maps an ExamDateSlot into the app's DatesheetEntry UI shape. */
export function examSlotToDatesheetEntry(slot: ExamDateSlot): DatesheetEntry {
  return {
    id: slot.slotKey,
    programmeCode: slot.classKey.toUpperCase(),
    semester: slot.semester || 'Current',
    subjectCode: slot.subjectCode || 'EXAM',
    subjectName: slot.subjectName,
    examDate: `${slot.examDate}T04:00:00.000Z`,
    examTime:
      slot.shiftTime ||
      (slot.examType === 'mid_sem'
        ? slot.slot === 'morning'
          ? '10:00 AM - 11:30 AM'
          : '03:30 PM - 05:00 PM'
        : slot.slot === 'morning'
          ? '09:30 AM - 12:30 PM'
          : '02:00 PM - 05:00 PM'),
    shift: slot.slot === 'evening' ? 'Evening' : 'Morning',
    roomBlock: `${slot.schoolCode.toUpperCase()} Examination Hall`,
    paperId: slot.paperId,
    examType: slot.examType,
    isBackPaper: slot.isBackPaper,
  };
}

/** Filters slots for a student by their class key and optional exam type. */
export function filterSlotsForStudent(
  slots: ExamDateSlot[],
  studentClassKey: string,
  examType?: 'mid_sem' | 'end_sem' | 'practical' | 'all',
): ExamDateSlot[] {
  return slots.filter((slot) => {
    const matchesClass = matchClassKey(studentClassKey, slot.classKey);
    if (!matchesClass) return false;
    if (examType && examType !== 'all' && slot.examType !== examType) return false;
    return true;
  });
}
