/**
 * GBU Timetable Provider & Diff Engine
 * Integrates with GBU schedule API (https://mygbu.in/schd/api.php?schd=39 / 40)
 * Per docs/DATA_SOURCES.md & docs/ARCHITECTURE.md
 */

export interface ClassRef {
  school: string;
  programme: string;
  programmeCode: string;
  semester: string;
  section: string;
}

export type Slot = {
  id: string;
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = Monday ... 6 = Saturday
  period: number; // 1..10
  start: string; // e.g. "08:30"
  end: string; // e.g. "09:30"
  subject: string;
  subjectCode: string;
  faculty?: string;
  room?: string;
  type?: 'lecture' | 'lab' | 'tutorial';
  isChanged?: boolean;
  changeNote?: string;
  isCancelled?: boolean;
};

export interface Timetable {
  classKey: string;
  fetchedAt: string;
  semesterSessionId: string;
  slots: Slot[];
  source?: 'live' | 'mock';
}

export interface TimetableDiffItem {
  type: 'added' | 'removed' | 'moved' | 'room_changed';
  /**
   * Which attribute of a matched slot changed. `room` when the class moved
   * to another room, `faculty` when the teacher was swapped, `subject` when
   * the subject was renamed and `type` when a lecture became a lab (or the
   * other way round). Absent for `added`, `removed` and `moved`, which are
   * about the slot itself rather than one of its attributes.
   *
   * The `type` stays `room_changed` for every attribute change so that
   * screens which only know the four kinds keep working; read
   * `changedField` to tell them apart.
   */
  changedField?: 'room' | 'faculty' | 'subject' | 'type';
  slot: Slot;
  oldSlot?: Slot;
  message: string;
}

export interface TimetableProvider {
  listClasses(): Promise<ClassRef[]>;
  getTimetable(classKey: string, semesterSessionId?: string): Promise<Timetable>;
}

// Standard period time mapping for GBU (official app runs Periods 1-11)
export const GBU_PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: '08:30', end: '09:30' },
  2: { start: '09:30', end: '10:30' },
  3: { start: '10:30', end: '11:30' },
  4: { start: '11:30', end: '12:30' },
  5: { start: '12:30', end: '01:30' },
  6: { start: '01:30', end: '02:30' },
  7: { start: '02:30', end: '03:30' },
  8: { start: '03:30', end: '04:30' },
  9: { start: '04:30', end: '05:30' },
  10: { start: '05:30', end: '06:30' },
  11: { start: '06:30', end: '07:30' },
};

/**
 * Normalises a value that becomes part of a slot identity.
 */
