/**
 * GBU One — Student & Admin Reports Service
 *
 * Handles:
 * 1. PYQ incorrect paper reports (with custom notes, student ID, student name).
 * 2. General student issue reports from Profile screen (timetable error, notices, syllabus, bug, etc.).
 * 3. Offline-first local caching in AsyncStorage.
 * 4. Supabase cloud synchronization.
 * 5. Admin APK retrieval and response management.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const LOCAL_REPORTS_STORAGE_KEY = '@gbu_student_reports_v2';
export const ADMIN_RESPONSES_STORAGE_KEY = '@gbu_admin_responses_v2';

function getAdminClient() {
  const serviceKey =
    process.env.EXPO_PUBLIC_ADMIN_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pjnxllnncsoroevgfbmt.supabase.co';
  if (serviceKey) {
    return createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabase;
}

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

/** Read locally cached student reports */
export async function getLocalReports(): Promise<StudentReport[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_REPORTS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StudentReport[];
  } catch {
    return [];
  }
}

/** Save reports to local storage */
export async function saveLocalReports(reports: StudentReport[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_REPORTS_STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // Ignore storage failure
  }
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
      // Pack rich metadata into reason payload for standard Postgres table compatibility
      const payloadMeta = {
        type: newReport.type,
        category: newReport.category,
        subjectCode: newReport.subjectCode,
        subjectName: newReport.subjectName,
        reason: newReport.reason,
        customNote: newReport.customNote,
        reporterName: newReport.reporterName,
        reporterStudentId: newReport.reporterStudentId,
        reporterEmail: newReport.reporterEmail,
        status: newReport.status,
      };

      const isPaperUuid =
        newReport.paperId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(newReport.paperId);

      const isUserUuid =
        newReport.reporterStudentId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(newReport.reporterStudentId);

      // Insert to public.reports table
      await supabase.from('reports').insert({
        pyq_id: isPaperUuid ? newReport.paperId : null,
        reporter_id: isUserUuid ? newReport.reporterStudentId : null,
        reason: JSON.stringify(payloadMeta),
        created_at: newReport.createdAt,
      });
    } catch {
      // Cloud sync is best-effort; offline record is preserved
    }
  }

  return { ok: true, reportId };
}

/**
 * Fetch all reports for the Admin APK
 */
export async function fetchReportsForAdmin(): Promise<StudentReport[]> {
  const localList = await getLocalReports();
  if (!isSupabaseConfigured) {
    return localList;
  }

  try {
    const client = getAdminClient();
    const { data, error } = await client
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) {
      return localList;
    }

    const cloudReports: StudentReport[] = data.map((row: Record<string, unknown>) => {
      let parsedMeta: Partial<StudentReport> = {};
      const rawReason = String(row.reason || '');
      if (rawReason.startsWith('{')) {
        try {
          parsedMeta = JSON.parse(rawReason);
        } catch {
          parsedMeta = { reason: rawReason };
        }
      } else {
        parsedMeta = { reason: rawReason };
      }

      return {
        id: String(row.id || `rep_${row.created_at}`),
        type: (parsedMeta.type as any) || (row.pyq_id ? 'pyq' : 'general'),
        category: (parsedMeta.category as any) || (row.pyq_id ? 'PYQ Paper' : 'General Feedback'),
        subjectCode: parsedMeta.subjectCode,
        subjectName: parsedMeta.subjectName,
        paperId: row.pyq_id ? String(row.pyq_id) : undefined,
        reason: parsedMeta.reason || rawReason,
        customNote: parsedMeta.customNote,
        reporterName: parsedMeta.reporterName || 'GBU Student',
        reporterStudentId: parsedMeta.reporterStudentId || (row.reporter_id ? String(row.reporter_id) : 'GBU-SCHOLAR'),
        reporterEmail: parsedMeta.reporterEmail,
        status: (parsedMeta.status as any) || 'pending',
        adminResponse: parsedMeta.adminResponse,
        adminResponseAt: parsedMeta.adminResponseAt,
        createdAt: String(row.created_at || new Date().toISOString()),
      };
    });

    // Merge cloud and local reports
    const map = new Map<string, StudentReport>();
    cloudReports.forEach((r) => map.set(r.id, r));
    localList.forEach((r) => {
      if (!map.has(r.id)) map.set(r.id, r);
    });

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    await saveLocalReports(merged);
    return merged;
  } catch {
    return localList;
  }
}

/**
 * Fetch and synchronize reports for the student app
 */
export async function fetchStudentReports(studentId?: string, email?: string): Promise<StudentReport[]> {
  const localList = await getLocalReports();
  if (!isSupabaseConfigured) {
    return localList;
  }

  try {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) {
      return localList;
    }

    const cloudReports: StudentReport[] = data.map((row: Record<string, unknown>) => {
      let parsedMeta: Partial<StudentReport> = {};
      const rawReason = String(row.reason || '');
      if (rawReason.startsWith('{')) {
        try {
          parsedMeta = JSON.parse(rawReason);
        } catch {
          parsedMeta = { reason: rawReason };
        }
      } else {
        parsedMeta = { reason: rawReason };
      }

      return {
        id: String(row.id || `rep_${row.created_at}`),
        type: (parsedMeta.type as any) || (row.pyq_id ? 'pyq' : 'general'),
        category: (parsedMeta.category as any) || (row.pyq_id ? 'PYQ Paper' : 'General Feedback'),
        subjectCode: parsedMeta.subjectCode,
        subjectName: parsedMeta.subjectName,
        paperId: row.pyq_id ? String(row.pyq_id) : undefined,
        reason: parsedMeta.reason || rawReason,
        customNote: parsedMeta.customNote,
        reporterName: parsedMeta.reporterName || 'GBU Student',
        reporterStudentId: parsedMeta.reporterStudentId || (row.reporter_id ? String(row.reporter_id) : 'GBU-SCHOLAR'),
        reporterEmail: parsedMeta.reporterEmail,
        status: (parsedMeta.status as any) || 'pending',
        adminResponse: parsedMeta.adminResponse,
        adminResponseAt: parsedMeta.adminResponseAt,
        createdAt: String(row.created_at || new Date().toISOString()),
      };
    });

    const map = new Map<string, StudentReport>();
    localList.forEach((r) => map.set(r.id, r));
    cloudReports.forEach((r) => map.set(r.id, r));

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    await saveLocalReports(merged);
    return merged;
  } catch {
    return localList;
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
    const reports = await getLocalReports();
    const updated = reports.map((r) => {
      if (r.id === reportId) {
        return {
          ...r,
          status: newStatus,
          adminResponse: adminResponse.trim(),
          adminResponseAt: new Date().toISOString(),
        };
      }
      return r;
    });
    await saveLocalReports(updated);

    // Sync to Supabase if UUID format
    if (isSupabaseConfigured && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId)) {
      const target = updated.find((r) => r.id === reportId);
      if (target) {
        const payloadMeta = {
          type: target.type,
          category: target.category,
          subjectCode: target.subjectCode,
          subjectName: target.subjectName,
          reason: target.reason,
          customNote: target.customNote,
          reporterName: target.reporterName,
          reporterStudentId: target.reporterStudentId,
          reporterEmail: target.reporterEmail,
          status: target.status,
          adminResponse: target.adminResponse,
          adminResponseAt: target.adminResponseAt,
        };
        const client = getAdminClient();
        await client
          .from('reports')
          .update({ reason: JSON.stringify(payloadMeta) })
          .eq('id', reportId);
      }
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Could not save response.' };
  }
}
