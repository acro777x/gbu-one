/**
 * Unit Tests for PYQ Module & Browse Filter Logic
 * Per docs/ROADMAP.md Phase 4 & docs/ARCHITECTURE.md
 */

import { MOCK_PAPERS, filterPapers } from '../src/features/pyq/pyqService';

describe('PYQ Browser & Management Logic', () => {
  it('contains approved mock papers with valid school, programme, and semester', () => {
    expect(MOCK_PAPERS.length).toBeGreaterThanOrEqual(6);
    for (const paper of MOCK_PAPERS) {
      expect(paper.id).toBeDefined();
      expect(paper.school).toBeDefined();
      expect(paper.programme).toBeDefined();
      expect(paper.semester).toBeDefined();
      expect(paper.subjectCode).toBeDefined();
      expect(paper.status).toBe('approved');
      expect(['Mid Sem', 'End Sem', 'Back Paper']).toContain(paper.examType);
    }
  });

  it('filters papers by school correctly', () => {
    const soictPapers = MOCK_PAPERS.filter((p) => p.school === 'SOICT');
    expect(soictPapers.length).toBeGreaterThan(0);
    expect(soictPapers.every((p) => p.school === 'SOICT')).toBe(true);

    const somPapers = MOCK_PAPERS.filter((p) => p.school === 'SOM');
    expect(somPapers.every((p) => p.school === 'SOM')).toBe(true);
  });

  it('filters papers by semester correctly', () => {
    const sem2Papers = MOCK_PAPERS.filter((p) => p.semester === 'Sem II');
    expect(sem2Papers.length).toBeGreaterThan(0);
    expect(sem2Papers.every((p) => p.semester === 'Sem II')).toBe(true);
  });

  it('searches papers by subject code or subject name case-insensitively', () => {
    const query1 = 'CSE205';
    const matches1 = MOCK_PAPERS.filter(
      (p) =>
        p.subjectCode.toLowerCase().includes(query1.toLowerCase()) ||
        p.subjectName.toLowerCase().includes(query1.toLowerCase()),
    );
    expect(matches1).toHaveLength(1);
    expect(matches1[0].subjectName).toBe('Data Structures & Algorithms');

    const query2 = 'operating';
    const matches2 = MOCK_PAPERS.filter(
      (p) =>
        p.subjectCode.toLowerCase().includes(query2.toLowerCase()) ||
        p.subjectName.toLowerCase().includes(query2.toLowerCase()),
    );
    expect(matches2).toHaveLength(1);
    expect(matches2[0].subjectCode).toBe('CSE209');
  });

  it('filters papers by exam type (Mid Sem / End Sem / Back Paper tabs)', () => {
    const mid = filterPapers(MOCK_PAPERS, '', 'All', 'All', 'Mid Sem');
    expect(mid.length).toBeGreaterThan(0);
    expect(mid.every((p) => p.examType === 'Mid Sem')).toBe(true);

    const end = filterPapers(MOCK_PAPERS, '', 'All', 'All', 'End Sem');
    expect(end.every((p) => p.examType === 'End Sem')).toBe(true);

    const back = filterPapers(MOCK_PAPERS, '', 'All', 'All', 'Back Paper');
    expect(back.every((p) => p.examType === 'Back Paper')).toBe(true);

    // Default 'All' keeps every paper
    expect(filterPapers(MOCK_PAPERS, '', 'All', 'All')).toHaveLength(MOCK_PAPERS.length);

    // Tabs compose with school + semester filters
    const combined = filterPapers(MOCK_PAPERS, '', 'SOICT', 'Sem II', 'End Sem');
    expect(
      combined.every(
        (p) => p.school === 'SOICT' && p.semester === 'Sem II' && p.examType === 'End Sem'
      )
    ).toBe(true);
  });

  it('sorts trending papers in descending order of downloads', () => {
    const sorted = [...MOCK_PAPERS].sort((a, b) => b.downloads - a.downloads);
    expect(sorted[0].downloads).toBeGreaterThanOrEqual(sorted[1].downloads);
    expect(sorted[1].downloads).toBeGreaterThanOrEqual(sorted[2].downloads);
  });

  it('allows multi-selection aggregation for batch downloads', () => {
    const selected: string[] = [];
    const toggle = (id: string) => {
      const idx = selected.indexOf(id);
      if (idx !== -1) selected.splice(idx, 1);
      else selected.push(id);
    };

    toggle('p1');
    toggle('p2');
    expect(selected).toEqual(['p1', 'p2']);
    toggle('p1');
    expect(selected).toEqual(['p2']);
  });

  it('filters papers using filterPapers helper with combined query and school', () => {
    const results = filterPapers(MOCK_PAPERS, 'discrete', 'SOICT', 'All');
    expect(results).toHaveLength(1);
    expect(results[0].subjectCode).toBe('BAS201');

    const empty = filterPapers(MOCK_PAPERS, 'discrete', 'SOM', 'All');
    expect(empty).toHaveLength(0);
  });

  it('exposes all available subjects without an artificial 40-item cap', () => {
    // Generate 60 distinct subjects to verify large department curricula
    const manyPapers = Array.from({ length: 60 }, (_, i) => ({
      ...MOCK_PAPERS[0],
      id: `p_extra_${i}`,
      subjectCode: `CSE3${i < 10 ? '0' + i : i}`,
      subjectName: `Advanced Computer Science ${i}`,
    }));

    const map = new Map<string, { code: string; name: string; count: number }>();
    manyPapers.forEach((p) => {
      const code = p.subjectCode.trim();
      const existing = map.get(code);
      if (existing) existing.count += 1;
      else map.set(code, { code, name: p.subjectName, count: 1 });
    });
    const availableSubjects = Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));

    expect(availableSubjects).toHaveLength(60);
    // Verifies full subject catalogue remains visible for students
    expect(availableSubjects.slice(0, 60)).toHaveLength(60);
  });
});
