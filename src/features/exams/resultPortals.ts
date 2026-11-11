/**
 * GBU One - where the results and admit cards actually live.
 *
 * The university publishes its results in two places:
 *
 *  1. The examination portal publishes the official result sheets as PDF
 *     scans, one file per school. They are public, so the app can open them
 *     and let the student read their own row.
 *  2. The personal result and the admit card are behind the student portal
 *     (`gbuexam.in/result/login.php`), which asks for the roll number, a
 *     password and a captcha. That is a login with an anti-automation control,
 *     so the app links out to it and never stores the student's credentials.
 *     What the app *can* watch is the public sheet above: see
 *     `resultsWatch.ts`, which alerts the student when a school's sheet is
 *     re-published. (docs/DATA_SOURCES.md, docs/OPEN_QUESTIONS.md #22.)
 */
import { Linking } from 'react-native';

/** The university's own student result portal. */
export const RESULT_PORTAL_URL = 'https://gbuexam.in/result/login.php';

/** The examination portal's home, where every result sheet is listed. */
export const EXAM_PORTAL_URL = 'https://exams.gbu.ac.in/';

export interface ResultSheet {
  /** The file code the portal publishes the sheet under. */
  code: string;
  /** The school the sheet belongs to. */
  school: string;
  url: string;
  /** True when the sheet is for students who did not pass or have left. */
  special?: boolean;
}

const RESULT_BASE = 'https://exams.gbu.ac.in/uploads/results';

/** The result sheets the examination portal publishes. */
export const PUBLIC_RESULT_SHEETS: ResultSheet[] = [
  { code: 'sobsc', school: 'SOBSC', url: `${RESULT_BASE}/sobsc.pdf` },
  { code: 'sobt', school: 'SOBT', url: `${RESULT_BASE}/sobt.pdf` },
  { code: 'soe', school: 'SOE', url: `${RESULT_BASE}/soe.pdf` },
  { code: 'sohss', school: 'SOHSS', url: `${RESULT_BASE}/sohss.pdf` },
  { code: 'soict', school: 'SOICT', url: `${RESULT_BASE}/soict.pdf` },
  { code: 'soljg', school: 'SOL', url: `${RESULT_BASE}/soljg.pdf` },
  { code: 'som', school: 'SOM', url: `${RESULT_BASE}/som.pdf` },
  { code: 'sovasas', school: 'SOVSAS', url: `${RESULT_BASE}/sovasas.pdf` },
  { code: 'psobsc', school: 'SOBSC', url: `${RESULT_BASE}/passout/psobsc.pdf`, special: true },
  { code: 'psobt', school: 'SOBT', url: `${RESULT_BASE}/passout/psobt.pdf`, special: true },
  { code: 'psoe', school: 'SOE', url: `${RESULT_BASE}/passout/psoe.pdf`, special: true },
  { code: 'psohss', school: 'SOHSS', url: `${RESULT_BASE}/passout/psohss.pdf`, special: true },
  { code: 'psoict', school: 'SOICT', url: `${RESULT_BASE}/passout/psoict.pdf`, special: true },
  { code: 'psoljg', school: 'SOL', url: `${RESULT_BASE}/passout/psoljg.pdf`, special: true },
  { code: 'psom', school: 'SOM', url: `${RESULT_BASE}/passout/psom.pdf`, special: true },
  { code: 'psovasas', school: 'SOVSAS', url: `${RESULT_BASE}/passout/psovasas.pdf`, special: true },
];

/** The notice in which the university announces the admit cards. */
export const ADMIT_CARD_NOTICE_URL =
  'https://exams.gbu.ac.in/admin/public/uploads/notices/Admit Cards.pdf';

/**
 * The result sheet for a school, if the portal publishes one under that
 * name. The app's own school names match the portal's file codes.
 */
export function resultSheetForSchool(
  school: string | undefined | null,
  special = false,
): ResultSheet | undefined {
  const wanted = (school ?? '').trim().toUpperCase();
  if (!wanted) return undefined;
  return PUBLIC_RESULT_SHEETS.find(
    (sheet) => sheet.school === wanted && Boolean(sheet.special) === Boolean(special),
  );
}

