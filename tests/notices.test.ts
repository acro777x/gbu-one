import { classifyNotice } from '../src/features/notices/noticeService';

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