function slotIdPart(value: string | undefined): string {
  return (value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Gives every slot of a timetable a stable identity inside its class.
 *
 * Neither identifier the university publishes identifies a slot on its own:
 * `TimeTableId` is the same constant ("23001") on every live row and
 * `TTId` repeats whenever the same slot is published twice (GBU sends a
 * second, room-less copy of a slot). The identity is therefore built from
 * the values that make a slot unique - day, period, subject, room and
 * teacher - and slots that are identical in all of them get a counter.
 *
 * The result is stable across polls: an unchanged timetable always
 * produces the same ids, so change markers land on the right slot instead
 * of piling up on one key.
 */
export function buildStableSlotIds(slots: Slot[]): Slot[] {
  const used = new Map<string, number>();
  return slots.map((slot) => {
    const base = [
      `d${slot.day}`,
      `p${slot.period}`,
      slotIdPart(slot.subjectCode || slot.subject),
      slotIdPart(slot.room),
      slotIdPart(slot.faculty),
    ].join('|');
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const id = seen === 0 ? base : `${base}|${seen}`;
    return slot.id === id ? slot : { ...slot, id };
  });
}

// Raw entry format from the Samay API (https://samay.mygbu.in/api.php).
// Verified live 2026-10-20: 4,277 records for schd=39 with NO query params,
// same shape as mygbu.in/schd/api.php?schd=39 (legacy, kept as fallback).
export interface RawGBUTimetableItem {
  TimeTableId: string;
  TTId?: string;
  TT_Day: string;
  TT_Period: string;
  CSF_Id: string;
  Room_Id: string;
  ActivityTag: string;
  RoomName: string;
  Building: string;
  Section_Id: string;
  Subject_Code: string;
  SectionName: string;
  Code: string;
  faculty_id: string;
  TeacherName: string;
  program_id: string;
  program_name: string;
  school: string;
  StudentDepartment: string;
  subject_name: string;
  abbr: string;
  subject_id: string;
  SessionId: string;
}

/**
 * Tells whether a raw row belongs to the session that was asked for.
 *
 * GBU ignores the `schd` query parameter: every request comes back with
 * the rows of the current session (SessionId 39). Asking for another
 * session must therefore not copy the current one - the request is
 * answered with "no data of its own" for that session instead.
 *
 * A row without a session id cannot be attributed to another session, so
 * it is kept.
 */
export function rowBelongsToSession(item: RawGBUTimetableItem, sessionId: string): boolean {
  const rowSession = (item.SessionId || '').trim();
  if (!rowSession) return true;
  return rowSession === sessionId.trim();
}

export interface ParsedClassCode {
  original: string;
  department: 'CSE' | 'ECE' | 'IT' | string;
  departmentName: string;
  programme: string;
  programmeCode: string;
  year: number;
  yearLabel: string;
  semesterRoman: string;
  section: string;
  displayName: string;
}

/**
 * Decodes GBU SectionName codes into programme / year / section.
 * Owner-confirmed scheme + verified against 4,278 live API records:
 *   "<PROGRAMME>-<YEAR_ROMAN>[ <SECTION>]"  e.g. "BCS-II B"
 * - PROGRAMME: BCS = B.Tech CSE, BAI = B.Tech AI, BIT = B.Tech IT,
 *   BEC = B.Tech ECE, BCA, MCA, MBA, ... (see PROGRAMME_DIRECTORY below)
 * - YEAR_ROMAN: I=1st year ... IV=4th year (V=5th for integrated BT).
 * - SECTION: trailing letter, absent when the batch has a single section
 *   ("BAI-II") or when sections share the slot ("MBA II").
 * Real-world quirks handled: "BCS-I-A" vs "BCS-II B" separators, "MBA II"
 * (space, no dash), "BCA-I A", "Ph.D. Biotechnology", weekend "PCW-II".
 */
/**
 * Full programme directory decoded from the live Samay API
 * (distinct Code | program_name | school | StudentDepartment, 2026-10-20).
 * Used by class-setup and by parseGBUClassCode() as the source of truth.
 */
export const PROGRAMME_DIRECTORY: Array<{
  code: string;
  name: string;
  school: string;
  dept: string;
}> = [
  { code: 'BAI', name: 'B.Tech. (Artificial Intelligence)', school: 'SOICT', dept: 'CSE' },
  { code: 'BCA', name: 'B.C.A.', school: 'SOICT', dept: 'IT' },
  { code: 'BCS', name: 'B.Tech (CS)', school: 'SOICT', dept: 'CSE' },
  { code: 'BIT', name: 'B.Tech (IT)', school: 'SOICT', dept: 'IT' },
  { code: 'BEC', name: 'B.Tech (EC)', school: 'SOICT', dept: 'ECE' },
  { code: 'BEC-AIML', name: 'B.Tech ECE AI&ML', school: 'SOICT', dept: 'ECE' },
  { code: 'CSE-Cyber', name: 'B.Tech. CSE Cyber Security', school: 'SOICT', dept: 'CSE' },
  { code: 'CSE-DS', name: 'B.Tech. CSE Data Science', school: 'SOICT', dept: 'CSE' },
  { code: 'CSE-ML', name: 'B.Tech. CSE Machine Learning', school: 'SOICT', dept: 'CSE' },
  { code: 'MCA', name: 'MCA', school: 'SOICT', dept: 'IT' },
  { code: 'MCA-AI', name: 'MCA (AI)', school: 'SOICT', dept: 'IT' },
  { code: 'MDS', name: 'M.Tech. (DS)', school: 'SOICT', dept: 'CSE' },
  { code: 'MTA', name: 'M.Tech. (AIR)', school: 'SOICT', dept: 'CSE' },
  { code: 'MTS', name: 'M.Tech. (SE)', school: 'SOICT', dept: 'CSE' },
  { code: 'PCW', name: 'M.Tech (CSE) Weekend', school: 'SOICT', dept: 'CSE' },
  { code: 'BEE', name: 'B.Tech (Electrical Engineering)', school: 'SOE', dept: 'EE' },
  { code: 'BME', name: 'B.Tech (ME)', school: 'SOE', dept: 'ME' },
  { code: 'BCE', name: 'B.Tech (Civil)', school: 'SOE', dept: 'CE' },
  { code: 'BT', name: 'Int. B.Tech.+M.Tech./M.B.A.-Biotech.', school: 'SOBT', dept: 'BT' },
  { code: 'MBT', name: 'M.Sc. Biotechnology', school: 'SOBT', dept: 'BT' },
  { code: 'MBA', name: 'MBA', school: 'SOM', dept: 'MB' },
  { code: 'BCOM', name: 'B.Com. (Hons)', school: 'SOM', dept: 'MB' },
  { code: 'BAEC', name: 'B.A. (H) Economics', school: 'SOHSS', dept: 'EP' },
  { code: 'BHC', name: 'B.Sc. (H) Chemistry', school: 'SOVSAS', dept: 'CH' },
  { code: 'BHM', name: 'B.Sc. (H) Mathematics', school: 'SOVSAS', dept: 'MA' },
  { code: 'BHP', name: 'B.Sc. (H) Physics', school: 'SOVSAS', dept: 'PH' },
  { code: 'MAC', name: 'M.Sc. (Applied Chemistry)', school: 'SOVSAS', dept: 'CH' },
  { code: 'MAM', name: 'M.Sc. (Applied Mathematics)', school: 'SOVSAS', dept: 'MA' },
  { code: 'MAP', name: 'M.Sc. (Applied Physics)', school: 'SOVSAS', dept: 'PH' },
];

export function lookupProgramme(code: string): { name: string; school: string; dept: string } | null {
  const upper = (code || '').trim().toUpperCase();
  const hit = PROGRAMME_DIRECTORY.find((p) => p.code.toUpperCase() === upper);
  return hit ? { name: hit.name, school: hit.school, dept: hit.dept } : null;
}

/**
 * Live Samay API provider (https://samay.mygbu.in/api.php).
 * Verified 2026-10-20: 4,277 records, no auth, no query params needed;
 * ?schd=<session> selects the session (39 = current). Falls back to the
 * legacy mygbu.in/schd/api.php host, then to bundled mock data.
 */
export const SAMAY_API_BASE = 'https://samay.mygbu.in/api.php';
export const SAMAY_LEGACY_BASE = 'https://mygbu.in/schd/api.php';

function rawToTimetable(
  classKey: string, items: RawGBUTimetableItem[], sessionId: string, source: 'live' | 'mock'
): Timetable {
  const norm = classKey.trim().toUpperCase();
  const slots: Slot[] = [];
  for (const item of items) {
    if ((item.SectionName || '').trim().toUpperCase() !== norm) continue;
    // GBU answers every session request with the current session's rows.
    if (!rowBelongsToSession(item, sessionId)) continue;
    const dayNum = Math.min(7, Math.max(1, parseInt(item.TT_Day, 10) || 1)) as Slot['day'];
    const periodNum = parseInt(item.TT_Period, 10) || 1;
    const timing = GBU_PERIOD_TIMES[periodNum] ?? { start: '08:30', end: '09:30' };
    const tag = (item.ActivityTag || '').toLowerCase();
    const type = tag.includes('lab') || tag.includes('practical')
      ? 'lab' : tag.includes('tut') ? 'tutorial' : 'lecture';
    slots.push({
      id: '',
      day: dayNum,
      period: periodNum,
      start: timing.start,
      end: timing.end,
      subject: (item.subject_name || '').trim() || item.Subject_Code || 'Class',
      subjectCode: (item.Subject_Code || '').trim(),
      faculty: (item.TeacherName || '').trim() || undefined,
      room: (item.RoomName || '').trim() || undefined,
      type,
    });
  }
  const withIds = buildStableSlotIds(slots);
  withIds.sort((a, b) => a.day - b.day || a.period - b.period || a.id.localeCompare(b.id));
  return { classKey: norm, fetchedAt: new Date().toISOString(), semesterSessionId: sessionId, slots: withIds, source };
}

async function fetchSamaySession(sessionId: string): Promise<RawGBUTimetableItem[]> {
  const urls = [
    `${SAMAY_API_BASE}?schd=${sessionId}`,
    `${SAMAY_LEGACY_BASE}?schd=${sessionId}`,
    SAMAY_API_BASE,
  ];
  let lastErr: unknown = null;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) return json as RawGBUTimetableItem[];
      lastErr = new Error(`empty array from ${url}`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Samay fetch failed');
}

const sessionCache = new Map<string, { at: number; items: RawGBUTimetableItem[] }>();
const SESSION_TTL = 30 * 60 * 1000;

export class SamayTimetableProvider implements TimetableProvider {
  async listClasses(): Promise<ClassRef[]> {
    const items = await this.sessionItems('39');
    const seen = new Map<string, ClassRef>();
    for (const r of items) {
      const sec = (r.SectionName || '').trim();
      if (!sec || seen.has(sec.toUpperCase())) continue;
      const parsed = parseGBUClassCode(sec);
      seen.set(sec.toUpperCase(), {
        school: (r.school || '').trim() || parsed.department,
        programme: (r.program_name || '').trim() || parsed.programme,
        programmeCode: (r.Code || '').trim() || parsed.programmeCode,
        semester: parsed.semesterRoman || String(parsed.year),
        section: sec,
      });
    }
    return [...seen.values()].sort((a, b) => a.section.localeCompare(b.section));
  }

  async getTimetable(classKey: string, semesterSessionId = '39'): Promise<Timetable> {
    try {
      const items = await this.sessionItems(semesterSessionId);
      const tt = rawToTimetable(classKey, items, semesterSessionId, 'live');
      if (tt.slots.length > 0) return tt;
      // Section code drift ("BCS-II B" vs "BCS-II-B"): try variants.
      const variants = [
        classKey.replace(/\s+/g, '-'),
        classKey.replace(/-/g, ' '),
        classKey.replace(/\s+/g, ''),
      ];
      for (const v of variants) {
        if (v.toUpperCase() === classKey.trim().toUpperCase()) continue;
        const alt = rawToTimetable(v, items, semesterSessionId, 'live');
        if (alt.slots.length > 0) return { ...alt, classKey: classKey.trim().toUpperCase() };
      }
      return mockTimetableFor(classKey, semesterSessionId);
    } catch {
      return mockTimetableFor(classKey, semesterSessionId);
    }
  }

  private async sessionItems(sessionId: string): Promise<RawGBUTimetableItem[]> {
    const hit = sessionCache.get(sessionId);
    if (hit && Date.now() - hit.at < SESSION_TTL) return hit.items;
    const items = await fetchSamaySession(sessionId);
    sessionCache.set(sessionId, { at: Date.now(), items });
    return items;
  }
}

/**
 * Bundled mock fallback: plausible week grid so the timetable screen always
 * renders offline, even before the first successful Samay fetch.
 */
function mockTimetableFor(classKey: string, sessionId: string): Timetable {
  const norm = classKey.trim().toUpperCase();
  const slots: Slot[] = [];
  const parsed = parseGBUClassCode(norm);
  const pool = MOCK_SUBJECT_POOL[parsed.programmeCode] ?? MOCK_SUBJECT_POOL.BCS;
  const days: Slot['day'][] = [1, 2, 3, 4, 5, 6];
  let k = 0;
  for (const day of days) {
    for (let p = 1; p <= 5; p++) {
      const s = pool[k % pool.length];
      const timing = GBU_PERIOD_TIMES[p];
      slots.push({
        id: 'mock-' + norm + '-' + day + '-' + p,
        day, period: p, start: timing.start, end: timing.end,
        subject: s.name, subjectCode: s.code,
        faculty: s.faculty, room: s.room, type: 'lecture',
      });
      k++;
    }
  }
  return {
    classKey: norm, fetchedAt: new Date().toISOString(),
    semesterSessionId: sessionId, slots, source: 'mock',
  };
}

const MOCK_SUBJECT_POOL: Record<string, Array<{ code: string; name: string; faculty: string; room: string }>> = {
  BCS: [
    { code: 'CSE209', name: 'Operating System', faculty: 'Prashant Gaurav', room: 'IL101' },
    { code: 'CS205', name: 'Data Structure and Algorithms', faculty: 'Faculty', room: 'IL101' },
    { code: 'AI201', name: 'Foundations of AI', faculty: 'Faculty', room: 'IL102' },
  ],
  BAI: [
    { code: 'AI203', name: 'Machine Learning Fundamentals', faculty: 'Dr. Priya Singhal', room: 'IL105' },
  ],
  BEC: [
    { code: 'ECE201', name: 'Signals and Systems', faculty: 'Dr. Vikas Rana', room: 'EC101' },
  ],
};

export function parseGBUClassCode(rawCode: string): ParsedClassCode {
  const code = (rawCode || '').trim();
  // Word-year aliases are accepted ("bcs-second-a", "cse-cs-second") and
  // normalised to roman numerals before parsing.
  let upper = code.toUpperCase();
  upper = upper
    .replace(/\bFIRST\b/g, 'I')
    .replace(/\bSECOND\b/g, 'II')
    .replace(/\bTHIRD\b/g, 'III')
    .replace(/\bFOURTH\b/g, 'IV')
    .replace(/\bFIFTH\b/g, 'V')
    .replace(/\bSIXTH\b/g, 'VI');

  // Split "<PROGRAMME>-<YEAR>[ -/]<SECTION>]":
  // "BCS-II B" | "BCS-I-A" | "MBA II" | "BCA-I A" | "BAI-II" | "PCW-II".
  // Programme itself may contain a dash ("CSE-CS", "BEC-AI").
  let programmeCode = 'BCS';
  let yearPart = 'II';
  let section = 'General';

  // Special-case: no dash at all ("MBA II", "Ph.D. Biotechnology").
  const noDashYear = upper.match(/^([A-Z.]+)\s+([IVX]+)\s*([A-Z]*)\s*$/);
  const dashMatch = upper.match(/^(.+?)-([IVX]+)(?:[\s-]+([A-Z]))?\s*$/);
  const m = dashMatch ?? noDashYear;
  if (m) {
    programmeCode = m[1].replace(/\./g, '').trim();
    yearPart = m[2];
    if (m[3]) section = m[3];
    // Degree-duration tokens are not part of the code ("bcs-3-second").
    programmeCode = programmeCode.replace(/-\d+$/, '').replace(/\s+\d+$/, '');
  } else if (upper) {
    // Unparseable - keep the raw code as the programme, year unknown.
    programmeCode = upper.split(/[\s-]+/)[0];
    yearPart = '';
  }

  // Normalise common aliases seen in the API.
  const ALIASES: Record<string, string> = {
    'CSE-CS': 'CSE-Cyber',
    'MCA-DS': 'MCA',
    'MCA-AI': 'MCA',
    'MT-SE': 'MTS',
    'MT-DS': 'MDS',
    'MT-AIR': 'MTA',
  };
  const aliasHit = ALIASES[programmeCode];
  const directoryHit = lookupProgramme(aliasHit ?? programmeCode);

  let department: string = directoryHit?.dept ?? 'CSE';
  let departmentName = 'Computer Science & Engineering';
  let programme = directoryHit?.name ?? ('B.Tech (' + programmeCode + ')');
  const resolvedCode = programmeCode;

  const ROMAN_TO_YEAR: Record<string, number> = {
    I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6,
  };
  const year = ROMAN_TO_YEAR[yearPart] ?? 0;

  if (!directoryHit) {
    // Heuristic fallback for programmes outside the directory.
    if (upper.includes('BEC') || upper.startsWith('ECE') || upper.includes('VLSI') || upper.includes('RAI')) {
      department = 'ECE';
      departmentName = 'Electronics & Communication Engineering';
      programme = 'B.Tech (Electronics & Communication Engineering)';
    } else if (upper.includes('BIT') || upper.startsWith('IT') || upper.includes('BCA') || upper.includes('MCA')) {
      department = 'IT';
      departmentName = 'Information Technology';
      programme = upper.includes('BCA') ? 'BCA' : upper.includes('MCA') ? 'MCA' : 'B.Tech (Information Technology)';
    }
  } else if (directoryHit.dept === 'ECE') {
    departmentName = 'Electronics & Communication Engineering';
  } else if (directoryHit.dept === 'IT') {
    departmentName = 'Information Technology';
  } else if (directoryHit.dept === 'EE' || directoryHit.dept === 'ME' || directoryHit.dept === 'CE') {
    departmentName = 'School of Engineering';
  } else if (directoryHit.dept === 'BT') {
    departmentName = 'Biotechnology';
  } else if (directoryHit.dept === 'MB') {
    departmentName = 'Management Studies';
  } else if (directoryHit.dept === 'MA' || directoryHit.dept === 'PH' || directoryHit.dept === 'CH') {
    departmentName = 'Applied Sciences';
  }

  const yearLabel = year > 0
    ? year + (year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th') + ' Year'
    : 'Year ?';
  const sectionSuffix = section === 'General' ? '' : ' Section ' + section;

  return {
    original: code,
    department,
    departmentName,
    programme,
    programmeCode: resolvedCode,
    year,
    yearLabel,
    semesterRoman: yearPart,
    section,
    displayName: programme + ' \u2022 ' + yearLabel + sectionSuffix,
  };
};

/**
 * Computes structured diffs between old and new timetable snapshots
 * Per docs/ARCHITECTURE.md section "Timetable change detection"
 *
 * GBU publishes the same logical slot more than once: a class appears as
 * two rows with the same day, period and subject - one carrying the room
 * and one with a null room. Rows are therefore never paired positionally:
 * everything inside a slot is compared as a multiset, so an unchanged
 * timetable produces no diffs at all.
 */
export function computeTimetableDiff(
  oldTimetable: Timetable,
  newTimetable: Timetable,
): TimetableDiffItem[] {
  // Never compare mock against live or vice-versa to prevent false "new class added" alerts
  if (oldTimetable.source === 'mock' || newTimetable.source === 'mock') {
    return [];
  }

  const diffs: TimetableDiffItem[] = [];

  const oldGroups = groupSlotsByKey(oldTimetable.slots);
  const newGroups = groupSlotsByKey(newTimetable.slots);

  // 1. Slots that kept their day, period and subject: compare their
  //    attributes (room, teacher, subject name, lecture/lab).
  const leftoverOldGroups = new Map(oldGroups);
  const leftoverNewGroups = new Map(newGroups);

  for (const [key, newSlots] of newGroups) {
    const oldSlots = oldGroups.get(key);
    if (!oldSlots) continue;
    leftoverOldGroups.delete(key);
    leftoverNewGroups.delete(key);
    diffs.push(...compareSlotAttributes(oldSlots, newSlots));
  }

  // 2. Slots that changed their day or period: they are the same class,
  //    so they are matched by subject.
  const oldGroupsBySubject = indexGroupsBySubject(leftoverOldGroups);
  const remainingOldSlots: Slot[] = [];
  const remainingNewSlots: Slot[] = [];

  for (const newSlots of leftoverNewGroups.values()) {
    const candidates = oldGroupsBySubject.get(subjectKeyOf(newSlots));
    const oldSlots = candidates && candidates.length > 0 ? candidates.shift() : undefined;
    if (!oldSlots) {
      remainingNewSlots.push(...newSlots);
      continue;
    }
    const pairs = Math.min(oldSlots.length, newSlots.length);
    for (let i = 0; i < pairs; i++) {
      diffs.push({
        type: 'moved',
        slot: newSlots[i],
        oldSlot: oldSlots[i],
        message: `${newSlots[i].subject} moved to Day ${newSlots[i].day} at ${newSlots[i].start} (${newSlots[i].room || 'Room TBD'})`,
      });
    }
    remainingOldSlots.push(...oldSlots.slice(pairs));
    remainingNewSlots.push(...newSlots.slice(pairs));
  }

  // 3. The old slots that were never matched are cancelled / removed.
  for (const groups of oldGroupsBySubject.values()) {
    for (const slots of groups) remainingOldSlots.push(...slots);
  }

  // 4. Any remaining new slots are newly added.
  for (const newSlot of remainingNewSlots) {
    diffs.push({
      type: 'added',
      slot: newSlot,
      message: `New class added: ${newSlot.subject} at ${newSlot.start} (${newSlot.room || 'Room TBD'})`,
    });
  }

  // 5. Any remaining old slots are cancelled / removed.
  for (const oldSlot of remainingOldSlots) {
    diffs.push({
      type: 'removed',
      slot: oldSlot,
      oldSlot,
      message: `${oldSlot.subject} on Day ${oldSlot.day} at ${oldSlot.start} was cancelled/removed`,
    });
  }

  return diffs;
}

/**
 * Key of one logical slot: the day, the period and the subject. GBU sends
 * the same slot twice (once with a null room), so this key is what groups
 * the rows of a single class occurrence.
 */
function slotGroupKey(slot: Slot): string {
  return `${slot.day}|${slot.period}|${subjectKeyOf([slot])}`;
}

/** The subject identity of a slot: its code, or its name without a code. */
function subjectKeyOf(slots: Slot[]): string {
  const slot = slots[0];
  if (!slot) return '';
  return (slot.subjectCode || slot.subject || '').trim().toUpperCase();
}

/** Groups the slots of a timetable by their logical slot. */
function groupSlotsByKey(slots: Slot[]): Map<string, Slot[]> {
  const groups = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = slotGroupKey(slot);
    const bucket = groups.get(key);
    if (bucket) bucket.push(slot);
    else groups.set(key, [slot]);
  }
  return groups;
}

/** Indexes slot groups by subject so a moved class can be found. */
function indexGroupsBySubject(groups: Map<string, Slot[]>): Map<string, Slot[][]> {
  const index = new Map<string, Slot[][]>();
  for (const slots of groups.values()) {
    const subject = subjectKeyOf(slots);
    const bucket = index.get(subject);
    if (bucket) bucket.push(slots);
    else index.set(subject, [slots]);
  }
  return index;
}

/** One attribute value of one slot, kept together with its slot. */
interface AttributeValue {
  /** The normalised value used for the comparison. */
  value: string;
  /** The value as the university published it. */
  display: string;
  slot: Slot;
}

/**
 * Collects one attribute of every slot of a group. A slot that does not
 * carry the attribute at all (a row without a room) contributes nothing:
 * it says "unknown", not "no room".
 */
function collectAttribute(
  slots: Slot[],
  pick: (slot: Slot) => string | undefined,
): AttributeValue[] {
  const values: AttributeValue[] = [];
  for (const slot of slots) {
    const display = (pick(slot) || '').trim();
    if (!display) continue;
    values.push({ value: display.toUpperCase(), display, slot });
  }
  values.sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
  return values;
}

/**
 * Pairs the old and the new values of one attribute: equal values cancel
 * out, whatever is left over is a change.
 */
function pairAttributeValues(
  oldValues: AttributeValue[],
  newValues: AttributeValue[],
): Array<{ old?: AttributeValue; new?: AttributeValue }> {
  const remainingOld = [...oldValues];
  const remainingNew = [...newValues];
  for (const candidate of [...remainingNew]) {
    const index = remainingOld.findIndex((old) => old.value === candidate.value);
    if (index === -1) continue;
    remainingOld.splice(index, 1);
    remainingNew.splice(remainingNew.indexOf(candidate), 1);
  }
  const pairs: Array<{ old?: AttributeValue; new?: AttributeValue }> = [];
  const count = Math.max(remainingOld.length, remainingNew.length);
  for (let i = 0; i < count; i++) {
    pairs.push({ old: remainingOld[i], new: remainingNew[i] });
  }
  return pairs;
}

/**
 * Compares the attributes of a slot that stayed in place.
 *
 * Compared attributes and why:
 * - room: students have to know where to go.
 * - faculty: a teacher swap changes who takes the class.
 * - subject: the university sometimes renames a subject in place.
 * - type: a lecture that becomes a lab (or the other way round) changes
 *   the whole shape of the slot.
 */
function compareSlotAttributes(oldSlots: Slot[], newSlots: Slot[]): TimetableDiffItem[] {
  const diffs: TimetableDiffItem[] = [];
  const reference = newSlots[0] || oldSlots[0];

  const pushAttributeDiff = (
    changedField: 'room' | 'faculty' | 'subject' | 'type',
    message: (before: string, after: string, slot: Slot) => string,
  ): void => {
    for (const pair of pairAttributeValues(
      collectAttribute(oldSlots, (slot) => attributeOf(slot, changedField)),
      collectAttribute(newSlots, (slot) => attributeOf(slot, changedField)),
    )) {
      const before = pair.old ? pair.old.display : '';
      const after = pair.new ? pair.new.display : '';
      if (before === after) continue;
      const slot = (pair.new ? pair.new.slot : pair.old ? pair.old.slot : undefined) || reference;
      diffs.push({
        type: 'room_changed',
        changedField,
        slot,
        oldSlot: pair.old ? pair.old.slot : undefined,
        message: message(before, after, slot),
      });
    }
  };

  pushAttributeDiff('room', (before, after, slot) =>
    `${slot.subject} room changed to ${after || 'Room TBD'} (was ${before || 'TBD'})`,
  );
  pushAttributeDiff('faculty', (before, after, slot) =>
    `${slot.subject} teacher changed to ${after || 'TBD'} (was ${before || 'TBD'})`,
  );
  pushAttributeDiff('subject', (before, after) =>
    `Subject renamed to ${after || 'Class'} (was ${before || 'Class'})`,
  );
  pushAttributeDiff('type', (before, after, slot) =>
    `${slot.subject} changed from ${before || 'class'} to ${after || 'class'}`,
  );

  return diffs;
}

/** The attribute a diff is about, as it is written on the slot. */
function attributeOf(slot: Slot, changedField: 'room' | 'faculty' | 'subject' | 'type'): string | undefined {
  switch (changedField) {
    case 'room':
      return slot.room;
    case 'faculty':
      return slot.faculty;
    case 'subject':
      return slot.subject;
    case 'type':
      return slot.type;
    default:
      return undefined;
  }
}

/**
 * Applies detected diffs to a timetable snapshot, marking changed slots with isChanged and changeNote
 */
export function applyDiffsToTimetable(
  timetable: Timetable,
  diffs: TimetableDiffItem[],
): Timetable {
  if (!diffs || diffs.length === 0) return timetable;

  const changedSlotNotes = new Map<string, string>();
  const removedSlots: Slot[] = [];

  for (const d of diffs) {
    if (d.type === 'removed' && d.slot) {
      removedSlots.push({
        ...d.slot,
        id: `cancelled_${d.slot.id}`,
        isChanged: true,
        isCancelled: true,
        changeNote: d.message,
      });
    } else if (d.slot) {
      changedSlotNotes.set(d.slot.id, d.message);
    }
  }

  const updatedSlots = timetable.slots.map((slot) => {
    const note = changedSlotNotes.get(slot.id);
    if (note) {
      return {
        ...slot,
        isChanged: true,
        changeNote: note,
      };
    }
    return slot;
  });

  return {
    ...timetable,
    slots: [...updatedSlots, ...removedSlots],
  };
}

// Fallback mock timetable data matching GBU BCS-II B
export const MOCK_RAW_TIMETABLE: RawGBUTimetableItem[] = [
  {
    TimeTableId: '23001',
    TT_Day: '1',
    TT_Period: '1',
    CSF_Id: '19568',
    Room_Id: '208',
    ActivityTag: 'Lecture',
    RoomName: 'IL101',
    Building: 'SOICT',
    Section_Id: '1299',
    Subject_Code: 'CSE209',
    SectionName: 'BCS-II B',
    Code: 'BCS',
    faculty_id: '2690',
    TeacherName: 'Prashant Gaurav',
    program_id: '1088',
    program_name: 'B.Tech (CS)',
    school: 'SOICT',
    StudentDepartment: 'CSE',
    subject_name: 'Operating System',
    abbr: 'PG',
    subject_id: '15114',
    SessionId: '39',
  },
  {
    TimeTableId: '23002',
    TT_Day: '1',
    TT_Period: '2',
    CSF_Id: '19569',
    Room_Id: '208',
    ActivityTag: 'Lecture',
    RoomName: 'IL101',
    Building: 'SOICT',
    Section_Id: '1299',
    Subject_Code: 'CSE205',
    SectionName: 'BCS-II B',
    Code: 'BCS',
    faculty_id: '2691',
    TeacherName: 'Dr. Arun Sharma',
    program_id: '1088',
    program_name: 'B.Tech (CS)',
    school: 'SOICT',
    StudentDepartment: 'CSE',
    subject_name: 'Data Structures & Algorithms',
    abbr: 'AS',
    subject_id: '15115',
    SessionId: '39',
  },
  {
    TimeTableId: '23003',
    TT_Day: '1',
    TT_Period: '3',
    CSF_Id: '19570',
    Room_Id: '208',
    ActivityTag: 'Lecture',
    RoomName: 'IL101',
    Building: 'SOICT',
    Section_Id: '1299',
    Subject_Code: 'BAS201',
    SectionName: 'BCS-II B',
    Code: 'BCS',
    faculty_id: '2692',
    TeacherName: 'Dr. Neha Gupta',
    program_id: '1088',
    program_name: 'B.Tech (CS)',
    school: 'SOICT',
    StudentDepartment: 'CSE',
    subject_name: 'Discrete Mathematics',
    abbr: 'NG',
    subject_id: '15116',
    SessionId: '39',
  },
  {
    TimeTableId: '23004',
    TT_Day: '1',
    TT_Period: '6',
    CSF_Id: '19571',
    Room_Id: 'LAB02',
    ActivityTag: 'Lab',
    RoomName: 'Lab 2',
    Building: 'SOICT',
    Section_Id: '1299',
    Subject_Code: 'CSE211',
    SectionName: 'BCS-II B',
    Code: 'BCS',
    faculty_id: '2690',
    TeacherName: 'Prashant Gaurav',
    program_id: '1088',
    program_name: 'B.Tech (CS)',
    school: 'SOICT',
    StudentDepartment: 'CSE',
    subject_name: 'OS Lab',
    abbr: 'PG',
    subject_id: '15117',
    SessionId: '39',
  },
  // B.Tech CSE 2nd Year Sec A (BCS-II A)
  {
    TimeTableId: '23101',
    TT_Day: '1',
    TT_Period: '1',
    CSF_Id: '19601',
    Room_Id: '207',
    ActivityTag: 'Lecture',
    RoomName: 'IL102',
    Building: 'SOICT',
    Section_Id: '1298',
    Subject_Code: 'CSE205',
    SectionName: 'BCS-II A',
    Code: 'BCS',
    faculty_id: '2691',
    TeacherName: 'Dr. Arun Sharma',
    program_id: '1088',
    program_name: 'B.Tech (CS)',
    school: 'SOICT',
    StudentDepartment: 'CSE',
    subject_name: 'Data Structures & Algorithms',
    abbr: 'AS',
    subject_id: '15115',
    SessionId: '39',
  },
  {
    TimeTableId: '23102',
    TT_Day: '1',
    TT_Period: '2',
    CSF_Id: '19602',
    Room_Id: '207',
    ActivityTag: 'Lecture',
    RoomName: 'IL102',
    Building: 'SOICT',
    Section_Id: '1298',
    Subject_Code: 'CSE209',
    SectionName: 'BCS-II A',
    Code: 'BCS',
    faculty_id: '2690',
    TeacherName: 'Prashant Gaurav',
    program_id: '1088',
    program_name: 'B.Tech (CS)',
    school: 'SOICT',
    StudentDepartment: 'CSE',
    subject_name: 'Operating System',
    abbr: 'PG',
    subject_id: '15114',
    SessionId: '39',
  },
  // B.Tech AI 2nd Year Sec A (BAI-II A)
  {
    TimeTableId: '23201',
    TT_Day: '1',
    TT_Period: '1',
    CSF_Id: '19701',
    Room_Id: '210',
    ActivityTag: 'Lecture',
    RoomName: 'IL105',
    Building: 'SOICT',
    Section_Id: '1301',
    Subject_Code: 'AI201',
    SectionName: 'BAI-II A',
    Code: 'BAI',
    faculty_id: '2701',
    TeacherName: 'Dr. Rajesh Kumar',
    program_id: '1090',
    program_name: 'B.Tech (AI)',
    school: 'SOICT',
    StudentDepartment: 'CSE',
    subject_name: 'Foundations of Artificial Intelligence',
    abbr: 'RK',
    subject_id: '15201',
    SessionId: '39',
  },
  {
    TimeTableId: '23202',
    TT_Day: '1',
    TT_Period: '2',
    CSF_Id: '19702',
    Room_Id: '210',
    ActivityTag: 'Lecture',
    RoomName: 'IL105',
    Building: 'SOICT',
    Section_Id: '1301',
    Subject_Code: 'AI203',
    SectionName: 'BAI-II A',
    Code: 'BAI',
    faculty_id: '2702',
    TeacherName: 'Dr. Priya Singhal',
    program_id: '1090',
    program_name: 'B.Tech (AI)',
    school: 'SOICT',
    StudentDepartment: 'CSE',
    subject_name: 'Machine Learning Fundamentals',
    abbr: 'PS',
    subject_id: '15202',
    SessionId: '39',
  },
  {
    TimeTableId: '23203',
    TT_Day: '1',
    TT_Period: '3',
    CSF_Id: '19703',
    Room_Id: 'LAB05',
    ActivityTag: 'Lab',
    RoomName: 'AI & Robotics Lab',
    Building: 'SOICT',
    Section_Id: '1301',
    Subject_Code: 'AI211',
    SectionName: 'BAI-II A',
    Code: 'BAI',
    faculty_id: '2701',
    TeacherName: 'Dr. Rajesh Kumar',
    program_id: '1090',
    program_name: 'B.Tech (AI)',
    school: 'SOICT',
    StudentDepartment: 'CSE',
    subject_name: 'AI Programming Lab',
    abbr: 'RK',
    subject_id: '15203',
    SessionId: '39',
  },
  // B.Tech CSE Cyber Security 2nd Year (CSE-CS-II A)
  {
    TimeTableId: '23301',
    TT_Day: '1',
    TT_Period: '1',
    CSF_Id: '19801',
    Room_Id: '212',
    ActivityTag: 'Lecture',
    RoomName: 'IL108',
    Building: 'SOICT',
    Section_Id: '1305',
    Subject_Code: 'CYS201',
    SectionName: 'CSE-CS-II A',
    Code: 'CSE-CS',
    faculty_id: '2710',
    TeacherName: 'Dr. Amit Verma',
    program_id: '1092',
    program_name: 'B.Tech (CSE - Cyber Security)',
    school: 'SOICT',
    StudentDepartment: 'CSE',
    subject_name: 'Information Security & Cryptography',
    abbr: 'AV',
    subject_id: '15301',
    SessionId: '39',
  },
  // B.Tech IT 2nd Year (BIT-II A)
  {
    TimeTableId: '23401',
    TT_Day: '1',
    TT_Period: '1',
    CSF_Id: '19901',
    Room_Id: '215',
    ActivityTag: 'Lecture',
    RoomName: 'IL201',
    Building: 'SOICT',
    Section_Id: '1310',
    Subject_Code: 'IT201',
    SectionName: 'BIT-II A',
    Code: 'BIT',
    faculty_id: '2720',
    TeacherName: 'Dr. Sandeep Sharma',
    program_id: '1095',
    program_name: 'B.Tech (IT)',
    school: 'SOICT',
    StudentDepartment: 'IT',
    subject_name: 'Web Technologies & Frameworks',
    abbr: 'SS',
    subject_id: '15401',
    SessionId: '39',
  },
  // B.Tech ECE 2nd Year (BEC-II A)
  {
    TimeTableId: '23501',
    TT_Day: '1',
    TT_Period: '1',
    CSF_Id: '20001',
    Room_Id: '302',
    ActivityTag: 'Lecture',
    RoomName: 'EC101',
    Building: 'SOICT',
    Section_Id: '1320',
    Subject_Code: 'ECE201',
    SectionName: 'BEC-II A',
    Code: 'BEC',
    faculty_id: '2730',
    TeacherName: 'Dr. Vikas Rana',
    program_id: '1100',
    program_name: 'B.Tech (ECE)',
    school: 'SOICT',
    StudentDepartment: 'ECE',
    subject_name: 'Signals and Systems',
    abbr: 'VR',
    subject_id: '15501',
    SessionId: '39',
  },
];
