/**
 * GBU One — Notice Service, Parser, Classifier & Thread Engine
 * Per docs/DATA_SOURCES.md, docs/ARCHITECTURE.md, docs/NOTIFICATIONS.md
 */

export interface NoticeItem {
  id: string;
  source: 'main' | 'exams' | 'hostel' | 'ohms' | 'csms' | 'digiforms' | 'other';
  sourceId: string;
  title: string;
  cleanTitle: string;
  postedAt: string;
  fileUrl: string;
  fileType: 'pdf' | 'image' | 'html';
  rawText?: string;
  category:
    | 'exam'
    | 'datesheet'
    | 'result'
    | 'fees'
    | 'scholarship'
    | 'hostel'
    | 'admission'
    | 'event'
    | 'academic'
    | 'placement'
    | 'other';
  audience: {
    schools?: string[];
    programmes?: string[];
    semesters?: string[];
    all?: boolean;
  };
  importance: number; // 0 to 5
  deadlineAt?: string | null;
  threadId?: string | null;
  threadUpdateCount?: number;
}

const GBU_SCHOOLS = ['SOICT', 'SOM', 'SOBT', 'SOE', 'SOL', 'SOVSAS', 'SOHSS', 'SOBSC'];

const GBU_PROGRAMMES = [
  'B.Tech',
  'M.Tech',
  'BCA',
  'MCA',
  'MBA',
  'B.Sc',
  'M.Sc',
  'BBA',
  'B.Arch',
  'Ph.D',
];

/**
 * Strips formal administrative prefixes from notice titles for clean presentation
 */
