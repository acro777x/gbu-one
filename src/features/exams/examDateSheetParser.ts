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

/** Deterministic slot key for database idempotency. */
export function dateSlotKey(
  schoolCode: string,
  examDate: string,
  slot: string,
  subjectCode: string,
  subjectName: string,
  classKey?: string,
): string {
  const parts = classKey
    ? ['datesheet', schoolCode, classKey, examDate, slot, subjectCode, subjectName]
    : ['datesheet', schoolCode, examDate, slot, subjectCode, subjectName];
  return parts
    .join(':')
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/**
 * Builds canonical class key (e.g. "btech_cse_sem3") from programme text and semester.
 */
export function buildClassKey(programmeText: string, explicitSemester?: string | number | null): string {
  const text = (programmeText || '').trim().toLowerCase();

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

  if (semNumber === null) {
    const semMatch =
      text.match(/(\d+)(?:st|nd|rd|th)?\s*(?:sem|semester)/i) ||
      text.match(/(?:sem|semester)\s*[-:_]?\s*(\d+|[ivx]+)/i) ||
      text.match(/(?:_|-|\s)(\d+)$/) ||
      text.match(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/i);

    if (semMatch) {
      const raw = semMatch[1].toLowerCase();
      semNumber = ROMAN_MAP[raw] || parseInt(raw, 10) || null;
    }
  }

  // 2. Determine programme prefix
  let progSlug = '';
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

  return semNumber !== null ? `${progSlug}_sem${semNumber}` : progSlug;
}

/**
 * Checks whether a student's class selection matches a date slot's class key.
 */
export function matchClassKey(studentKey?: string | null, slotKey?: string | null): boolean {
  if (!studentKey || !slotKey) return false;
  const sNorm = studentKey.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const dNorm = slotKey.trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (sNorm === dNorm) return true;

  const sCanon = buildClassKey(studentKey);
  const dCanon = buildClassKey(slotKey);
  if (sCanon && dCanon && sCanon === dCanon) return true;

  // Handle aliases like bcs_sem3 vs btech_cse_sem3
  const aliasMap: Record<string, string> = {
    bcs: 'btech_cse',
    btech_cs: 'btech_cse',
    btech_cse: 'btech_cse',
    bca: 'bca',
    mca: 'mca',
  };

  const sBase = sCanon.replace(/_sem\d+$/, '');
  const dBase = dCanon.replace(/_sem\d+$/, '');
  const sSem = sCanon.match(/_sem\d+$/)?.[0];
  const dSem = dCanon.match(/_sem\d+$/)?.[0];

  if (sSem && dSem && sSem === dSem) {
    if ((aliasMap[sBase] || sBase) === (aliasMap[dBase] || dBase)) {
      return true;
    }
  }

  return false;
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
        const classKey = buildClassKey(fullProg, semRaw);

        const paperId = flatColMap.paperId >= 0 ? String(row[flatColMap.paperId] || '').trim() : undefined;
        const isBackPaper = /\b(back|repeat)\s*paper\b/i.test(nameRaw) || /\b(back|repeat)\s*paper\b/i.test(codeRaw);

        const key = dateSlotKey(detectedSchool, examDate, slot, codeRaw, nameRaw || codeRaw, classKey);

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

          const classKey = buildClassKey(currentProgramme);

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
              classKey,
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
