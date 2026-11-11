import {
  classifyNotice,
  detectNoticeAudience,
  extractNoticeDeadline,
  generateCanonicalNoticeId,
  getCanonicalNoticeKey,
  sha256Hex,
} from '../src/features/notices/noticeService';

describe('Notice Classifier', () => {
  it('correctly categorizes datesheet notices', () => {
    expect(classifyNotice('Revised Date Sheet for Autumn 2026 Examination')).toBe('datesheet');
    expect(classifyNotice('Datesheet for Mid Sem Exams 2026')).toBe('datesheet');
  });

  it('correctly categorizes fee submission notices', () => {
    expect(classifyNotice('Office Order: Extension of Fee Submission Date')).toBe('fees');
    expect(classifyNotice('Late fee fine details for Monsoon 2026')).toBe('fees');
  });

  it('correctly categorizes scholarship notices', () => {
    expect(classifyNotice('Online Application Form for UP Scholarship 2026-27')).toBe('scholarship');
  });

  it('correctly categorizes hostel notices', () => {
    expect(classifyNotice('Hostel Allotment List for Girls Hostel 2')).toBe('hostel');
    expect(classifyNotice('Mess fee deposit notification')).toBe('hostel');
  });

  it('correctly categorizes results', () => {
    expect(classifyNotice('Declaration of Result for B.Tech CSE Semester IV')).toBe('result');
  });

  it('falls back to other for general tenders or administrative notices', () => {
    expect(classifyNotice('Tender Notice for Maintenance of Campus Wi-Fi')).toBe('other');
  });
});

describe('Canonical Notice ID Generation & SHA-256 Hashing', () => {
  it('generates a stable SHA-256 hex hash', () => {
    const hash = sha256Hex('test_notice_seed');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex('test_notice_seed')).toBe(hash);
  });

  it('generates deterministic canonical notice ID across mirror URLs (test.gbu.ac.in vs www.gbu.ac.in)', () => {
    const idMain = generateCanonicalNoticeId({
      source: 'main',
      fileUrl: 'https://www.gbu.ac.in/Admissions/DownloadFile?nName=fee_notice.pdf',
      title: 'Fee Notice',
    });
    const idMirror = generateCanonicalNoticeId({
      source: 'main',
      fileUrl: 'https://test.gbu.ac.in/Admissions/DownloadFile?nName=fee_notice.pdf',
      title: 'Fee Notice',
    });
    expect(idMain).toBe(idMirror);
    expect(idMain).toMatch(/^not_[0-9a-f]{16}$/);
  });

  it('produces identical canonical keys across sync intervals for matching documents', () => {
    const key1 = getCanonicalNoticeKey({
      source: 'main',
      fileUrl: 'https://www.gbu.ac.in/notice.pdf',
      title: 'Mid Sem Exam Notice',
      postedAt: '2026-10-18T00:00:00Z',
    });
    const key2 = getCanonicalNoticeKey({
      source: 'main',
      fileUrl: 'https://test.gbu.ac.in/notice.pdf',
      title: 'Mid Sem Exam Notice',
      postedAt: '2026-10-18T06:00:00Z',
    });
    expect(key1).toBe(key2);
  });
});

describe('Audience and Deadline Extraction', () => {
  it('detects school and programme audience accurately', () => {
    const audience = detectNoticeAudience('SOICT B.Tech CSE End Sem Examination Datesheet');
    expect(audience.schools).toContain('SOICT');
    expect(audience.programmes).toContain('B.Tech');
    expect(audience.all).toBe(false);
  });

  it('extracts deadline dates from notice text', () => {
    const deadline = extractNoticeDeadline('Office Order: Last date of registration extended to 31st Oct 2026');
    expect(deadline).not.toBeNull();
    const parsed = new Date(deadline!);
    expect(parsed.getUTCFullYear()).toBe(2026);
    expect(parsed.getUTCMonth()).toBe(9); // October
    expect(parsed.getUTCDate()).toBe(31);
  });
});
