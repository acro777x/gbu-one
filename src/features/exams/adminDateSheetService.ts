/**
 * GBU One — Admin Exam Date Sheet Service & Cloud Sync Pipeline.
 *
 * Provides:
 *  1. Document Upload to Supabase Storage.
 *  2. Dual-format (.xlsx, .csv, and PDF) Date Sheet parsing.
 *  3. Dual-write persistence (Postgres `exam_date_slots` + CDN Storage + Local Storage).
 *  4. Manual slot entry and authentic date sheet presets.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  examSlotToRow,
  rowToExamSlot,
  dateSlotKey,
  matchClassKey,
  type ExamDateSlot,
  type DateSlotRow,
} from './examDateSheetParser';
import {
  AUTHENTIC_CSE3_MID_SEM_DATESHEET,
  AUTHENTIC_CSE3_END_SEM_DATESHEET,
  AUTHENTIC_CSE3_PRACTICALS_DATESHEET,
  type DatesheetEntry,
} from './examService';

export const LOCAL_ADMIN_DATE_SLOTS_KEY = '@gbu_one_admin_date_slots';
export const CDN_DATE_SLOTS_URL =
  'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/campus-events/exam_date_slots.json';
export const CDN_DATE_SLOTS_UPLOAD_URL =
  'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/campus-events/exam_date_slots.json';

function getServiceKey(): string {
  return (
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  );
}

/**
 * Uploads a date sheet document (.xlsx, .xls, .csv, or .pdf) to Supabase Storage.
 */
