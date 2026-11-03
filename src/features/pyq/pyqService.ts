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
  /** Public download link; populated only when an authentic paper file exists. */
  fileUrl?: string;
  /** Explicit indicator whether an authentic paper file has been uploaded. */
  hasFile?: boolean;
}

export const SAMPLE_PAPER_URL =
  'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOBT/UFS/I/BTBFS101/2026-MID-SEM-cc12b1aa-4e88-55aa-82ea-102364169073.pdf';

export const MOCK_PAPERS: PYQItem[] = [
  {
    id: 'p_btbfs101',
    school: 'SOBT',
    programme: 'UFS',
    semester: 'Sem I',
    subjectCode: 'BTBFS101',
    subjectName: 'Physics for Biotechnology',
    year: 2026,
    examType: 'Mid Sem',
    downloads: 342,
    status: 'approved',
    fileUrl: SAMPLE_PAPER_URL,
    hasFile: true,
  },
  {
    id: 'p1',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem II',
    subjectCode: 'CSE205',
    subjectName: 'Data Structures & Algorithms',
    year: 2024,
    examType: 'End Sem',
    downloads: 320,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/BCS/II/CS205/2023-END-SEM-e58c450283aa5cbf7c48b36aa786daae.pdf',
    hasFile: true,
  },
  {
    id: 'p2',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem II',
    subjectCode: 'CSE209',
    subjectName: 'Operating Systems',
    year: 2024,
    examType: 'Mid Sem',
    downloads: 294,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/BCS/II/CSE209/2024-MID-SEM-50f42cc6da00db97d94881ee182242bd.pdf',
    hasFile: true,
  },
  {
    id: 'p3',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem II',
    subjectCode: 'BAS201',
    subjectName: 'Discrete Mathematics',
    year: 2023,
    examType: 'End Sem',
    downloads: 185,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/BCS/II/CS212/2023-END-SEM-ef432d9467946c75cbb29028b95cc426.pdf',
    hasFile: true,
  },
  {
    id: 'p4',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem II',
    subjectCode: 'CSE201',
    subjectName: 'Object Oriented Programming with Java',
    year: 2024,
    examType: 'End Sem',
    downloads: 240,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/BCS/II/CSE201/2024-END-SEM-22d777c9167d6e5bfcb2f953ed495c7c.pdf',
    hasFile: true,
  },
  {
    id: 'p5',
    school: 'SOICT',
    programme: 'BCA',
    semester: 'Sem I',
    subjectCode: 'CSE207',
    subjectName: 'Computer Organization & Architecture',
    year: 2024,
    examType: 'End Sem',
    downloads: 192,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/BCS/I/CSE207/2024-END-SEM-5e161ae80d1eb16ee2738a2f6082a360.pdf',
    hasFile: true,
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
    hasFile: false,
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
    hasFile: false,
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
    hasFile: false,
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
    hasFile: false,
  },
  {
    id: 'p10',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem I',
    subjectCode: 'EC101',
    subjectName: 'Basic Electronics Engineering',
    year: 2024,
    examType: 'End Sem',
    downloads: 245,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/BCS/I/EC101/2024-END-SEM-b87b227f8ac98bc2fd0b426db0d12e32.pdf',
    hasFile: true,
  },
  {
    id: 'p11',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem I',
    subjectCode: 'EN101',
    subjectName: 'English Proficiency',
    year: 2024,
    examType: 'End Sem',
    downloads: 195,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/BCS/I/EN101/2024-END-SEM-a4367ebb11db9ef2cf9bd9d3a7f4cb92.pdf',
    hasFile: true,
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
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/BCS/I/ES101/2023-MID-SEM-d9ea89d3d8ca998bb9820548e034d339.pdf',
    hasFile: true,
  },
  {
    id: 'p13',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem III',
    subjectCode: 'MA201',
    subjectName: 'Engineering Mathematics III',
    year: 2024,
    examType: 'Mid Sem',
    downloads: 310,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/BCS/III/MA201/2024-MID-SEM-555720c2208417adef07a4be5ab27566.pdf',
    hasFile: true,
  },
  {
    id: 'p14',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem III',
    subjectCode: 'CS303',
    subjectName: 'Compiler Design',
    year: 2023,
    examType: 'End Sem',
    downloads: 225,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/BCS/III/CS303/2023-END-SEM-976015abd9cf0f1e4f846dbc3593501e.pdf',
    hasFile: true,
  },
  {
    id: 'p15',
    school: 'SOICT',
    programme: 'B.Tech CS',
    semester: 'Sem III',
    subjectCode: 'CS307',
    subjectName: 'Python Programming',
    year: 2022,
    examType: 'Mid Sem',
    downloads: 289,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/BCS/III/CS307/2022-MID-SEM-8d6a6690654993421e949dfb934c8d11.pdf',
    hasFile: true,
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
    hasFile: false,
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
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/BIT/III/IT311/2025-END-SEM-580a2501-cdca-5a03-8389-84f10125e747.jpg',
    hasFile: true,
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
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/BCA/III/BCA315/2026-END-SEM-a8f00521-ccc9-5a6b-849f-bb1afcdb990c.pdf',
    hasFile: true,
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
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOVSAS/UFT/I/FTMA101/2025-END-SEM-ed86009c-3fac-5321-8f30-e2f27e9881c0.pdf',
    hasFile: true,
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
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOVSAS/BHP/I/PH111/2025-END-SEM-7d887b12-1b03-5934-8f45-589faece29f1.pdf',
    hasFile: true,
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
    hasFile: false,
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
    hasFile: false,
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
    hasFile: false,
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
    hasFile: false,
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
    hasFile: false,
  },
  {
    id: 'p_bca101',
    school: 'SOICT',
    programme: 'BCA',
    semester: 'Sem I',
    subjectCode: 'BCA101',
    subjectName: 'Computer Fundamentals and Programming',
    year: 2025,
    examType: 'End Sem',
    downloads: 280,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/BCA/I/BCA101/2025-END-SEM-5aa297ca-116d-5e0f-881d-48e06d50ba32.pdf',
    hasFile: true,
  },
  {
    id: 'p_cs325',
    school: 'SOICT',
    programme: 'ICS',
    semester: 'Sem III',
    subjectCode: 'CS325',
    subjectName: 'Graph Theory',
    year: 2023,
    examType: 'Mid Sem',
    downloads: 195,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/ICS/III/CS325/2023-MID-SEM-51a38b9a-c7ee-5c6e-84e2-bd03e318092e.pdf',
    hasFile: true,
  },
  {
    id: 'p_mcb003',
    school: 'SOICT',
    programme: 'MCA',
    semester: 'Sem I',
    subjectCode: 'MCB003',
    subjectName: 'Introduction to Internet Technology',
    year: 2024,
    examType: 'Mid Sem',
    downloads: 165,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/MCA/I/MCB003/2024-MID-SEM-dfef1582-d575-5f40-8c82-590542db4203.pdf',
    hasFile: true,
  },
  {
    id: 'p_mds203',
    school: 'SOICT',
    programme: 'MCA',
    semester: 'Sem II',
    subjectCode: 'MDS203',
    subjectName: 'R Programming',
    year: 2024,
    examType: 'Mid Sem',
    downloads: 155,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/MCA/II/MDS203/2024-MID-SEM-1ea728fa-b691-5375-87d7-d1f9abd0649d.pdf',
    hasFile: true,
  },
  {
    id: 'p_it409',
    school: 'SOICT',
    programme: 'BIT',
    semester: 'Sem IV',
    subjectCode: 'IT409',
    subjectName: 'Mobile Computing',
    year: 2025,
    examType: 'End Sem',
    downloads: 170,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/BIT/IV/IT409/2025-END-SEM-509402c0-59bf-5976-875e-23ff320d8035.jpg',
    hasFile: true,
  },
  {
    id: 'p_mds101',
    school: 'SOICT',
    programme: 'MCA',
    semester: 'Sem I',
    subjectCode: 'MDS101',
    subjectName: 'Data Science',
    year: 2024,
    examType: 'Mid Sem',
    downloads: 210,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/MCA/I/MDS101/2024-MID-SEM-387b8ce2-5b6d-519c-8010-3c220e0cad2b.pdf',
    hasFile: true,
  },
  {
    id: 'p_it301',
    school: 'SOICT',
    programme: 'BIT',
    semester: 'Sem III',
    subjectCode: 'IT301',
    subjectName: 'Theory of Automata',
    year: 2025,
    examType: 'End Sem',
    downloads: 220,
    status: 'approved',
    fileUrl: 'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/pyq/SOICT/BIT/III/IT301/2025-END-SEM-ddfe3d12-9d4d-5ecd-8b3d-2cbe2fe0facf.pdf',
    hasFile: true,
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
      hasFile: false,
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

