/**
 * Unit tests for the academic calendar, exam date sheet and holiday list
 * parsers of the worker.
 *
 * Every test is a pure function test with an inline fixture: no network, no
 * file system, no OCR.
 */
import {
  parseAcademicCalendarText,
  fetchAcademicCalendar,
  ACADEMIC_CALENDAR_URL,
} from '../worker/academicCalendar';
import {
  parseDateSheetText,
  buildDateSheetUrl,
  splitSubjects,
  DATE_SHEET_SCHOOL_CODES,
} from '../worker/examDateSheet';
import { parseHolidayTableText, fetchHolidays2026 } from '../worker/holidayList';

/**
 * A calendar that prints one row per line, the way a hand-made sheet does:
 * `1. Event Name .......... 10-20 Jul 2026`.
 */
const SINGLE_BLOCK_CALENDAR = `
MONSOON SEMESTER
1. Fee Submission (Online) .......... 10-20 Jul 2026
2. Commencement of Classes .......... 03 Aug 2026
3. End Semester Examination .......... 14-24 Dec 2026
`;

/**
 * A calendar in the layout the university PDF really uses: the row numbers
 * are printed out of order (row 8 after row 9) and the dates are printed
 * several rows later than the name they belong to.
 */
const INTERLEAVED_CALENDAR = `
MONSOON SEMESTER
1.
Fee Submission (Online) (2nd Year onwards).
Fri,
10th
July
2026
-
Mon,
20th
July
2026
2.
Reporting & Registration at respective Schools.
Mon,
27th
July
2026-
Fri,
31st
July
2026
3.
Commencement of Classes (2nd Year onwards).
.Mon,
03rd
August
2026
4.
Reporting of 1st Year Students.
.Wed,
05th
August
2026
&
Thu,
06th
August
2026
5.
Induction/Orientation of 1st Year Students.
Fri,
07th
August
2026
6.
Commencement of Classes (1st Year Students)..
7.
Mid Semester Examination.
.Mon,
10th
August
2026
.Wed,
07th
October
2026-
Fri,
16th
October
2026
Mon,
30th
November
2026
-
Fri,
04th
December
2026
9.
Back Paper Examination.
Mon,
07th
December
2026-
Sat,
12h
December
2026
8.
Lab/Practical Examination
10.
End Semester Examination.
.Mon,
14th
December
2026
-
Thu,
24th
December
2026
11.
Evaluation and Submission of Answer Books.
12.
Winter Vacation.
13.
Declaration of Results
.Up
to
Tue,
12tdh
January
2027
.Fri,
25th
December
2026
-
Tue,
05th
January
2027
.Mon,
25th
January
2027
`;

/**
 * The winter block of the same PDF: eleven rows but thirteen date
 * expressions, because two rows carry a range that the university printed
 * over two cells.
 */
const WINTER_CALENDAR = `
WINTER SEMESTER
1.
Fee Submission (Online).
.Sat,
26th
December
2026-
Tue,
05th
January
2027
2.
Reporting & Registration at respective Deptt./Schools.
3.
Commencement of Classes (All Years Students).
.Sat,
09th
January
2027
.Mon,
11th
January
2027
4.
Mid Semester Examination.
.Mon.
08th
March
2027
Fri.
19th
March
2027
Mon,
26th
April
2027
-
Fri,
30th
April
2027
.Mon,
03rd
May
2027
-
Sat,
08th
May
2027
Mon,
10th
May
2027-
Sat,
22nd
May
2027
..Up
to
Wed,
19th
May
2027
5.
Lab/Practical Examination
6.
Back Paper Examination.
7.
End Semester Examination.
8.
Evaluation and Submission of Back Paper Exam Answer Book.
9.
Evaluation and Submission of End Term Exam Answer Books.
.Up
to
Mon,
07th
June
2027
10.
Declaration of Results
Sun,
20th
June
2027
-
Wed,
30th
June
2027
11.
Summer Vacation.
NOTE:
Tue,
08th
June
2027
Thu,
22nd
July
2027
`;

/** A date sheet row: one programme, one slot, one date, one subject. */
const GRID_DATE_SHEET = `
Bachelor of Architecture Batch -2025-2030 (I Semester ) | Morning 9.30am-12.30pm | 08-12-2025 | MA101 Engineering Mathematics -I
Bachelor of Architecture Batch -2025-2030 (I Semester ) | Morning 9.30am-12.30pm | 09-12-2025 | EN101 English Proficiency
Bachelor of Architecture Batch -2025-2030 (I Semester ) | Evening 2.00pm-5.00pm | 08-12-2025 | MA103 Discrete Mathematics
Bachelor of Architecture Batch -2025-2030 (I Semester ) | Evening 2.00pm-5.00pm | 09-12-2025 | EN101 English Proficiency (Back Paper)
`;

