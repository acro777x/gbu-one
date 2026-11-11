/**
 * GBU One — Student & Admin Reports Service
 *
 * Handles:
 * 1. PYQ incorrect paper reports (with custom notes, student ID, student name).
 * 2. General student issue reports from Profile screen (timetable error, notices, syllabus, bug, etc.).
 * 3. Offline-first local caching in AsyncStorage.
 * 4. Supabase cloud synchronization.
 * 5. Admin response management.
 *
 * Two rules shape this file:
 *
 * - **No metadata smuggling.** The `reports` table has real identity columns
 *   (`reporter_student_id`, `reporter_name`, `reporter_email`, `type`,
 *   `category`, `status`, `admin_response`, `admin_response_at`). The body of a
 *   report is plain text in `reason`. Nothing is packed into a JSON blob any
 *   more, so a moderator can always see who filed a report and a student can
 *   only ever read their own rows.
 *
 * - **No service-role key in the client.** There is no privileged client here:
 *   every query goes through the signed-in session client and Row Level
 *   Security decides what the caller may see (`reports own read` for a
 *   student, `reports moderator read` for the moderation queue).
 *
 * The student's local cache (`@gbu_student_reports_v2`) holds THIS device's
 * reports only. The moderation queue has its own cache
 * (`@gbu_admin_reports_v2`), so the full table is never written into the
 * student's cache where another student could read it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const LOCAL_REPORTS_STORAGE_KEY = '@gbu_student_reports_v2';
export const ADMIN_REPORTS_STORAGE_KEY = '@gbu_admin_reports_v2';
export const ADMIN_RESPONSES_STORAGE_KEY = '@gbu_admin_responses_v2';

export type ReportCategory =
  | 'PYQ Paper'
  | 'Timetable Error'
  | 'Notice Issue'
  | 'App Bug'
  | 'Syllabus / Course'
  | 'General Feedback';

export interface StudentReport {
  id: string;
  type: 'pyq' | 'general';
  category: ReportCategory;
  subjectCode?: string;
  subjectName?: string;
  paperId?: string;
  reason: string;
  customNote?: string;
  reporterName: string;
  reporterStudentId: string;
  reporterEmail?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  adminResponse?: string;
  adminResponseAt?: string;
  createdAt: string;
}

export const REPORT_CATEGORIES: { category: ReportCategory; icon: string; description: string }[] = [
  { category: 'Timetable Error', icon: 'calendar', description: 'Room, professor, or slot mismatch in timetable' },
  { category: 'PYQ Paper', icon: 'file-text', description: 'Incorrect, cut-off, or blurred question paper' },
  { category: 'Notice Issue', icon: 'bell', description: 'Missing department circular or broken notice link' },
  { category: 'Syllabus / Course', icon: 'book', description: 'Outdated or missing subject curriculum' },
  { category: 'App Bug', icon: 'alert-triangle', description: 'Feature crash, UI glitch, or performance issue' },
  { category: 'General Feedback', icon: 'message-square', description: 'Suggestions or requests for GBU One' },
];

/** Read locally cached student reports (this device only). */
export async function getLocalReports(): Promise<StudentReport[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_REPORTS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StudentReport[];
  } catch {
    return [];
  }
}

/** Save the student's own reports to local storage. */
export async function saveLocalReports(reports: StudentReport[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_REPORTS_STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // Ignore storage failure
  }
}