export async function uploadDateSheetDocument(
  fileUri: string,
  fileName: string,
  mimeType?: string,
): Promise<{ ok: boolean; publicUrl?: string; error?: string }> {
  try {
    const ext = fileName.split('.').pop()?.toLowerCase() || 'xlsx';
    const cleanName = `datesheets/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

    const response = await fetch(fileUri);
    const blob = await response.blob();

    const contentType =
      mimeType ||
      (ext === 'pdf'
        ? 'application/pdf'
        : ext === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const { data, error } = await supabase.storage
      .from('pyq-files')
      .upload(cleanName, blob, {
        contentType,
        upsert: true,
      });

    if (error || !data) {
      console.warn('Date sheet upload to storage failed:', error?.message);
      return { ok: false, error: error?.message || 'Storage upload failed' };
    }

    const { data: publicUrlData } = supabase.storage
      .from('pyq-files')
      .getPublicUrl(cleanName);

    return { ok: true, publicUrl: publicUrlData?.publicUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown upload error';
    return { ok: false, error: msg };
  }
}

/**
 * Saves exam date slots to Supabase Postgres, CDN, and local AsyncStorage.
 */
export async function saveExamDateSlots(
  slots: ExamDateSlot[],
): Promise<{ ok: boolean; count: number; error?: string }> {
  if (!slots || slots.length === 0) {
    return { ok: true, count: 0 };
  }

  // 1. Deduplicate by slotKey
  const slotMap = new Map<string, ExamDateSlot>();
  for (const s of slots) {
    slotMap.set(s.slotKey, s);
  }
  const uniqueSlots = Array.from(slotMap.values());
  const rows: DateSlotRow[] = uniqueSlots.map(examSlotToRow);

  // 2. Write to Supabase Postgres `exam_date_slots` table
  if (isSupabaseConfigured) {
    try {
      const BATCH = 100;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { error } = await supabase
          .from('exam_date_slots')
          .upsert(batch, { onConflict: 'slot_key' });
        if (error) {
          console.warn('exam_date_slots table upsert warning:', error.message);
        }
      }
    } catch (err) {
      console.warn('exam_date_slots Postgres error:', err);
    }
  }

  // 3. Write to Cloud Storage CDN for guaranteed delivery
  const serviceKey = getServiceKey();
  try {
    let existingSlots: DateSlotRow[] = [];
    const getRes = await fetch(`${CDN_DATE_SLOTS_URL}?t=${Date.now()}`);
    if (getRes.ok) {
      const cdnData = await getRes.json();
      if (Array.isArray(cdnData)) {
        existingSlots = cdnData;
      }
    }

    const combinedMap = new Map<string, DateSlotRow>();
    for (const r of existingSlots) {
      combinedMap.set(r.slot_key, r);
    }
    for (const r of rows) {
      combinedMap.set(r.slot_key, r);
    }

    const allSlots = Array.from(combinedMap.values());
    const putRes = await fetch(CDN_DATE_SLOTS_UPLOAD_URL, {
      method: 'PUT',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(allSlots),
    });

    if (!putRes.ok && putRes.status === 404) {
      await fetch(CDN_DATE_SLOTS_UPLOAD_URL, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(allSlots),
      });
    }
  } catch (err) {
    console.warn('CDN date slots sync warning:', err);
  }

  // 4. Save to local AsyncStorage
  try {
    const rawLocal = await AsyncStorage.getItem(LOCAL_ADMIN_DATE_SLOTS_KEY);
    const localRows: DateSlotRow[] = rawLocal ? JSON.parse(rawLocal) : [];
    const localMap = new Map<string, DateSlotRow>();
    for (const r of localRows) {
      localMap.set(r.slot_key, r);
    }
    for (const r of rows) {
      localMap.set(r.slot_key, r);
    }
    await AsyncStorage.setItem(
      LOCAL_ADMIN_DATE_SLOTS_KEY,
      JSON.stringify(Array.from(localMap.values())),
    );
  } catch {
    // ignore
  }

  return { ok: true, count: uniqueSlots.length };
}

/**
 * Fetches all exam date slots from Supabase / CDN / Local storage.
 */
export async function fetchAdminDateSlots(filter?: {
  classKey?: string;
  examType?: string;
  schoolCode?: string;
}): Promise<ExamDateSlot[]> {
  const map = new Map<string, ExamDateSlot>();

  // 1. Try Supabase Postgres
  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('exam_date_slots').select('*').order('exam_date', { ascending: true }).limit(500);
      if (filter?.schoolCode) query = query.eq('school_code', filter.schoolCode.toLowerCase());
      if (filter?.examType && filter.examType !== 'all') query = query.eq('exam_type', filter.examType);
      const { data, error } = await query;
      if (!error && data && Array.isArray(data)) {
        for (const r of data as DateSlotRow[]) {
          const slot = rowToExamSlot(r);
          map.set(slot.slotKey, slot);
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Try CDN Storage
  if (map.size === 0) {
    try {
      const res = await fetch(`${CDN_DATE_SLOTS_URL}?t=${Date.now()}`);
      if (res.ok) {
        const cdnRows: DateSlotRow[] = await res.json();
        if (Array.isArray(cdnRows)) {
          for (const r of cdnRows) {
            const slot = rowToExamSlot(r);
            map.set(slot.slotKey, slot);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Fallback to local storage
  if (map.size === 0) {
    try {
      const raw = await AsyncStorage.getItem(LOCAL_ADMIN_DATE_SLOTS_KEY);
      if (raw) {
        const localRows: DateSlotRow[] = JSON.parse(raw);
        if (Array.isArray(localRows)) {
          for (const r of localRows) {
            const slot = rowToExamSlot(r);
            map.set(slot.slotKey, slot);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  let results = Array.from(map.values());

  if (filter?.classKey) {
    results = results.filter((s) => matchClassKey(filter.classKey, s.classKey));
  }
  if (filter?.examType && filter.examType !== 'all') {
    results = results.filter((s) => s.examType === filter.examType);
  }
  if (filter?.schoolCode) {
    results = results.filter((s) => s.schoolCode.toLowerCase() === filter.schoolCode?.toLowerCase());
  }

  return results.sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
}

/**
 * Deletes a date slot by its unique slotKey.
 */
export async function deleteDateSlotByKey(slotKey: string): Promise<boolean> {
  // 1. Supabase Postgres
  if (isSupabaseConfigured) {
    try {
      await supabase.from('exam_date_slots').delete().eq('slot_key', slotKey);
    } catch {
      // ignore
    }
  }

  // 2. Storage CDN
  const serviceKey = getServiceKey();
  try {
    const res = await fetch(`${CDN_DATE_SLOTS_URL}?t=${Date.now()}`);
    if (res.ok) {
      const cdnRows: DateSlotRow[] = await res.json();
      if (Array.isArray(cdnRows)) {
        const updated = cdnRows.filter((r) => r.slot_key !== slotKey);
        await fetch(CDN_DATE_SLOTS_UPLOAD_URL, {
          method: 'PUT',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updated),
        });
      }
    }
  } catch {
    // ignore
  }

  // 3. Local Storage
  try {
    const raw = await AsyncStorage.getItem(LOCAL_ADMIN_DATE_SLOTS_KEY);
    if (raw) {
      const localRows: DateSlotRow[] = JSON.parse(raw);
      if (Array.isArray(localRows)) {
        const updated = localRows.filter((r) => r.slot_key !== slotKey);
        await AsyncStorage.setItem(LOCAL_ADMIN_DATE_SLOTS_KEY, JSON.stringify(updated));
      }
    }
  } catch {
    // ignore
  }

  return true;
}

/** Converts DatesheetEntry preset to ExamDateSlot. */
function entryToSlot(
  e: DatesheetEntry,
  schoolCode: string,
  programme: string,
  classKey: string,
  examType: 'mid_sem' | 'end_sem' | 'practical',
): ExamDateSlot {
  const dateIso = e.examDate.split('T')[0];
  const slot: 'morning' | 'evening' = e.shift.toLowerCase() === 'evening' ? 'evening' : 'morning';
  const key = dateSlotKey(schoolCode, dateIso, slot, e.subjectCode, e.subjectName, classKey);
  return {
    slotKey: key,
    schoolCode,
    programme,
    classKey,
    examDate: dateIso,
    slot,
    shiftTime: e.examTime,
    subjectCode: e.subjectCode,
    subjectName: e.subjectName,
    examType,
    isBackPaper: Boolean(e.isBackPaper),
  };
}

/**
 * Seeds authentic SOICT schedules into the cloud database.
 */
export async function seedAuthenticSchoolSlots(
  type: 'mid_sem' | 'end_sem' | 'practical' = 'mid_sem',
): Promise<number> {
  const slots: ExamDateSlot[] = [];

  if (type === 'mid_sem') {
    for (const e of AUTHENTIC_CSE3_MID_SEM_DATESHEET) {
      slots.push(
        entryToSlot(
          e,
          'soict',
          'B. Tech. (CSE) Batch (2025-2029) 3rd Semester',
          'btech_cse_sem3',
          'mid_sem',
        ),
      );
    }
  } else if (type === 'end_sem') {
    for (const e of AUTHENTIC_CSE3_END_SEM_DATESHEET) {
      slots.push(
        entryToSlot(
          e,
          'soict',
          'B. Tech. (CSE) Batch (2025-2029) 3rd Semester',
          'btech_cse_sem3',
          'end_sem',
        ),
      );
    }
  } else if (type === 'practical') {
    for (const e of AUTHENTIC_CSE3_PRACTICALS_DATESHEET) {
      slots.push(
        entryToSlot(
          e,
          'soict',
          'B. Tech. (CSE) Batch (2025-2029) 3rd Semester',
          'btech_cse_sem3',
          'practical',
        ),
      );
    }
  }

  const res = await saveExamDateSlots(slots);
  return res.count;
}