/** A holiday list as the OCR of the scanned page reads it. */
const HINDI_HOLIDAY_TABLE = `
संपत्ति कर
1. दशहरा 2 15/08/2026 - 16/08/2026 शनिवार
विविध अवकाश
2. होली 1 03/03/2026 मंगलवार
3. गांधी जयंती 1 02/10/2026 शुक्रवार
दृश्य अवकाश
4. चोट्टी 1 26-01-2026 सोमवार
`;

describe('Academic calendar parser', () => {
  it('reads a calendar that prints one row per line', () => {
    const events = parseAcademicCalendarText(SINGLE_BLOCK_CALENDAR);
    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({
      name: 'Fee Submission (Online)',
      startDate: '2026-07-10',
      endDate: '2026-07-20',
      semester: 'monsoon',
    });
    expect(events[1].startDate).toBe('2026-08-03');
    expect(events[1].endDate).toBe('2026-08-03');
    expect(events[2].startDate).toBe('2026-12-14');
    expect(events[2].endDate).toBe('2026-12-24');
    expect(events.every((event) => event.semester === 'monsoon')).toBe(true);
  });

  it('pairs rows with their dates when the PDF prints them out of order', () => {
    const events = parseAcademicCalendarText(INTERLEAVED_CALENDAR);
    expect(events).toHaveLength(13);

    const byName = new Map(events.map((event) => [event.name, event]));
    expect(byName.get('Fee Submission (Online) (2nd Year onwards)')?.startDate).toBe('2026-07-10');
    expect(byName.get('Fee Submission (Online) (2nd Year onwards)')?.endDate).toBe('2026-07-20');
    expect(byName.get('Reporting & Registration at respective Schools')?.endDate).toBe('2026-07-31');
    expect(byName.get('Reporting of 1st Year Students')?.startDate).toBe('2026-08-05');
    expect(byName.get('Reporting of 1st Year Students')?.endDate).toBe('2026-08-06');
    expect(byName.get('Induction/Orientation of 1st Year Students')?.startDate).toBe('2026-08-07');
    expect(byName.get('Commencement of Classes (1st Year Students)')?.startDate).toBe('2026-08-10');
    expect(byName.get('Mid Semester Examination')?.startDate).toBe('2026-10-07');
    expect(byName.get('Mid Semester Examination')?.endDate).toBe('2026-10-16');
    expect(byName.get('Lab/Practical Examination')?.startDate).toBe('2026-11-30');
    expect(byName.get('Lab/Practical Examination')?.endDate).toBe('2026-12-04');
    expect(byName.get('Back Paper Examination')?.startDate).toBe('2026-12-07');
    expect(byName.get('End Semester Examination')?.endDate).toBe('2026-12-24');
  });

  it('reads a block whose rows carry a range that was printed over two cells', () => {
    const events = parseAcademicCalendarText(WINTER_CALENDAR);
    expect(events).toHaveLength(11);
    expect(events[0].startDate).toBe('2026-12-26');
    expect(events[0].endDate).toBe('2027-01-05');
    expect(events[1].startDate).toBe('2027-01-09');
    expect(events[2].startDate).toBe('2027-01-11');
    expect(events[3].startDate).toBe('2027-03-08');
    expect(events[3].endDate).toBe('2027-03-19');
    expect(events[4].startDate).toBe('2027-04-26');
    expect(events[6].startDate).toBe('2027-05-10');
    expect(events[6].endDate).toBe('2027-05-22');
    expect(events[9].startDate).toBe('2027-06-20');
    expect(events[9].endDate).toBe('2027-06-30');
    expect(events[10].startDate).toBe('2027-06-08');
    expect(events[10].endDate).toBe('2027-07-22');
    expect(events.every((event) => event.semester === 'winter')).toBe(true);
  });

  it('ignores the covering order and returns nothing for an empty text', () => {
    const cover = '1. Copy to: Staff of the Office of the Vice-Chancellor 2. Registrar';
    expect(parseAcademicCalendarText(cover)).toHaveLength(0);
    expect(parseAcademicCalendarText('')).toHaveLength(0);
  });

  it('reports an honest failure when the download does not work', async () => {
    const result = await fetchAcademicCalendar({
      url: 'https://exams.gbu.ac.in/uploads/imp_link/Academic%20Calendar%202026-27.pdf',
      fallbackUrl: 'https://www.gbu.ac.in/Content/gbudata/General/Academic%20Calendar%202026-27.pdf',
      fetchImpl: async () => {
        throw new Error('offline');
      },
    });
    expect(result.ok).toBe(false);
    expect(result.events).toHaveLength(0);
    expect(result.reason).toContain('offline');
    expect(ACADEMIC_CALENDAR_URL).toContain('exams.gbu.ac.in');
  });
});

