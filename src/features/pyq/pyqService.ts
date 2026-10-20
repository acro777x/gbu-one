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
  /** Public download link; empty for the bundled seed and for pending papers. */
  fileUrl?: string;
}

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
  },
];

export type ExamTypeFilter = 'All' | 'Mid Sem' | 'End Sem' | 'Back Paper';

export function filterPapers(
  papers: PYQItem[],
  query: string,
  school: string,
  semester: string,
  examType: ExamTypeFilter = 'All',
): PYQItem[] {
  const cleanQ = query.trim().toLowerCase();
  return papers.filter((p) => {
    const matchesSearch =
      cleanQ === '' ||
      p.subjectName.toLowerCase().includes(cleanQ) ||
      p.subjectCode.toLowerCase().includes(cleanQ);

    const matchesSchool = school === 'All' || p.school === school;
    const matchesSemester = semester === 'All' || p.semester === semester;
    const matchesExamType = examType === 'All' || p.examType === examType;

    return matchesSearch && matchesSchool && matchesSemester && matchesExamType;
  });
}
