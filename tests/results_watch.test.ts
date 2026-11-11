/**
 * Unit tests for the results watch and results pipeline:
 * - Does a re-published sheet raise exactly one alert, and does an unpublished sheet raise none?
 * - Results announcements scraping, keyword detection, and metadata extraction
 * - Student portal URL builder with prefilled roll/session/dob
 * - Fallback seed data for declared results
 * (docs/NOTIFICATIONS.md, docs/DATA_SOURCES.md, docs/OPEN_QUESTIONS.md #22.)
 */
import {
  detectSheetChanges,
  isKnownRevision,
  nextWatchState,
  parseWatchState,
  resultAlertBody,
  resultAlertTitle,
  revisionOf,
  sameRevision,
  type ResultsWatchState,
  type SheetFingerprint,
} from '../src/features/exams/resultsWatch';
import {
  isResultAnnouncement,
  extractProgramme,
  extractSemester,
  extractAcademicYear,
  parseResultAnnouncementsHtml,
  ResultsWorkerJob,
} from '../worker/resultsJob';
import {
  buildPortalResultUrl,
  buildGbuDirectResultUrl,
  COMMON_RESULT_SESSIONS,
  normaliseSemester,
  matchesStudentBatch,
  resultSheetForSchool,
} from '../src/features/exams/resultPortals';
import {
  notifyBatchResultDeclared,
  BATCH_WATCH_STORAGE_KEY,
  RESULTS_WATCH_PREFS_KEY,
  saveSchoolWatchPreference,
  loadSchoolWatchPreference,
  schedulePeriodicResultsCheck,
  isPeriodicResultsCheckScheduled,
  stopPeriodicResultsCheck,
} from '../src/features/exams/resultAlerts';
import {
  SEED_DECLARED_RESULTS,
} from '../src/features/exams/useResultsQuery';

const sheet = (overrides: Partial<SheetFingerprint> = {}): SheetFingerprint => ({
  code: 'soict',
  school: 'SOICT',
  url: 'https://exams.gbu.ac.in/uploads/results/soict.pdf',
  lastModified: 'Wed, 01 Oct 2026 06:00:00 GMT',
  bytes: 9_500_000,
  ...overrides,
});

describe('revisions', () => {
  it('keeps a known revision and blanks the unknown ones', () => {
    expect(revisionOf(sheet())).toEqual({
      lastModified: 'Wed, 01 Oct 2026 06:00:00 GMT',
      bytes: 9_500_000,
    });
    expect(revisionOf(sheet({ lastModified: null, bytes: null }))).toEqual({
      lastModified: null,
      bytes: null,
    });
  });

  it('treats a sheet with no headers at all as unknown', () => {
    expect(isKnownRevision(revisionOf(sheet({ lastModified: null, bytes: null })))).toBe(false);
    expect(isKnownRevision(revisionOf(sheet({ bytes: null })))).toBe(true);
  });

  it('never calls two unknowns a match unless both are unknown', () => {
    const unknown = { lastModified: null, bytes: null };
    expect(sameRevision(unknown, unknown)).toBe(true);
    // A 404 this time and a real sheet last time is not a change.
    expect(sameRevision({ lastModified: 'x', bytes: 10 }, unknown)).toBe(true);
  });
});