describe('Exam date sheet parser', () => {
  it('rebuilds the rows of a date sheet', () => {
    const slots = parseDateSheetText(GRID_DATE_SHEET, 'soe');
    expect(slots).toHaveLength(4);
    expect(slots[0].schoolCode).toBe('soe');
    expect(slots[0].programme).toContain('Bachelor of Architecture');
    expect(slots[0].date).toBe('2025-12-08');
    expect(slots[0].slot).toBe('morning');
    expect(slots[0].subjectCode).toBe('MA101');
    expect(slots[0].subjectName).toBe('Engineering Mathematics -I');
    expect(slots[1].date).toBe('2025-12-09');
    expect(slots[1].subjectCode).toBe('EN101');
    expect(slots[2].slot).toBe('evening');
    expect(slots[2].date).toBe('2025-12-08');
    expect(slots[2].subjectCode).toBe('MA103');
  });

  it('marks a back paper', () => {
    const slots = parseDateSheetText(GRID_DATE_SHEET, 'soe');
    const back = slots[3];
    expect(back.slot).toBe('evening');
    expect(back.date).toBe('2025-12-09');
    expect(back.isBackPaper).toBe(true);
    expect(back.subjectName).toBe('English Proficiency');
    expect(slots.filter((slot) => slot.isBackPaper)).toHaveLength(1);
  });

  it('splits a cell that holds two papers', () => {
    const subjects = splitSubjects(
      'BS511 Pre-Buddhist Indian History and Archaeology/BS513 Mahayana Buddhist Literature',
    );
    expect(subjects).toHaveLength(2);
    expect(subjects[0].subjectCode).toBe('BS511');
    expect(subjects[1].subjectCode).toBe('BS513');
    expect(subjects[1].subjectName).toBe('Mahayana Buddhist Literature');
  });

  it('reads the date header of the plain text of a date sheet', () => {
    const plain = [
      'Programme Name',
      'Batch/Semester',
      'Date & Time',
      '08-12-2025',
      '09-12-2025',
      'Morning',
      '9.30am-12.30pm',
      'MA101 Engineering Mathematics -I',
      'EN101 English Proficiency',
      'Evening',
      '2.00pm-5.00pm',
      'MA103 Discrete Mathematics',
    ].join('\n');
    const slots = parseDateSheetText(plain, 'soe');
    expect(slots.length).toBeGreaterThanOrEqual(3);
    expect(slots[0].date).toBe('2025-12-08');
    expect(slots[0].slot).toBe('morning');
    expect(slots[0].subjectCode).toBe('MA101');
    expect(slots[slots.length - 1].slot).toBe('evening');
  });

  it('builds the url of a date sheet', () => {
    expect(buildDateSheetUrl('soe', 'dec', 2025)).toBe(
      'https://exams.gbu.ac.in/uploads/datesheet/soe-end-sem-dec-2025.pdf',
    );
    expect(DATE_SHEET_SCHOOL_CODES).toHaveLength(8);
    expect(DATE_SHEET_SCHOOL_CODES).toContain('sovasas');
  });

  it('returns nothing for a text without a date sheet', () => {
    expect(parseDateSheetText('nothing to see here', 'soe')).toHaveLength(0);
  });
});

describe('Holiday list parser', () => {
  it('reads the rows of the scanned holiday list', () => {
    const holidays = parseHolidayTableText(HINDI_HOLIDAY_TABLE);
    expect(holidays).toHaveLength(4);

    expect(holidays[0].name).toContain('दशहरा');
    expect(holidays[0].startDate).toBe('2026-08-15');
    expect(holidays[0].endDate).toBe('2026-08-16');
    expect(holidays[0].dayOfWeek).toBe('शनिवार');

    expect(holidays[1].name).toContain('होली');
    expect(holidays[1].startDate).toBe('2026-03-03');
    expect(holidays[1].endDate).toBe('2026-03-03');
    expect(holidays[1].dayOfWeek).toBe('मंगलवार');

    expect(holidays[3].startDate).toBe('2026-01-26');
    expect(holidays[3].dayOfWeek).toBe('सोमवार');
  });

  it('reads both date forms of the list', () => {
    const holidays = parseHolidayTableText(
      '1. गणतंत्र दिवस 26/01/2026 सोमवार\n2. होली 03-03-2026 मंगलवार',
    );
    expect(holidays).toHaveLength(2);
    expect(holidays[0].startDate).toBe('2026-01-26');
    expect(holidays[1].startDate).toBe('2026-03-03');
    expect(holidays[1].name).toContain('होली');
  });

  it('returns nothing when the text holds no date', () => {
    expect(parseHolidayTableText('कोई तारीख नहीं')).toHaveLength(0);
    expect(parseHolidayTableText('')).toHaveLength(0);
  });

  it('reports an honest failure when the list cannot be read', async () => {
    const result = await fetchHolidays2026({
      fetchImpl: async () => {
        throw new Error('offline');
      },
    });
    expect(result.ok).toBe(false);
    expect(result.method).toBe('unavailable');
    expect(result.holidays).toHaveLength(0);
    expect(result.reason).toContain('offline');
  });
});
