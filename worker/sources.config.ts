/**
 * GBU One — Worker Sources Configuration
 * Per docs/DATA_SOURCES.md & docs/ARCHITECTURE.md
 */

export interface WorkerSourceConfig {
  name: string;
  url: string;
  fallbackUrl?: string;
  rateLimitMs: number;
  intervalMinutes: number;
  timeoutMs: number;
}

export const WORKER_CONFIG = {
  userAgent: 'GBUOne-Worker/1.0 (student project; contact: student.gbuone@gmail.com)',
  sources: {
    mainNotices: {
      name: 'GBU Main Notices',
      url: 'https://test.gbu.ac.in/page/notices',
      fallbackUrl: 'https://www.gbu.ac.in/page/notices',
      rateLimitMs: 1000,
      intervalMinutes: 15,
      timeoutMs: 15000,
    },
    examsNotices: {
      name: 'GBU Exam Portal Notices',
      url: 'https://exams.gbu.ac.in',
      fallbackUrl: 'https://www.gbu.ac.in/examinations',
      rateLimitMs: 1000,
      intervalMinutes: 15,
      timeoutMs: 15000,
    },
    examResults: {
      name: 'GBU Exam Results & Admit Cards Portal',
      url: 'https://gbuexam.in',
      rateLimitMs: 1000,
      intervalMinutes: 30,
      timeoutMs: 15000,
    },
    placements: {
      name: 'Corporate Relations & Training and Placement Cell (CRC)',
      url: 'https://gbu.ac.in/placements',
      rateLimitMs: 1500,
      intervalMinutes: 60,
      timeoutMs: 15000,
    },
    timetableApi: {
      name: 'GBU Schedule API (Samay)',
      baseUrl: 'https://samay.mygbu.in/api.php',
      legacyBaseUrl: 'https://mygbu.in/schd/api.php',
      activeSemesters: ['39', '40'], // 39 = current session, 40 = next session
      rateLimitMs: 2000,
      intervalMinutes: 30, // 30 min during 7:00-20:00, 60 min otherwise
      timeoutMs: 20000,
    },
    academicCalendar: {
      name: 'Academic Calendar PDF',
      url: 'https://exams.gbu.ac.in/uploads/imp_link/Academic%20Calendar%202026-27.pdf',
      fallbackUrl: 'https://test.gbu.ac.in/page/academicCalender',
      intervalMinutes: 720,
      timeoutMs: 30000,
    },
    holidays: {
      name: 'Vacation & Holiday List 2026',
      url: 'https://test.gbu.ac.in/Content/gbudata/General/List%20of%20Vacation-2026.pdf',
      intervalMinutes: 1440,
      timeoutMs: 30000,
    },
    hostels: {
      name: 'Hostel Portal',
      url: 'http://hostels.gbu.ac.in/',
      intervalMinutes: 120,
      timeoutMs: 15000,
    },
    ohms: {
      name: 'Online Hostel Management System (OHMS)',
      url: 'https://ohms.gbu.ac.in/',
      intervalMinutes: 120,
      timeoutMs: 15000,
    },
    csms: {
      name: 'Central Student Management System (CSMS)',
      url: 'https://csms.gbu.ac.in/',
      intervalMinutes: 180,
      timeoutMs: 15000,
    },
    digiforms: {
      name: 'DigiForms Single Window Portal',
      url: 'https://digiforms.gbu.ac.in/',
      intervalMinutes: 240,
      timeoutMs: 15000,
    },
  },
};