describe('change detection', () => {
  it('says nothing on the first look (there is no baseline)', () => {
    expect(detectSheetChanges({}, [sheet()])).toEqual([]);
  });

  it('says nothing when the revision is unchanged', () => {
    const state = nextWatchState({}, [sheet()]);
    expect(detectSheetChanges(state, [sheet()])).toEqual([]);
  });

  it('reports a revised sheet once the portal republishes it', () => {
    const state = nextWatchState({}, [sheet()]);
    const changes = detectSheetChanges(
      state,
      [sheet({ lastModified: 'Thu, 20 Nov 2026 05:30:00 GMT', bytes: 9_700_000 })],
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ code: 'soict', school: 'SOICT', status: 'revised' });
  });

  it('reports a sheet that appears inside an already-known set', () => {
    const state = nextWatchState({}, [sheet()]);
    const changes = detectSheetChanges(state, [
      sheet(),
      sheet({ code: 'psoict', school: 'SOICT', url: 'https://x/psoict.pdf' }),
    ]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ code: 'psoict', school: 'SOICT', status: 'published' });
  });

  it('does not trigger a false published notification when user switches school from SOICT to SOM', () => {
    const state = nextWatchState({}, [sheet()]); // SOICT baseline only
    const changes = detectSheetChanges(state, [
      sheet({ code: 'som', school: 'SOM', url: 'https://exams.gbu.ac.in/uploads/results/som.pdf' }),
    ]);
    expect(changes).toEqual([]);
  });

  it('detects published sheets for SOM once a SOM baseline is established', () => {
    const state = nextWatchState(
      nextWatchState({}, [sheet()]),
      [sheet({ code: 'som', school: 'SOM', url: 'https://exams.gbu.ac.in/uploads/results/som.pdf' })],
    );
    const changes = detectSheetChanges(state, [
      sheet({ code: 'som', school: 'SOM', url: 'https://exams.gbu.ac.in/uploads/results/som.pdf' }),
      sheet({ code: 'psom', school: 'SOM', url: 'https://exams.gbu.ac.in/uploads/results/passout/psom.pdf' }),
    ]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ code: 'psom', school: 'SOM', status: 'published' });
  });

  it('ignores a sheet the portal does not answer for yet', () => {
    const state = nextWatchState({}, [sheet()]);
    const changes = detectSheetChanges(state, [
      sheet({ lastModified: null, bytes: null }),
    ]);
    expect(changes).toEqual([]);
  });

  it('keeps the stored revision of a sheet that went missing', () => {
    const state = nextWatchState({}, [sheet()]);
    const next = nextWatchState(state as ResultsWatchState, []);
    expect(next.soict).toEqual(state.soict);
  });
});

describe('alert wording', () => {
  it('names the school and the reason', () => {
    const revised = {
      code: 'soict',
      school: 'SOICT',
      url: 'https://x/soict.pdf',
      status: 'revised' as const,
    };
    expect(resultAlertTitle(revised)).toBe('SOICT results published');
    expect(resultAlertBody(revised)).toContain('re-published');

    const published = { ...revised, status: 'published' as const };
    expect(resultAlertBody(published)).toContain('added a new result sheet');
  });
});

describe('stored state', () => {
  it('survives a round trip', () => {
    const state = nextWatchState({}, [sheet()]);
    expect(parseWatchState(JSON.stringify(state))).toEqual(state);
  });

  it('ignores junk instead of throwing', () => {
    expect(parseWatchState(null)).toEqual({});
    expect(parseWatchState('not json')).toEqual({});
    expect(parseWatchState('[1,2,3]')).toEqual({});
    expect(parseWatchState('{"soict":null}')).toEqual({});
    expect(parseWatchState('{"soict":{"lastModified":7,"bytes":"big"}}')).toEqual({
      soict: { lastModified: null, bytes: null },
    });
  });
});

