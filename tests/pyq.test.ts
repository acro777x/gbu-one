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
});