/** Common examination sessions for result queries */
export const COMMON_RESULT_SESSIONS = [
  '2026-27 ODD SEM',
  '2025-26 EVEN SEM',
  '2025-26 ODD SEM',
  '2024-25 EVEN SEM',
  '2024-25 ODD SEM',
];

/**
 * Builds the URL to the gbuexam.in result login page with prefilled parameters
 */
export function buildPortalResultUrl(params: {
  rollNo?: string;
  session?: string;
  dob?: string;
}): string {
  const parts: string[] = [];
  if (params.rollNo) parts.push(`roll_no=${encodeURIComponent(params.rollNo.trim())}`);
  if (params.session) parts.push(`session=${encodeURIComponent(params.session.trim())}`);
  if (params.dob) parts.push(`dob=${encodeURIComponent(params.dob.trim())}`);
  const qs = parts.length > 0 ? `?${parts.join('&')}` : '';
  return `${RESULT_PORTAL_URL}${qs}`;
}

/**
 * Builds the direct GBU official results view gateway URL
 */
export function buildGbuDirectResultUrl(params: {
  rollNo?: string;
  session?: string;
}): string {
  const parts: string[] = [];
  if (params.rollNo) parts.push(`roll=${encodeURIComponent(params.rollNo.trim())}`);
  if (params.session) parts.push(`session=${encodeURIComponent(params.session.trim())}`);
  const qs = parts.length > 0 ? `?${parts.join('&')}` : '';
  return `https://www.gbu.ac.in/results${qs}`;
}

/** Opens the student's own result portal in the phone's browser. */
export async function openResultPortal(): Promise<boolean> {
  try {
    await Linking.openURL(RESULT_PORTAL_URL);
    return true;
  } catch {
    return false;
  }
}