export function cleanNoticeTitle(rawTitle: string): string {
  let cleaned = rawTitle.trim();
  cleaned = cleaned.replace(/^(office\s+order\s*[-:.]?\s*)/i, '');
  cleaned = cleaned.replace(/^(notice\s*[-:.]?\s*)/i, '');
  cleaned = cleaned.replace(/^(notification\s*[-:.]?\s*)/i, '');
  cleaned = cleaned.replace(/^(circular\s*[-:.]?\s*)/i, '');
  cleaned = cleaned.replace(/^(urgent\s+notice\s*[-:.]?\s*)/i, '');
  cleaned = cleaned.replace(/^(regarding\s*[-:.]?\s*)/i, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

/**
 * Classifies notice into semantic categories
 */
export function classifyNotice(title: string): NoticeItem['category'] {
  const lower = title.toLowerCase();

  // Negative categories: administrative, procurement, tenders
  if (
    lower.includes('tender') ||
    lower.includes('quotation') ||
    lower.includes('eoi') ||
    lower.includes('recruitment of faculty') ||
    lower.includes('procurement') ||
    lower.includes('corrigendum for tender') ||
    lower.includes('phd viva-voce')
  ) {
    return 'other';
  }

  if (lower.includes('datesheet') || lower.includes('date sheet')) {
    return 'datesheet';
  }
  if (lower.includes('result') || lower.includes('grade card') || lower.includes('mark sheet') || lower.includes('back paper result')) {
    return 'result';
  }
  if (
    lower.includes('exam') ||
    lower.includes('admit card') ||
    lower.includes('back paper') ||
    lower.includes('mid sem') ||
    lower.includes('end sem') ||
    lower.includes('special back') ||
    lower.includes('supplementary')
  ) {
    return 'exam';
  }
  if (lower.includes('hostel') || lower.includes('mess') || lower.includes('room allotment')) {
    return 'hostel';
  }
  if (lower.includes('scholarship') || lower.includes('fellowship') || lower.includes('freeship')) {
    return 'scholarship';
  }
  if (lower.includes('fee') || lower.includes('dues') || lower.includes('tuition fee') || lower.includes('late fee')) {
    return 'fees';
  }
  if (
    lower.includes('admission') ||
    lower.includes('counselling') ||
    lower.includes('seat allotment') ||
    lower.includes('entrance test')
  ) {
    return 'admission';
  }
  if (
    lower.includes('placement') ||
    lower.includes('internship') ||
    lower.includes('recruitment') ||
    lower.includes('campus drive')
  ) {
    return 'placement';
  }
  if (
    lower.includes('event') ||
    lower.includes('fest') ||
    lower.includes('hackathon') ||
    lower.includes('sports') ||
    lower.includes('competition') ||
    lower.includes('cultural') ||
    lower.includes('convocation')
  ) {
    return 'event';
  }
  if (
    lower.includes('academic calendar') ||
    lower.includes('holiday') ||
    lower.includes('vacation') ||
    lower.includes('semester registration')
  ) {
    return 'academic';
  }

  return 'other';
}

/**
 * Detects targeted audience from notice content
 */
export function detectNoticeAudience(title: string, rawText: string = ''): NoticeItem['audience'] {
  const combined = `${title} ${rawText}`.toUpperCase();
  const schoolsFound: string[] = [];
  const programmesFound: string[] = [];
  const semestersFound: string[] = [];

  for (const s of GBU_SCHOOLS) {
    if (combined.includes(s)) {
      schoolsFound.push(s);
    }
  }

  for (const p of GBU_PROGRAMMES) {
    if (combined.includes(p.toUpperCase())) {
      programmesFound.push(p);
    }
  }

  // Detect semesters like "1st sem", "sem-iv", "semester 3"
  const semMatches = combined.match(/(?:SEM(?:ESTER)?\s*[-:]?\s*([0-9IVX]+)|([0-9]+)(?:ST|ND|RD|TH)\s+SEM)/g);
  if (semMatches) {
    for (const sm of semMatches) {
      const cleanSem = sm.replace(/SEM(?:ESTER)?\s*[-:]?\s*/g, '').replace(/(?:ST|ND|RD|TH)\s+SEM/g, '').trim();
      if (cleanSem && !semestersFound.includes(cleanSem)) {
        semestersFound.push(cleanSem);
      }
    }
  }

  const isSpecific = schoolsFound.length > 0 || programmesFound.length > 0 || semestersFound.length > 0;

  return {
    schools: schoolsFound.length > 0 ? schoolsFound : undefined,
    programmes: programmesFound.length > 0 ? programmesFound : undefined,
    semesters: semestersFound.length > 0 ? semestersFound : undefined,
    all: !isSpecific,
  };
}

/**
 * Extracts deadline ISO date from notice title or body text
 */
export function extractNoticeDeadline(text: string): string | null {
  // Common patterns in university notices:
  // "extended to 31st Oct", "last date 25.10.2026", "by 10-11-2026", "till October 30, 2026"
  const datePatterns = [
    // 31st Oct, 31 October 2026
    /([0-3]?[0-9])(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s*,?\s*([2-9][0-9]{3}))?/i,
    // 31/10/2026 or 31-10-2026
    /([0-3]?[0-9])[/.-]([0-1]?[0-9])[/.-]([2-9][0-9]{3})/i,
    // 2026-10-31
    /([2-9][0-9]{3})[/.-]([0-1]?[0-9])[/.-]([0-3]?[0-9])/i,
  ];

  const lower = text.toLowerCase();
  const hasDeadlineKeyword =
    lower.includes('last date') ||
    lower.includes('deadline') ||
    lower.includes('extended to') ||
    lower.includes('till') ||
    lower.includes('up to') ||
    lower.includes('before');

  for (const regex of datePatterns) {
    const match = text.match(regex);
    if (match) {
      try {
        let year = new Date().getFullYear();
        let month = 9; // October default
        let day = 1;

        if (match[2] && isNaN(Number(match[2]))) {
          // Month name
          const monthMap: Record<string, number> = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
          };
          const prefix = match[2].slice(0, 3).toLowerCase();
          if (prefix in monthMap) {
            month = monthMap[prefix];
          }
          day = parseInt(match[1], 10);
          if (match[3]) year = parseInt(match[3], 10);
        } else if (match[1] && match[2] && match[3]) {
          if (match[1].length === 4) {
            // YYYY-MM-DD
            year = parseInt(match[1], 10);
            month = parseInt(match[2], 10) - 1;
            day = parseInt(match[3], 10);
          } else {
            // DD-MM-YYYY
            day = parseInt(match[1], 10);
            month = parseInt(match[2], 10) - 1;
            year = parseInt(match[3], 10);
          }
        }

        const date = new Date(Date.UTC(year, month, day, 18, 29, 59)); // ~23:59 IST
        return date.toISOString();
      } catch {
        continue;
      }
    }
  }

  // If keyword exists without full date, null fallback
  if (hasDeadlineKeyword) return null;
  return null;
}

/**
 * Calculates importance score (0-5) per docs/NOTIFICATIONS.md
 */
export function calculateNoticeImportance(params: {
  title: string;
  category: NoticeItem['category'];
  deadlineAt?: string | null;
  audience: NoticeItem['audience'];
  postedAt?: string;
}): number {
  let score = 0;

  // Deadline present -> +3
  if (params.deadlineAt) {
    score += 3;
  }

  // High importance student categories -> +3
  if (
    params.category === 'fees' ||
    params.category === 'scholarship' ||
    params.category === 'exam' ||
    params.category === 'datesheet' ||
    params.category === 'result'
  ) {
    score += 3;
  }

  // Mentions specific school or programme -> +2
  if (params.audience.schools || params.audience.programmes) {
    score += 2;
  }

  // Posted recently (within 48 hours) -> +1
  if (params.postedAt) {
    const postAgeMs = Date.now() - new Date(params.postedAt).getTime();
    if (postAgeMs < 48 * 3600 * 1000) {
      score += 1;
    }
  }

  // Non-student tender / procurement / recruitment -> -3
  const lower = params.title.toLowerCase();
  if (
    lower.includes('tender') ||
    lower.includes('recruitment') ||
    lower.includes('quotation') ||
    lower.includes('eoi') ||
    lower.includes('procurement')
  ) {
    score -= 3;
  }

  // Clamp 0 to 5
  return Math.max(0, Math.min(5, score));
}

/**
 * Groups notices into semantic threads (e.g. revisions & deadline extensions)
 */
export function groupNoticeThreads(notices: NoticeItem[]): NoticeItem[] {
  const threadMap = new Map<string, NoticeItem[]>();

  for (const notice of notices) {
    // Normalise topic key: remove dates, edition numbers, and punctuation
    const key = notice.cleanTitle
      .toLowerCase()
      .replace(/(?:extension|extended|revision|revised|corrigendum|amendment|postponed|rescheduled|allotment|list\s*\d+|final|schedule|notice)/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 24);

    const existing = threadMap.get(key) || [];
    existing.push(notice);
    threadMap.set(key, existing);
  }

  return notices.map((notice) => {
    const key = notice.cleanTitle
      .toLowerCase()
      .replace(/(?:extension|extended|revision|revised|corrigendum|amendment|postponed|rescheduled|allotment|list\s*\d+|final|schedule|notice)/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 24);

    const group = threadMap.get(key) || [];
    if (group.length > 1) {
      return {
        ...notice,
        threadId: `th_${key}`,
        threadUpdateCount: group.length,
      };
    }
    return notice;
  });
}

export const MOCK_NOTICES: NoticeItem[] = [
  {
    id: 'not_revised_datesheet',
    source: 'exams',
    sourceId: 'src_exam_midsem_revised_2026',
    title: 'Revised Schedule for Mid Semester Examination Autumn Session 2026-27',
    cleanTitle: 'Revised Mid-Semester Exam Datesheet (Autumn 2026)',
    postedAt: '2026-10-19T08:00:00.000Z',
    fileUrl: 'https://exam.gbu.ac.in',
    fileType: 'pdf',
    rawText:
      'Gautam Buddha University, Greater Noida\nOffice of the Controller (Examinations)\nRevised Schedule for Mid Semester Examination, Autumn Session 2026-27\n\nThe schedule of the Mid Semester Examination for the Autumn Session 2026-27 has been revised. Students are advised to note the revised dates of their papers carefully.\n\nB.Tech (Computer Science) - III Semester\nSubject Code: BCS-301, Data Structures & Algorithms\nDate of Examination: 03 November 2026\nTime: 09:30 AM to 11:00 AM\n\nSubject Code: BCS-302, Operating System\nDate of Examination: 03 November 2026\nTime: 11:30 AM to 01:00 PM\n\nB.Tech (Computer Science) - V Semester\nSubject Code: BCS-501, Compiler Design\nDate of Examination: 05 November 2026\nTime: 09:30 AM to 11:00 AM\n\nNote: The revised schedule supersedes the earlier notification. Candidates must carry their identity card and a printed copy of the admit card. Reporting time is 20 minutes before the start of the paper.\n\nLast Date for reporting: 03 Nov 2026',
    category: 'datesheet',
    audience: { all: true },
    importance: 5,
    deadlineAt: '2026-11-03T09:00:00.000Z',
    threadId: 'th_midsem_autumn_2026',
    threadUpdateCount: 3,
  },
  {
    id: 'not_1',
    source: 'exams',
    sourceId: 'src_exam_midsem_2026',
    title: 'Schedule for Mid Semester Examination Autumn Session 2026-27',
    cleanTitle: 'Mid Sem Exam Datesheet (Autumn 2026) - Official Schedule',
    postedAt: '2026-10-18T10:00:00.000Z',
    fileUrl: 'https://exam.gbu.ac.in',
    fileType: 'pdf',
    category: 'datesheet',
    audience: { all: true },
    importance: 5,
    deadlineAt: '2026-11-03T09:00:00.000Z',
    threadId: 'th_midsem_autumn_2026',
    threadUpdateCount: 2,
  },
  {
    id: 'not_2',
    source: 'main',
    sourceId: 'src_fee_ext_3',
    title: 'Office Order: Final Extension of Fee Submission Date for Monsoon Semester 2026-27',
    cleanTitle: 'Fee Submission Deadline Extended to 31st Oct',
    postedAt: '2026-10-17T14:30:00.000Z',
    fileUrl: 'https://gbu.ac.in/notices',
    fileType: 'pdf',
    rawText:
      'Gautam Buddha University, Greater Noida\nOffice Order\nFinal Extension of Fee Submission Date for Monsoon Semester 2026-27\n\nIn continuation of the earlier notification, the last date for submission of tuition and other fees for the Monsoon Session 2026-27 has been further extended.\n\nLast Date: 31 Oct 2026\n\nStudents are advised to clear all pending dues through the online portal. A late fee will be levied after the last date as per the university norms. Students belonging to reserved categories must submit the required income/category certificates along with the fee receipt.\n\nFor any query, contact the Accounts Office during working hours.',
    category: 'fees',
    audience: { all: true },
    importance: 5,
    deadlineAt: '2026-10-31T23:59:59.000Z',
    threadId: 'th_fee_monsoon_2026',
    threadUpdateCount: 3,
  },
  {
    id: 'not_3',
    source: 'main',
    sourceId: 'src_up_scholarship_2026',
    title: 'Submission of Online Application Form for UP Post Matric Scholarship 2026-27',
    cleanTitle: 'UP Post-Matric Scholarship Form Submission 2026-27',
    postedAt: '2026-10-15T09:15:00.000Z',
    fileUrl: 'https://gbu.ac.in/notices',
    fileType: 'pdf',
    category: 'scholarship',
    audience: { all: true },
    importance: 4,
    deadlineAt: '2026-11-10T17:00:00.000Z',
  },
  {
    id: 'not_4',
    source: 'hostel',
    sourceId: 'src_hostel_allot_2',
    title: 'Second List of Hostel Allotment for Newly Admitted PG Students 2026',
    cleanTitle: 'Hostel Allotment List 2 (PG Students)',
    postedAt: '2026-10-14T16:00:00.000Z',
    fileUrl: 'http://hostels.gbu.ac.in/',
    fileType: 'pdf',
    category: 'hostel',
    audience: { schools: ['SOICT', 'SOM', 'SOBT', 'SOE'] },
    importance: 3,
  },
  {
    id: 'not_5',
    source: 'exams',
    sourceId: 'src_res_backpaper_2026',
    title: 'Declaration of Results on GBU Exam Portal for Special Back Paper 2026',
    cleanTitle: 'Special Back Paper Results Announced (gbuexam.in)',
    postedAt: '2026-10-12T11:45:00.000Z',
    fileUrl: 'https://gbuexam.in',
    fileType: 'pdf',
    category: 'result',
    audience: { all: true },
    importance: 4,
  },
  {
    id: 'not_6',
    source: 'main',
    sourceId: 'src_placement_drive_2026',
    title: 'Corporate Relations Cell (CRC): Campus Placement Drive for B.Tech SOICT 2026 Batch',
    cleanTitle: 'Training & Placement: Campus Placement Drives Announcement',
    postedAt: '2026-10-18T12:00:00.000Z',
    fileUrl: 'https://gbu.ac.in/placements',
    fileType: 'pdf',
    category: 'placement',
    audience: { schools: ['SOICT'], programmes: ['B.Tech', 'MCA', 'M.Tech'] },
    importance: 5,
    deadlineAt: '2026-10-29T18:00:00.000Z',
  },
  {
    id: 'not_7',
    source: 'ohms',
    sourceId: 'src_ohms_room_phase2',
    title: 'OHMS Portal: Phase-2 Hostel Room Reallotment and Repaired Wing Occupancy',
    cleanTitle: 'Phase-2 Hostel Room Reallotment Schedule',
    postedAt: '2026-10-18T10:00:00.000Z',
    fileUrl: 'https://ohms.gbu.ac.in/',
    fileType: 'pdf',
    category: 'hostel',
    audience: { all: true },
    importance: 4,
    deadlineAt: '2026-10-28T17:00:00.000Z',
  },
  {
    id: 'not_8',
    source: 'csms',
    sourceId: 'src_csms_reg_autumn',
    title: 'Mandatory Student Profile Verification & Course Registration on CSMS Portal',
    cleanTitle: 'Mandatory CSMS Profile & Course Registration',
    postedAt: '2026-10-16T08:30:00.000Z',
    fileUrl: 'https://csms.gbu.ac.in/',
    fileType: 'pdf',
    category: 'academic',
    audience: { all: true },
    importance: 5,
    deadlineAt: '2026-11-05T23:59:59.000Z',
  },
  {
    id: 'not_9',
    source: 'digiforms',
    sourceId: 'src_digiforms_tablet_dist',
    title: 'DigiForms Single-Window: Submission for UP Free Tablet/Smartphone Scheme 2026-27',
    cleanTitle: 'DigiForms: UP Smartphone Scheme Distribution Application',
    postedAt: '2026-10-13T15:20:00.000Z',
    fileUrl: 'https://digiforms.gbu.ac.in/',
    fileType: 'pdf',
    category: 'scholarship',
    audience: { all: true },
    importance: 4,
    deadlineAt: '2026-11-15T18:00:00.000Z',
  },
];