/** Read the moderation-queue cache (kept apart from the student's cache). */
export async function getAdminLocalReports(): Promise<StudentReport[]> {
  try {
    const raw = await AsyncStorage.getItem(ADMIN_REPORTS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StudentReport[];
  } catch {
    return [];
  }
}

/** Save the moderation-queue cache. */
export async function saveAdminLocalReports(reports: StudentReport[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ADMIN_REPORTS_STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // Ignore storage failure
  }
}

/** Newest first. */
function sortByNewest(reports: StudentReport[]): StudentReport[] {
  return [...reports].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** Merge by id; the later list wins (the cloud copy is fresher than the local one). */
function mergeById(...lists: StudentReport[][]): StudentReport[] {
  const map = new Map<string, StudentReport>();
  for (const list of lists) {
    for (const report of list) {
      map.set(report.id, report);
    }
  }
  return sortByNewest(Array.from(map.values()));
}

/**
 * Whether a report belongs to the given student.
 *
 * This is the single ownership test used by the student app: a report is
 * "mine" only when the student id or the e-mail address matches exactly.
 * Nothing else (the report type, the category, ...) can make a report belong
 * to somebody - that was how every student ended up seeing the whole table.
 */
export function belongsToStudent(
  report: StudentReport,
  studentId?: string,
  email?: string,
): boolean {
  const wantedId = (studentId ?? '').trim().toLowerCase();
  const wantedEmail = (email ?? '').trim().toLowerCase();
  const reportId = (report.reporterStudentId ?? '').trim().toLowerCase();
  const reportEmail = (report.reporterEmail ?? '').trim().toLowerCase();

  if (wantedId && reportId && reportId === wantedId) return true;
  if (wantedEmail && reportEmail && reportEmail === wantedEmail) return true;
  return false;
}

/** The id of the signed-in Supabase user, when there is one. */
async function currentAuthUserId(): Promise<string | null> {
  try {
    const getSession = supabase.auth?.getSession;
    if (typeof getSession !== 'function') return null;
    const { data, error } = await getSession.call(supabase.auth);
    if (error || !data?.session?.user?.id) return null;
    return data.session.user.id;
  } catch {
    return null;
  }
}

/**
 * The plain-text body of a report.
 *
 * The custom note is appended to the body because the table stores the body
 * as plain text - the note is part of what the student wrote.
 */
function composeBody(report: StudentReport): string {
  const body = (report.reason ?? '').trim();
  const note = (report.customNote ?? '').trim();
  if (!note) return body;
  return body ? `${body}\n\nNote: ${note}` : `Note: ${note}`;
}

/**
 * Reads a report row from the table.
 *
 * Rows written by an older build of the app packed their metadata into a JSON
 * blob in `reason`; those rows are still readable (the blob is unpacked for
 * display only). New rows never use that shape.
 */
function rowToReport(row: Record<string, unknown>): StudentReport {
  const rawReason = String(row.reason ?? '');
  const legacy = parseLegacyReason(rawReason);

  return {
    id: String(row.id ?? ''),
    type: String(row.type ?? '').toLowerCase() === 'pyq' || row.pyq_id ? 'pyq' : 'general',
    category: normaliseCategory(row.category, row.pyq_id ? 'PYQ Paper' : 'General Feedback'),
    subjectCode: legacy.subjectCode,
    subjectName: legacy.subjectName,
    paperId: row.pyq_id ? String(row.pyq_id) : undefined,
    reason: legacy.reason ?? rawReason,
    customNote: legacy.customNote,
    reporterName: String(row.reporter_name ?? '') || 'GBU Student',
    reporterStudentId:
      String(row.reporter_student_id ?? '') ||
      (row.reporter_id ? String(row.reporter_id) : 'GBU-SCHOLAR'),
    reporterEmail: String(row.reporter_email ?? '') || undefined,
    status: normaliseStatus(row.status),
    adminResponse: row.admin_response ? String(row.admin_response) : undefined,
    adminResponseAt: row.admin_response_at ? String(row.admin_response_at) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

/** Unpacks the JSON blob written by older builds (read-only compatibility). */
function parseLegacyReason(raw: string): {
  reason?: string;
  customNote?: string;
  subjectCode?: string;
  subjectName?: string;
} {
  if (!raw.startsWith('{')) return { reason: raw };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return { reason: raw };
    return {
      reason: typeof parsed.reason === 'string' ? parsed.reason : raw,
      customNote: typeof parsed.customNote === 'string' ? parsed.customNote : undefined,
      subjectCode: typeof parsed.subjectCode === 'string' ? parsed.subjectCode : undefined,
      subjectName: typeof parsed.subjectName === 'string' ? parsed.subjectName : undefined,
    };
  } catch {
    return { reason: raw };
  }
}

/** The table stores the category as free text; map it back onto the known list. */
function normaliseCategory(value: unknown, fallback: ReportCategory): ReportCategory {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return fallback;
  const match = REPORT_CATEGORIES.find((entry) => entry.category.toLowerCase() === text);
  return match ? match.category : fallback;
}

/** The table defaults to 'open'; the app shows 'pending' for that state. */
function normaliseStatus(value: unknown): StudentReport['status'] {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'open') return 'pending';
  if (text === 'reviewed' || text === 'resolved' || text === 'dismissed') return text;
  return 'pending';
}

/**
 * Submit a report from the student app (PYQ or Profile issue report)
 */
export async function submitStudentReport(
  reportData: Omit<StudentReport, 'id' | 'createdAt' | 'status'>,
): Promise<{ ok: boolean; reportId: string; reason?: string }> {
  const reportId = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const newReport: StudentReport = {
    ...reportData,
    id: reportId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  // 1. Save locally for instant offline availability
  try {
    const current = await getLocalReports();
    await saveLocalReports([newReport, ...current.filter((r) => r.id !== reportId)]);
  } catch {
    // Local save best-effort
  }

  // 2. Sync to Supabase if configured
  if (isSupabaseConfigured) {
    try {
      const isPaperUuid =
        newReport.paperId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(newReport.paperId);

      const isUserUuid =
        newReport.reporterStudentId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(newReport.reporterStudentId);

      // The signed-in user, when there is one: this is what Row Level Security
      // matches a student against.
      const authUserId = await currentAuthUserId();

      const { error } = await supabase.from('reports').insert({
        reporter_id: authUserId ?? (isUserUuid ? newReport.reporterStudentId : null),
        reporter_student_id: newReport.reporterStudentId ?? '',
        reporter_name: newReport.reporterName ?? '',
        reporter_email: newReport.reporterEmail ?? '',
        pyq_id: isPaperUuid ? newReport.paperId : null,
        type: newReport.type,
        category: newReport.category,
        status: 'pending',
        reason: composeBody(newReport),
        created_at: newReport.createdAt,
      });

      if (error) {
        // The local copy stays; the sync can be retried later.
      }
    } catch {
      // Cloud sync is best-effort; offline record is preserved
    }
  }

  return { ok: true, reportId };
}

/**
 * Fetch all reports for the Admin APK
 *
 * The moderation queue is read with the signed-in session client: Row Level
 * Security lets a moderator read the whole queue and nobody else. The result
 * is cached in the ADMIN cache - the student's cache is never used as the
 * place where the full table is written.
 */
export async function fetchReportsForAdmin(): Promise<StudentReport[]> {
  const localList = mergeById(await getAdminLocalReports(), await getLocalReports());
  if (!isSupabaseConfigured) {
    return localList;
  }

  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) {
      return localList;
    }

    const cloudReports: StudentReport[] = (data as Record<string, unknown>[]).map(rowToReport);
    const merged = mergeById(localList, cloudReports);

    // Only the moderation queue cache is written here.
    await saveAdminLocalReports(merged);
    return merged;
  } catch {
    return localList;
  }
}

/**
 * Fetch and synchronize reports for the student app
 *
 * The query is filtered on the server (and again by Row Level Security), and
 * the local cache is filtered too: a student only ever sees their own
 * reports, and another student's rows are never written into this device's
 * cache.
 */
export async function fetchStudentReports(studentId?: string, email?: string): Promise<StudentReport[]> {
  const ownId = (studentId ?? '').trim();
  const ownEmail = (email ?? '').trim();

  const localList = (await getLocalReports()).filter((report) =>
    belongsToStudent(report, ownId, ownEmail),
  );

  if (!isSupabaseConfigured) {
    return sortByNewest(localList);
  }

  try {
    const filters: string[] = [];
    if (ownId) filters.push(`reporter_student_id.eq.${ownId}`);
    if (ownEmail) filters.push(`reporter_email.eq."${ownEmail}"`);

    let query = supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (filters.length > 0) {
      query = query.or(filters.join(','));
    }

    const { data, error } = await query;

    if (error || !data) {
      return sortByNewest(localList);
    }

    const cloudReports = (data as Record<string, unknown>[])
      .map(rowToReport)
      .filter((report) => belongsToStudent(report, ownId, ownEmail));

    const merged = mergeById(localList, cloudReports);

    // Only this student's own rows are written back to the student's cache.
    await saveLocalReports(merged);
    return merged;
  } catch {
    return sortByNewest(localList);
  }
}

/**
 * Admin responds to a student report
 */
export async function respondToReport(
  reportId: string,
  adminResponse: string,
  newStatus: 'reviewed' | 'resolved' | 'dismissed' = 'resolved',
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const respondedAt = new Date().toISOString();
    const trimmed = adminResponse.trim();

    const applyResponse = (reports: StudentReport[]): StudentReport[] =>
      reports.map((report) =>
        report.id === reportId
          ? {
              ...report,
              status: newStatus,
              adminResponse: trimmed,
              adminResponseAt: respondedAt,
            }
          : report,
      );

    const studentList = await getLocalReports();
    const adminList = await getAdminLocalReports();
    await saveLocalReports(applyResponse(studentList));
    await saveAdminLocalReports(applyResponse(adminList));

    // Sync to Supabase if UUID format. Row Level Security allows the update
    // for a moderator only.
    if (isSupabaseConfigured && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId)) {
      await supabase
        .from('reports')
        .update({
          status: newStatus,
          admin_response: trimmed,
          admin_response_at: respondedAt,
        })
        .eq('id', reportId);
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Could not save response.' };
  }
}
