import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  submitStudentReport,
  getLocalReports,
  saveLocalReports,
  fetchReportsForAdmin,
  fetchStudentReports,
  respondToReport,
  LOCAL_REPORTS_STORAGE_KEY,
} from '../src/features/reports/reportsService';

jest.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

describe('Student & Admin Reports Service', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('submits a student report offline and persists to local storage', async () => {
    const res = await submitStudentReport({
      type: 'general',
      category: 'Timetable Error',
      reason: 'Room 204 conflicts with Lab',
      reporterName: 'Ashish Khola',
      reporterStudentId: '23/ICS/001',
      reporterEmail: 'student@gbu.ac.in',
    });

    expect(res.ok).toBe(true);
    expect(res.reportId).toBeTruthy();

    const stored = await getLocalReports();
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe(res.reportId);
    expect(stored[0].category).toBe('Timetable Error');
    expect(stored[0].status).toBe('pending');
  });

  it('supports PYQ paper report with custom note', async () => {
    const res = await submitStudentReport({
      type: 'pyq',
      category: 'PYQ Paper',
      subjectCode: 'CS201',
      subjectName: 'Data Structures',
      paperId: 'paper_123',
      reason: 'Page 3 is missing questions 5 and 6',
      customNote: 'Exam was Mid-term 2024',
      reporterName: 'Test Student',
      reporterStudentId: '22/ICS/099',
    });

    expect(res.ok).toBe(true);
    const stored = await getLocalReports();
    expect(stored[0].paperId).toBe('paper_123');
    expect(stored[0].customNote).toBe('Exam was Mid-term 2024');
  });

  it('allows admin to respond to a report and change its status', async () => {
    const res = await submitStudentReport({
      type: 'general',
      category: 'App Bug',
      reason: 'Push notification does not chime',
      reporterName: 'Student User',
      reporterStudentId: '24/SOE/012',
    });

    const adminRes = await respondToReport(
      res.reportId,
      'Issue resolved in v1.0.4 update. Please check notification channel settings.',
      'resolved',
    );

    expect(adminRes.ok).toBe(true);

    const reports = await fetchReportsForAdmin();
    const target = reports.find((r) => r.id === res.reportId);
    expect(target).toBeDefined();
    expect(target?.status).toBe('resolved');
    expect(target?.adminResponse).toContain('Issue resolved in v1.0.4 update');
    expect(target?.adminResponseAt).toBeTruthy();
  });

  it('fetches student reports for profile view', async () => {
    await submitStudentReport({
      type: 'general',
      category: 'Syllabus / Course',
      reason: 'Missing Unit 4 syllabus for AI course',
      reporterName: 'Scholar',
      reporterStudentId: '23/ICS/055',
    });

    const studentReports = await fetchStudentReports('23/ICS/055');
    expect(studentReports.length).toBeGreaterThan(0);
    expect(studentReports[0].category).toBe('Syllabus / Course');
  });
});
