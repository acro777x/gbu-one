/**
 * GBU One — Worker Sources Configuration
 * Per docs/DATA_SOURCES.md & docs/ARCHITECTURE.md
 *
 * This file is the single source of truth for the URLs the worker reads.
 * Every module that talks to the university takes its URL from here, so a
 * change of portal is a change of one file.
 *
 * Two politeness fields are honoured by the worker:
 *
 *  - `rateLimitMs`: the pause between two requests to the same host.
 *  - `intervalMinutes`: how often a source may be fetched. A source that
 *    changes twice a year (the holiday list) must not be OCR'd 96 times a
 *    day, so the worker skips it until the interval has elapsed.
 */

export interface WorkerSourceConfig {
  name: string;
  url: string;
  fallbackUrl?: string;
  /** Pause between two requests to the same host, in ms. */
  rateLimitMs: number;
  /** How often the source may be fetched, in minutes. */
  intervalMinutes: number;
  timeoutMs: number;
}

export const WORKER_CONFIG = {
  userAgent: 'GBUOne-Worker/1.0 (student project; contact: student.gbuone@gmail.com)',
  sources: {
    mainNotices: {
      name: 'GBU Main Notices',
      url: 'https://www.gbu.ac.in/page/notices',
      fallbackUrl: 'https://test.gbu.ac.in/page/notices',
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
    timetableApi: {
      name: 'GBU Schedule API (Samay)',
      baseUrl: 'https://samay.mygbu.in/api.php',
      /** The older host the API was published on first; used as a fallback. */
      legacyBaseUrl: 'https://mygbu.in/schd/api.php',
      activeSemesters: ['39', '40'] as string[], // 39 = current session, 40 = next session
      rateLimitMs: 2000,
      intervalMinutes: 30, // 30 min during 7:00-20:00, 60 min otherwise
      timeoutMs: 20000,
    },
    academicCalendar: {
      name: 'Academic Calendar PDF',
      url: 'https://exams.gbu.ac.in/uploads/imp_link/Academic%20Calendar%202026-27.pdf',
      fallbackUrl:
        'https://www.gbu.ac.in/Content/gbudata/General/Academic%20Calendar%202026-27.pdf',
      rateLimitMs: 2000,
      intervalMinutes: 720,
      timeoutMs: 30000,
    },
    holidays: {
      name: 'Vacation & Holiday List 2026',
      url: 'https://www.gbu.ac.in/Content/gbudata/General/List%20of%20Vacation-2026.pdf',
      fallbackUrl:
        'https://test.gbu.ac.in/Content/gbudata/General/List%20of%20Vacation-2026.pdf',
      rateLimitMs: 2000,
      intervalMinutes: 1440,
      timeoutMs: 30000,
    },
    hostels: {
      name: 'Hostel Portal',
      url: 'https://hostels.gbu.ac.in/',
      rateLimitMs: 1500,
      intervalMinutes: 120,
      timeoutMs: 15000,
    },
    ohms: {
      name: 'Online Hostel Management System (OHMS)',
      url: 'https://ohms.gbu.ac.in/',
      rateLimitMs: 1500,
      intervalMinutes: 120,
      timeoutMs: 15000,
    },
    csms: {
      name: 'Central Student Management System (CSMS)',
      url: 'https://csms.gbu.ac.in/',
      rateLimitMs: 1500,
      intervalMinutes: 180,
      timeoutMs: 15000,
    },
    digiforms: {
      name: 'DigiForms Single Window Portal',
      url: 'https://digiforms.gbu.ac.in/',
      rateLimitMs: 1500,
      intervalMinutes: 240,
      timeoutMs: 15000,
    },
  },
} as const;

/** The keys the worker records in `worker_runs.source` per source. */
export const SOURCE_KEYS = {
  mainNotices: 'notices:main',
  examsNotices: 'notices:exams',
  hostels: 'notices:hostels',
  ohms: 'notices:ohms',
  csms: 'notices:csms',
  digiforms: 'notices:digiforms',
  academicCalendar: 'calendar:academic',
  holidays: 'calendar:holidays',
  examResults: 'results:exam-results',
  timetableApi: 'timetable:api',
} as const;