describe('worker results scraping and keyword matching', () => {
  it('correctly identifies result announcements using keywords', () => {
    expect(isResultAnnouncement('Result of B.Tech (CSE) IV Semester Examination')).toBe(true);
    expect(isResultAnnouncement('Grade Card for MBA II Semester Declared')).toBe(true);
    expect(isResultAnnouncement('Declaration of Result of Ph.D Coursework 2026')).toBe(true);
    expect(isResultAnnouncement('ODD SEM 2026 Examination Results Published')).toBe(true);
    expect(isResultAnnouncement('EVEN SEM Regular & Back Paper Results')).toBe(true);
    expect(isResultAnnouncement('End Sem Result of SOICT All Branches')).toBe(true);
  });

  it('rejects circulars, fee notices, and admit cards without results', () => {
    expect(isResultAnnouncement('Admit Cards for End Semester Examination')).toBe(false);
    expect(isResultAnnouncement('Tender notice for university hostel mess')).toBe(false);
    expect(isResultAnnouncement('Notice regarding fee payment last date')).toBe(false);
    expect(isResultAnnouncement('Hostel allotment second list')).toBe(false);
    expect(isResultAnnouncement('')).toBe(false);
    expect(isResultAnnouncement('1234')).toBe(false);
  });

  it('extracts programme from diverse announcement titles', () => {
    expect(extractProgramme('Declaration of Result of B.Tech (CSE) IV Semester')).toBe('B.Tech CSE');
    expect(extractProgramme('Result of B.Tech. (ECE) VI Semester (EVEN SEM 2026)')).toBe('B.Tech ECE');
    expect(extractProgramme('Result of B.Tech (CS) IV Semester')).toBe('B.Tech CSE');
    expect(extractProgramme('Result of B.Tech. (EC) VI Semester')).toBe('B.Tech ECE');
    expect(extractProgramme('Result of B.Tech (IT) IV Semester Declared')).toBe('B.Tech IT');
    expect(extractProgramme('Result of B.Tech (AI) II Semester')).toBe('B.Tech AI');
    expect(extractProgramme('Result of B.Tech. (EE) IV Semester')).toBe('B.Tech EE');
    expect(extractProgramme('Grade Card for MCA IV Semester Declared')).toBe('MCA');
    expect(extractProgramme('Result of MBA II Semester 2026')).toBe('MBA');
    expect(extractProgramme('Result of B.A. LL.B VIII Semester (EVEN SEM)')).toBe('B.A. LL.B');
    expect(extractProgramme('Result of SOICT End Semester Examination')).toBe('SOICT');
    expect(extractProgramme('General Examination Results Declared')).toBe('All Programmes');
  });

  it('extracts and normalizes semester', () => {
    expect(extractSemester('Result of B.Tech Sem - IV')).toBe('IV');
    expect(extractSemester('Result of MBA Semester II')).toBe('II');
    expect(extractSemester('Result of MCA 4th Semester Declared')).toBe('IV');
    expect(extractSemester('Result of B.Tech 1st Sem')).toBe('I');
    expect(extractSemester('Result of B.Tech IVth Semester')).toBe('IV');
    expect(extractSemester('Result of B.Tech IInd Sem')).toBe('II');
    expect(extractSemester('Result of B.Tech Sem-IVth')).toBe('IV');
    expect(extractSemester('Result of B.Tech Sem. IIIrd')).toBe('III');
    expect(extractSemester('Result of B.Tech Ist Semester')).toBe('I');
    expect(extractSemester('ODD SEM Examination Results Declared')).toBe('ODD');
    expect(extractSemester('EVEN SEMESTER Result 2026')).toBe('EVEN');
    expect(extractSemester('General Results Announcement')).toBe('');
  });

  it('extracts academic year and session', () => {
    expect(extractAcademicYear('Result of B.Tech IV Sem 2025-26')).toBe('2025-26');
    expect(extractAcademicYear('Declaration of Result 2026-2027')).toBe('2026-2027');
    expect(extractAcademicYear('Result Notice', '2026-10-15')).toBe('2026-27');
  });

  it('parses notice-item blocks from exams portal HTML including text month dates', () => {
    const html = `
      <div class="notice-item">
        <h3><a href="/uploads/results/btech_cse_4.pdf">Result of B.Tech (CSE) IV Semester Declared</a></h3>
        <p>Posted on: 15-10-2026</p>
      </div>
      <div class="notice-item">
        <h3><a href="/uploads/results/btech_ec_6.pdf">Result of B.Tech (EC) VIth Semester</a></h3>
        <p>Posted on: 15 Oct 2026</p>
      </div>
      <div class="notice-item">
        <h3><a href="/uploads/notices/mess_bill.pdf">Mess Bill Oct 2026</a></h3>
        <p>Posted on: 12-10-2026</p>
      </div>
      <div class="notice-item">
        <h3><a href="https://gbuexam.in/result/mba.pdf">Grade Card for MBA II Semester ODD SEM</a></h3>
        <p>Date: 10-10-2026</p>
      </div>
    `;

    const records = parseResultAnnouncementsHtml(html, 'https://exams.gbu.ac.in');
    expect(records).toHaveLength(3);

    expect(records[0]).toMatchObject({
      programme: 'B.Tech CSE',
      semester: 'IV',
      fileUrl: 'https://exams.gbu.ac.in/uploads/results/btech_cse_4.pdf',
    });

    expect(records[1]).toMatchObject({
      programme: 'B.Tech ECE',
      semester: 'VI',
      fileUrl: 'https://exams.gbu.ac.in/uploads/results/btech_ec_6.pdf',
      postedAt: '2026-10-15T00:00:00.000Z',
    });

    expect(records[2]).toMatchObject({
      programme: 'MBA',
      semester: 'II',
      fileUrl: 'https://gbuexam.in/result/mba.pdf',
    });
  });

  it('parses table rows from university results page', () => {
    const html = `
      <table>
        <tr>
          <td>20 Oct 2026</td>
          <td><a href="/uploads/results/soict_even.pdf">Result of SOICT EVEN SEM 2026</a></td>
        </tr>
        <tr>
          <td>18 Oct 2026</td>
          <td><a href="/notices/holiday.pdf">Holiday Notice</a></td>
        </tr>
      </table>
    `;

    const records = parseResultAnnouncementsHtml(html, 'https://exams.gbu.ac.in');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      programme: 'SOICT',
      semester: 'EVEN',
      fileUrl: 'https://exams.gbu.ac.in/uploads/results/soict_even.pdf',
    });
  });

  it('ResultsWorkerJob seeds known URLs and computes fresh push candidates', async () => {
    const job = new ResultsWorkerJob(['https://exams.gbu.ac.in/uploads/results/old_result.pdf']);
    expect(job).toBeDefined();

    const html = `
      <div class="notice-item">
        <h3><a href="/uploads/results/old_result.pdf">Result of MCA IV Semester</a></h3>
      </div>
      <div class="notice-item">
        <h3><a href="/uploads/results/new_result.pdf">Result of B.Tech CSE IV Semester Declared</a></h3>
      </div>
    `;

    const items = parseResultAnnouncementsHtml(html, 'https://exams.gbu.ac.in');
    expect(items).toHaveLength(2);

    const knownSet = new Set(['https://exams.gbu.ac.in/uploads/results/old_result.pdf']);
    const fresh = items.filter((r) => !knownSet.has(r.fileUrl ?? ''));
    expect(fresh).toHaveLength(1);
    expect(fresh[0].fileUrl).toBe('https://exams.gbu.ac.in/uploads/results/new_result.pdf');
  });
});

