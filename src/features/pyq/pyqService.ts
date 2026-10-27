/**
 * GBU One — PYQ Service & Filter Engine
 * Per docs/ROADMAP.md Phase 4 & docs/ARCHITECTURE.md
 */

export interface PYQItem {
  id: string;
  school: string;
  programme: string;
  semester: string;
  subjectCode: string;
  subjectName: string;
  year: number;
  examType: 'Mid Sem' | 'End Sem' | 'Back Paper';
  downloads: number;
  status: 'approved' | 'pending';
  /** Public download link; populated for approved papers and offline sample fallback. */
  fileUrl?: string;
}

export const SAMPLE_PAPER_URL =
  'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOBT/UFS/I/BTBFS101/2026-MID-SEM-cc12b1aa-4e88-55aa-82ea-102364169073.pdf';

export const MOCK_PAPERS: PYQItem[] = [
  {
    id: 'p1',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem II',
    subjectCode: 'CSE205',
    subjectName: 'Data Structures & Algorithms',
    year: 2025,
    examType: 'Mid Sem',
    downloads: 320,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p2',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem II',
    subjectCode: 'CSE209',
    subjectName: 'Operating Systems',
    year: 2025,
    examType: 'End Sem',
    downloads: 294,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p3',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem II',
    subjectCode: 'BAS201',
    subjectName: 'Discrete Mathematics',
    year: 2024,
    examType: 'End Sem',
    downloads: 185,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p4',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem IV',
    subjectCode: 'CSE201',
    subjectName: 'Object Oriented Programming with Java',
    year: 2025,
    examType: 'Mid Sem',
    downloads: 240,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p5',
    school: 'SOICT',
    programme: 'BCA',
    semester: 'Sem I',
    subjectCode: 'CSE207',
    subjectName: 'Computer Organization & Architecture',
    year: 2024,
    examType: 'Back Paper',
    downloads: 92,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p6',
    school: 'SOM',
    programme: 'MBA',
    semester: 'Sem I',
    subjectCode: 'MGT101',
    subjectName: 'Principles of Management & Organization',
    year: 2025,
    examType: 'End Sem',
    downloads: 164,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p7',
    school: 'SOBT',
    programme: 'B.Tech BT',
    semester: 'Sem II',
    subjectCode: 'BIO203',
    subjectName: 'Cell Biology and Genetics',
    year: 2025,
    examType: 'Mid Sem',
    downloads: 118,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p8',
    school: 'SOE',
    programme: 'B.Tech EE',
    semester: 'Sem II',
    subjectCode: 'ELE202',
    subjectName: 'Network Analysis & Synthesis',
    year: 2024,
    examType: 'End Sem',
    downloads: 142,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p9',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem I',
    subjectCode: 'CS101',
    subjectName: 'Problem Solving Using C',
    year: 2025,
    examType: 'End Sem',
    downloads: 278,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p10',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem I',
    subjectCode: 'EC101',
    subjectName: 'Basic Electronics Engineering',
    year: 2025,
    examType: 'End Sem',
    downloads: 245,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p11',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem I',
    subjectCode: 'EN101',
    subjectName: 'English Proficiency',
    year: 2025,
    examType: 'End Sem',
    downloads: 195,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p12',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem I',
    subjectCode: 'ES101',
    subjectName: 'Environmental Studies',
    year: 2023,
    examType: 'Mid Sem',
    downloads: 162,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p13',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem III',
    subjectCode: 'MA201',
    subjectName: 'Engineering Mathematics III',
    year: 2025,
    examType: 'End Sem',
    downloads: 310,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p14',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem V',
    subjectCode: 'CS303',
    subjectName: 'Compiler Design',
    year: 2025,
    examType: 'End Sem',
    downloads: 225,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p15',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem V',
    subjectCode: 'CS307',
    subjectName: 'Python Programming',
    year: 2022,
    examType: 'Mid Sem',
    downloads: 289,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p16',
    school: 'SOICT',
    programme: 'MCA',
    semester: 'Sem I',
    subjectCode: 'CS521',
    subjectName: 'Advanced Database Management System',
    year: 2024,
    examType: 'End Sem',
    downloads: 140,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p17',
    school: 'SOICT',
    programme: 'BIT',
    semester: 'Sem III',
    subjectCode: 'IT311',
    subjectName: 'Advanced Communication Systems',
    year: 2025,
    examType: 'End Sem',
    downloads: 132,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p18',
    school: 'SOICT',
    programme: 'BCA',
    semester: 'Sem III',
    subjectCode: 'BCA315',
    subjectName: 'Fundamentals of Cyber Security',
    year: 2026,
    examType: 'End Sem',
    downloads: 175,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p19',
    school: 'SOVSAS',
    programme: 'UFT',
    semester: 'Sem I',
    subjectCode: 'FTMA101',
    subjectName: 'Engineering Mathematics I',
    year: 2025,
    examType: 'End Sem',
    downloads: 168,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p20',
    school: 'SOVSAS',
    programme: 'BHP',
    semester: 'Sem I',
    subjectCode: 'PH111',
    subjectName: 'Mechanics',
    year: 2025,
    examType: 'End Sem',
    downloads: 147,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p21',
    school: 'SOE',
    programme: 'B.Tech ME',
    semester: 'Sem III',
    subjectCode: 'ME201',
    subjectName: 'Thermodynamics & Heat Transfer',
    year: 2024,
    examType: 'Mid Sem',
    downloads: 153,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p22',
    school: 'SOE',
    programme: 'B.Tech CE',
    semester: 'Sem IV',
    subjectCode: 'CE204',
    subjectName: 'Structural Analysis',
    year: 2025,
    examType: 'End Sem',
    downloads: 138,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p23',
    school: 'SOM',
    programme: 'BBA',
    semester: 'Sem II',
    subjectCode: 'MGT104',
    subjectName: 'Business Economics & Financial Accounting',
    year: 2025,
    examType: 'Mid Sem',
    downloads: 180,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p24',
    school: 'SOBT',
    programme: 'B.Tech BT',
    semester: 'Sem IV',
    subjectCode: 'BIO206',
    subjectName: 'Microbiology & Immunology',
    year: 2025,
    examType: 'End Sem',
    downloads: 165,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
  {
    id: 'p25',
    school: 'SOL',
    programme: 'BA LLB',
    semester: 'Sem II',
    subjectCode: 'LAW102',
    subjectName: 'Constitutional Law of India I',
    year: 2025,
    examType: 'End Sem',
    downloads: 215,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
  },
];

export type ExamTypeFilter = 'All' | 'Mid Sem' | 'End Sem' | 'Back Paper';

import { UNIVERSITY_SUBJECT_CATALOGUE } from './subjectCatalogue';

const ARABIC_TO_ROMAN_SEM: Record<string, string> = {
  '1': 'I',
  '2': 'II',
  '3': 'III',
  '4': 'IV',
  '5': 'V',
  '6': 'VI',
  '7': 'VII',
  '8': 'VIII',
};

export function normalizeSemester(sem?: string): string {
  if (!sem) return 'Sem I';
  const clean = sem.trim().toUpperCase().replace(/^SEM\s*/, '');
  const roman = ARABIC_TO_ROMAN_SEM[clean] || clean;
  return `Sem ${roman}`;
}

export function buildCataloguePapers(): PYQItem[] {
  const existingCodes = new Set(MOCK_PAPERS.map((p) => p.subjectCode.toUpperCase()));
  const extra: PYQItem[] = [];

  for (const sub of UNIVERSITY_SUBJECT_CATALOGUE) {
    const codeUpper = sub.code.trim().toUpperCase();
    if (existingCodes.has(codeUpper)) continue;
    existingCodes.add(codeUpper);

    const sem = sub.sems && sub.sems.length > 0 ? normalizeSemester(sub.sems[0]) : 'Sem I';
    const prog = sub.progs && sub.progs.length > 0 ? sub.progs[0] : (sub.school || 'GEN');

    extra.push({
      id: `cat_${sub.code.toLowerCase()}`,
      school: sub.school,
      programme: prog,
      semester: sem,
      subjectCode: sub.code.trim(),
      subjectName: sub.name.trim(),
      year: 2025,
      examType: 'End Sem',
      downloads: (sub.code.length * 13) % 40 + 15,
      status: 'approved',
      fileUrl: SAMPLE_PAPER_URL,
    });
  }

  return [...MOCK_PAPERS, ...extra];
}

export const FULL_CATALOGUE_PAPERS: PYQItem[] = buildCataloguePapers();

export function filterPapers(
  papers: PYQItem[],
  query: string,
  school: string,
  semester: string,
  examType: ExamTypeFilter = 'All',
  subjectCode = 'All',
): PYQItem[] {
  const cleanQ = query.trim().toLowerCase();
  const cleanSem = semester === 'All' ? 'All' : normalizeSemester(semester);
  return papers.filter((p) => {
    const matchesSearch =
      cleanQ === '' ||
      p.subjectName.toLowerCase().includes(cleanQ) ||
      p.subjectCode.toLowerCase().includes(cleanQ);

    const matchesSchool = school === 'All' || p.school.toUpperCase() === school.toUpperCase();
    const matchesSemester =
      semester === 'All' ||
      p.semester === semester ||
      normalizeSemester(p.semester) === cleanSem;
    const matchesExamType = examType === 'All' || p.examType === examType;
    const matchesSubject = subjectCode === 'All' || p.subjectCode.toUpperCase() === subjectCode.toUpperCase();

    return matchesSearch && matchesSchool && matchesSemester && matchesExamType && matchesSubject;
  });
}

