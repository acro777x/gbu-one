/**
 * GBU One - where the results and admit cards actually live.
 *
 * The university publishes its results in two places:
 *
 *  1. The examination portal publishes the official result sheets as PDF
 *     scans, one file per school. They are public, so the app can open them
 *     and let the student read their own row.
 *  2. The personal result and the admit card are behind the student portal
 *     (`gbuexam.in`), which asks for the roll number and the mobile number.
 *     That is a login, so the app links out to it and never stores the
 *     student's credentials.
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
    (sheet) => sheet.school === wanted && sheet.special === special,
  );
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