describe('student portal URL generation and query parameters', () => {
  it('builds portal login URL with prefilled roll, session, and dob', () => {
    const url = buildPortalResultUrl({
      rollNo: '22/ICS/042',
      session: '2026-27 ODD SEM',
      dob: '15/08/2004',
    });
    expect(url).toContain('gbuexam.in/result/login.php');
    expect(url).toContain('roll_no=22%2FICS%2F042');
    expect(url).toContain('session=2026-27%20ODD%20SEM');
    expect(url).toContain('dob=15%2F08%2F2004');
  });

  it('builds direct GBU result gateway URL', () => {
    const url = buildGbuDirectResultUrl({
      rollNo: '22/ICS/042',
      session: '2025-26 EVEN SEM',
    });
    expect(url).toContain('https://www.gbu.ac.in/results');
    expect(url).toContain('roll=22%2FICS%2F042');
    expect(url).toContain('session=2025-26%20EVEN%20SEM');
  });

  it('supplies standard common sessions for student picker', () => {
    expect(COMMON_RESULT_SESSIONS).toContain('2026-27 ODD SEM');
    expect(COMMON_RESULT_SESSIONS).toContain('2025-26 EVEN SEM');
    expect(COMMON_RESULT_SESSIONS.length).toBeGreaterThanOrEqual(4);
  });

  it('provides bundled declared results seed for offline-first support', () => {
    expect(SEED_DECLARED_RESULTS.length).toBeGreaterThanOrEqual(4);
    for (const seed of SEED_DECLARED_RESULTS) {
      expect(seed.id).toBeDefined();
      expect(seed.programme).toBeDefined();
      expect(seed.title).toBeDefined();
      expect(seed.fileUrl).toMatch(/^https?:\/\//);
    }
  });
});

describe('batch matching and student notifications', () => {
  it('normalises semester numbers, Roman numerals, and ordinals', () => {
    expect(normaliseSemester('4')).toBe('IV');
    expect(normaliseSemester('4th')).toBe('IV');
    expect(normaliseSemester('IVth')).toBe('IV');
    expect(normaliseSemester('2nd')).toBe('II');
    expect(normaliseSemester('IInd')).toBe('II');
    expect(normaliseSemester('1st')).toBe('I');
    expect(normaliseSemester('VI')).toBe('VI');
    expect(normaliseSemester('ODD')).toBe('ODD');
    expect(normaliseSemester('EVEN')).toBe('EVEN');
    expect(normaliseSemester('')).toBe('');
    expect(normaliseSemester(null)).toBe('');
  });

  it('matches B.Tech CSE (BCS) student with declared B.Tech CSE results', () => {
    const student = {
      programmeCode: 'BCS',
      programmeName: 'B.Tech (CS)',
      school: 'SOICT',
      semester: 'IV',
      selectedSession: '2025-26 EVEN SEM',
    };

    expect(
      matchesStudentBatch(
        { programme: 'B.Tech CSE', semester: 'IV' },
        student,
      ),
    ).toBe(true);

    expect(
      matchesStudentBatch(
        { programme: 'B.Tech (CS)', semester: 'IV' },
        student,
      ),
    ).toBe(true);

    // EVEN SEM session match
    expect(
      matchesStudentBatch(
        { programme: 'B.Tech CSE', semester: 'EVEN' },
        student,
      ),
    ).toBe(true);

    // School-level batch declaration
    expect(
      matchesStudentBatch(
        { programme: 'SOICT', semester: 'EVEN' },
        student,
      ),
    ).toBe(true);

    // Wrong semester
    expect(
      matchesStudentBatch(
        { programme: 'B.Tech CSE', semester: 'VI' },
        student,
      ),
    ).toBe(false);

    // Wrong programme
    expect(
      matchesStudentBatch(
        { programme: 'MBA', semester: 'IV' },
        student,
      ),
    ).toBe(false);
  });

  it('matches other degrees (ECE, MCA, MBA, B.A. LL.B)', () => {
    expect(
      matchesStudentBatch(
        { programme: 'B.Tech ECE', semester: 'II' },
        { programmeCode: 'BEC', semester: 'II', school: 'SOICT' },
      ),
    ).toBe(true);

    expect(
      matchesStudentBatch(
        { programme: 'MCA', semester: 'IV' },
        { programmeCode: 'MCA', semester: 'IV', school: 'SOICT' },
      ),
    ).toBe(true);

    expect(
      matchesStudentBatch(
        { programme: 'MBA', semester: 'II' },
        { programmeCode: 'MBA', semester: 'II', school: 'SOM' },
      ),
    ).toBe(true);

    expect(
      matchesStudentBatch(
        { programme: 'B.A. LL.B', semester: 'VIII' },
        { programmeCode: 'BALLB', semester: 'VIII', school: 'SOL' },
      ),
    ).toBe(true);
  });

  it('provides persistent storage key for batch result watch', () => {
    expect(BATCH_WATCH_STORAGE_KEY).toBe('@gbu_one_batch_result_watch');
  });

  it('schedules notification when batch result is published', async () => {
    const success = await notifyBatchResultDeclared({
      programme: 'B.Tech CSE',
      semester: 'IV',
      title: 'Result of B.Tech CSE IV Semester Declared',
      fileUrl: 'https://exams.gbu.ac.in/uploads/results/soict.pdf',
    });
    expect(success).toBe(true);
  });

  describe('resultSheetForSchool lookup', () => {
    it('finds normal result sheet when special is false or omitted', () => {
      const sheet = resultSheetForSchool('SOICT');
      expect(sheet).toBeDefined();
      expect(sheet?.school).toBe('SOICT');
      expect(sheet?.code).toBe('soict');
      expect(sheet?.special).toBeUndefined();

      const normalExplicit = resultSheetForSchool('soe', false);
      expect(normalExplicit).toBeDefined();
      expect(normalExplicit?.code).toBe('soe');
    });

    it('finds special passout result sheet when special is true', () => {
      const passoutSheet = resultSheetForSchool('SOICT', true);
      expect(passoutSheet).toBeDefined();
      expect(passoutSheet?.code).toBe('psoict');
      expect(passoutSheet?.special).toBe(true);
    });

    it('returns undefined for invalid or unknown schools', () => {
      expect(resultSheetForSchool('')).toBeUndefined();
      expect(resultSheetForSchool(null)).toBeUndefined();
      expect(resultSheetForSchool('UNKNOWN_SCHOOL')).toBeUndefined();
    });
  });

  describe('school watch preferences and periodic check scheduling', () => {
    it('provides persistent storage key for results watch preferences', () => {
      expect(RESULTS_WATCH_PREFS_KEY).toBe('@gbu_one_results_watch_v1');
    });

    it('persists school watch preferences to RESULTS_WATCH_PREFS_KEY', async () => {
      await saveSchoolWatchPreference('SOICT', true);
      const isWatched = await loadSchoolWatchPreference('SOICT');
      expect(isWatched).toBe(true);

      const somWatched = await loadSchoolWatchPreference('SOM');
      expect(somWatched).toBe(false);

      await saveSchoolWatchPreference('SOICT', false);
      const turnedOff = await loadSchoolWatchPreference('SOICT');
      expect(turnedOff).toBe(false);
    });

    it('schedules and stops periodic results check', () => {
      const cancel = schedulePeriodicResultsCheck('SOICT', 60000);
      expect(isPeriodicResultsCheckScheduled()).toBe(true);
      cancel();
      expect(isPeriodicResultsCheckScheduled()).toBe(false);

      schedulePeriodicResultsCheck('SOICT', 60000);
      expect(isPeriodicResultsCheckScheduled()).toBe(true);
      stopPeriodicResultsCheck();
      expect(isPeriodicResultsCheckScheduled()).toBe(false);
    });
  });
});