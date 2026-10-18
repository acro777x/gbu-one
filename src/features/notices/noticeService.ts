/**
 * GBU One — Notice Service & Classifier
 * Per docs/DATA_SOURCES.md, docs/ARCHITECTURE.md
 */

export interface NoticeItem {
  id: string;
  source: 'main' | 'exams' | 'hostel' | 'other';
  sourceId: string;
  title: string;
  cleanTitle: string;
  postedAt: string;
  fileUrl: string;
  fileType: 'pdf' | 'image' | 'html';
  rawText?: string;
  category: 'exam' | 'datesheet' | 'result' | 'fees' | 'scholarship' | 'hostel' | 'admission' | 'event' | 'academic' | 'placement' | 'other';
  audience: {
    schools?: string[];
    programmes?: string[];
    semesters?: string[];
    all?: boolean;
  };
  importance: number; // 1 (normal), 2 (important), 3 (critical)
  deadlineAt?: string | null;
  threadId?: string | null;
  threadUpdateCount?: number;
}

export const MOCK_NOTICES: NoticeItem[] = [
  {
    id: 'not_1',
    source: 'exams',
    sourceId: 'src_exam_midsem_2026',
    title: 'Revised Schedule for Mid Semester Examination Autumn 2026',
    cleanTitle: 'Mid Sem Exam Datesheet (Autumn 2026) - Revised',
    postedAt: '2026-10-18T10:00:00.000Z',
    fileUrl: 'https://exams.gbu.ac.in/uploads/notices/mid_sem_autumn_2026.pdf',
    fileType: 'pdf',
    category: 'datesheet',
    audience: { all: true },
    importance: 3,
    deadlineAt: '2026-10-25T17:00:00.000Z',
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
    fileUrl: 'https://test.gbu.ac.in/Admissions/DownloadFile?nName=Fee_Ext_3.pdf',
    fileType: 'pdf',
    category: 'fees',
    audience: { all: true },
    importance: 3,
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
    fileUrl: 'https://test.gbu.ac.in/public/scholarship/notice_up_2026.pdf',
    fileType: 'pdf',
    category: 'scholarship',
    audience: { all: true },
    importance: 2,
    deadlineAt: '2026-11-10T17:00:00.000Z',
  },
  {
    id: 'not_4',
    source: 'hostel',
    sourceId: 'src_hostel_allot_2',
    title: 'Second List of Hostel Allotment for Newly Admitted PG Students 2026',
    cleanTitle: 'Hostel Allotment List 2 (PG Students)',
    postedAt: '2026-10-14T16:00:00.000Z',
    fileUrl: 'http://hostels.gbu.ac.in/allotment_list_2.pdf',
    fileType: 'pdf',
    category: 'hostel',
    audience: { schools: ['SOICT', 'SOM', 'SOBT', 'SOE'] },
    importance: 2,
  },
  {
    id: 'not_5',
    source: 'exams',
    sourceId: 'src_res_backpaper_2026',
    title: 'Declaration of Results for Special Back Paper Examination September 2026',
    cleanTitle: 'Special Back Paper Results Announced',
    postedAt: '2026-10-12T11:45:00.000Z',
    fileUrl: 'https://exams.gbu.ac.in/uploads/notices/special_back_results_2026.pdf',
    fileType: 'pdf',
    category: 'result',
    audience: { all: true },
    importance: 2,
  },
  {
    id: 'not_6',
    source: 'main',
    sourceId: 'src_event_hack_2026',
    title: 'GBU Annual Hackathon & Tech Fest "Abhivyanjana 2026" - Call for Registrations',
    cleanTitle: 'Annual Hackathon "Abhivyanjana 2026" Registrations Open',
    postedAt: '2026-10-10T12:00:00.000Z',
    fileUrl: 'https://test.gbu.ac.in/events/abhivyanjana_2026.pdf',
    fileType: 'pdf',
    category: 'event',
    audience: { all: true },
    importance: 1,
  },
];

export function classifyNotice(title: string): NoticeItem['category'] {
  const lower = title.toLowerCase();
  if (lower.includes('datesheet') || lower.includes('date sheet')) return 'datesheet';
  if (lower.includes('result')) return 'result';
  if (lower.includes('exam') || lower.includes('back paper') || lower.includes('mid sem') || lower.includes('end sem')) return 'exam';
  if (lower.includes('hostel') || lower.includes('mess')) return 'hostel';
  if (lower.includes('scholarship')) return 'scholarship';
  if (lower.includes('fee') || lower.includes('dues')) return 'fees';
  if (lower.includes('admission') || lower.includes('counselling') || lower.includes('seat allotment')) return 'admission';
  if (lower.includes('event') || lower.includes('fest') || lower.includes('hackathon') || lower.includes('sports') || lower.includes('competition')) return 'event';
  if (lower.includes('placement') || lower.includes('internship') || lower.includes('recruitment')) return 'placement';
  if (lower.includes('academic') || lower.includes('calendar') || lower.includes('holiday') || lower.includes('vacation')) return 'academic';
  return 'other';
}