/** Opens the student's result portal with prefilled parameters in the phone's browser. */
export async function openResultPortalWithParams(params: {
  rollNo?: string;
  session?: string;
  dob?: string;
}): Promise<boolean> {
  try {
    const url = buildPortalResultUrl(params);
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

const ORDINAL_SEMESTER_MAP: Record<string, string> = {
  '1': 'I',
  '1ST': 'I',
  FIRST: 'I',
  '2': 'II',
  '2ND': 'II',
  SECOND: 'II',
  '3': 'III',
  '3RD': 'III',
  THIRD: 'III',
  '4': 'IV',
  '4TH': 'IV',
  FOURTH: 'IV',
  '5': 'V',
  '5TH': 'V',
  FIFTH: 'V',
  '6': 'VI',
  '6TH': 'VI',
  SIXTH: 'VI',
  '7': 'VII',
  '7TH': 'VII',
  SEVENTH: 'VII',
  '8': 'VIII',
  '8TH': 'VIII',
  EIGHTH: 'VIII',
};

/**
 * Normalises a semester string to Roman numerals ('1' -> 'I', 'IVth' -> 'IV')
 */
export function normaliseSemester(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = raw.trim().toUpperCase();
  const romanMatch = trimmed.match(/^([IVX]+)(?:ST|ND|RD|TH)?$/);
  if (romanMatch) return romanMatch[1];
  return ORDINAL_SEMESTER_MAP[trimmed] || trimmed;
}

const PROGRAMME_ALIASES: Record<string, string[]> = {
  BCS: ['B.TECH CSE', 'B.TECH (CS)', 'B.TECH CS', 'COMPUTER SCIENCE', 'SOICT', 'BCS'],
  BIT: ['B.TECH IT', 'B.TECH (IT)', 'INFORMATION TECHNOLOGY', 'SOICT', 'BIT'],
  BAI: ['B.TECH AI', 'B.TECH (AI)', 'ARTIFICIAL INTELLIGENCE', 'SOICT', 'BAI'],
  BEC: ['B.TECH ECE', 'B.TECH (EC)', 'B.TECH EC', 'ELECTRONICS', 'SOICT', 'BEC'],
  'BEC-AIML': ['B.TECH ECE AI&ML', 'B.TECH ECE', 'SOICT'],
  'CSE-CYBER': ['CYBER SECURITY', 'B.TECH CSE', 'SOICT'],
  'CSE-DS': ['DATA SCIENCE', 'B.TECH CSE', 'SOICT'],
  'CSE-ML': ['MACHINE LEARNING', 'B.TECH CSE', 'SOICT'],
  BME: ['B.TECH ME', 'B.TECH (ME)', 'MECHANICAL', 'SOE', 'BME'],
  BCE: ['B.TECH CIVIL', 'B.TECH (CIVIL)', 'CIVIL', 'SOE', 'BCE'],
  BEE: ['B.TECH EE', 'B.TECH (EE)', 'ELECTRICAL', 'SOE', 'BEE'],
  BT: ['BIOTECH', 'BIOTECHNOLOGY', 'SOBT', 'BT'],
  BBT: ['BIOTECH', 'BIOTECHNOLOGY', 'SOBT', 'BBT'],
  MCA: ['MCA', 'SOICT'],
  MBA: ['MBA', 'SOM'],
  BCA: ['BCA', 'SOICT'],
  BBA: ['BBA', 'SOM'],
  BCOM: ['B.COM', 'SOM'],
  BALLB: ['B.A. LL.B', 'BALLB', 'SOL'],
  BBALLB: ['BBA LL.B', 'BBALLB', 'SOL'],
  LLM: ['LL.M', 'LLM', 'SOL'],
  LLB: ['LL.B', 'LLB', 'SOL'],
  SOICT: ['SOICT'],
  SOE: ['SOE'],
  SOM: ['SOM'],
  SOL: ['SOL'],
  SOBSC: ['SOBSC'],
  SOBT: ['SOBT'],
  SOHSS: ['SOHSS'],
  SOVSAS: ['SOVSAS'],
};

/**
 * Checks whether a declared result announcement matches the student's program, school, and semester.
 */
export function matchesStudentBatch(
  result: { programme?: string; semester?: string },
  student: {
    programmeCode?: string;
    programmeName?: string;
    school?: string;
    semester?: string;
    selectedSession?: string;
  },
): boolean {
  const resultProg = (result.programme || '').trim().toUpperCase();
  if (!resultProg) return false;

  const code = (student.programmeCode || '').trim().toUpperCase();
  const name = (student.programmeName || '').trim().toUpperCase();
  const school = (student.school || '').trim().toUpperCase();

  // 1. Programme Matching
  let progMatches = false;

  if (code && resultProg.includes(code)) progMatches = true;
  if (name && (resultProg.includes(name) || name.includes(resultProg))) progMatches = true;

  const aliases = PROGRAMME_ALIASES[code];
  if (aliases && aliases.some((a) => resultProg.includes(a))) {
    progMatches = true;
  }

  // School level fallback: if result is published for the whole school (e.g. "SOICT")
  if (school && resultProg === school) {
    progMatches = true;
  }

  if (!progMatches) return false;

  // 2. Semester Matching
  const resultSem = normaliseSemester(result.semester);
  const studentSem = normaliseSemester(student.semester);

  if (!resultSem) return true; // Covers all semesters
  if (!studentSem && !student.selectedSession) return true;

  if (studentSem && resultSem === studentSem) return true;

  // ODD / EVEN matching
  const ODD_SEMS = new Set(['I', 'III', 'V', 'VII', 'IX', '1', '3', '5', '7', '9']);
  const EVEN_SEMS = new Set(['II', 'IV', 'VI', 'VIII', 'X', '2', '4', '6', '8', '10']);

  const studentIsOdd =
    ODD_SEMS.has(studentSem) ||
    Boolean(student.selectedSession && student.selectedSession.includes('ODD'));
  const studentIsEven =
    EVEN_SEMS.has(studentSem) ||
    Boolean(student.selectedSession && student.selectedSession.includes('EVEN'));

  if (resultSem === 'ODD' && studentIsOdd) return true;
  if (resultSem === 'EVEN' && studentIsEven) return true;

  return false;
}

