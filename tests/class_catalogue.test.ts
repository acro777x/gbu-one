import {
  apiCodeOf,
  buildSectionCode,
  fallbackProgrammes,
  fallbackSections,
  groupSectionsIntoProgrammes,
  normaliseYearLabel,
  parsePublishedSection,
  schoolProgrammesFor,
  sectionLetterOf,
  sectionsForProgramme,
  sectionsForYear,
  yearLabelOf,
  yearOf,
  yearsForProgramme,
} from '../src/features/timetable/classCatalogue';

const LIVE_SECTIONS = [
  'BCS-I-A',
  'BCS-I-B',
  'BCS-II A',
  'BCS-II B',
  'BCS-III-A',
  'BCS-III-B',
  'BCS-IV-A',
  'BEC-I',
  'BEC-IV-A',
  'CSE-CS-I',
  'CSE-CS-II',
  'MBA-I-A',
  'MBA II',
  'BCA-I A',
  'MT-AIR-II-A',
];

describe('class catalogue: year labels', () => {
  it('treats 2nd Year, II and Year 2 as the same year', () => {
    expect(normaliseYearLabel('2nd Year')).toBe('II');
    expect(normaliseYearLabel('II')).toBe('II');
    expect(normaliseYearLabel('Year 2')).toBe('II');
    expect(normaliseYearLabel('2nd year')).toBe(normaliseYearLabel('Year 2'));
  });

  it('normalises every year label the university uses', () => {
    expect(normaliseYearLabel('1st Year')).toBe('I');
    expect(normaliseYearLabel('3rd Year')).toBe('III');
    expect(normaliseYearLabel('4th Year')).toBe('IV');
    expect(normaliseYearLabel('IV')).toBe('IV');
    expect(normaliseYearLabel('Year 3')).toBe('III');
    expect(normaliseYearLabel('')).toBe('');
  });

  it('labels a year the way a student reads it', () => {
    expect(yearLabelOf('II')).toBe('2nd Year');
    expect(yearLabelOf('2nd Year')).toBe('2nd Year');
    expect(yearLabelOf('Year 4')).toBe('4th Year');
  });
});

describe('class catalogue: reading a published code', () => {
  it('reads a code that uses a space before the section letter', () => {
    expect(parsePublishedSection('BCS-II B')).toEqual({
      programmeCode: 'BCS',
      year: 'II',
      sectionLetter: 'B',
    });
    expect(sectionLetterOf('BCS-II B')).toBe('B');
    expect(yearOf('BCS-II B')).toBe('II');
  });

  it('reads a code that uses a dash before the section letter', () => {
    expect(parsePublishedSection('BCS-III-A')).toEqual({
      programmeCode: 'BCS',
      year: 'III',
      sectionLetter: 'A',
    });
    expect(sectionLetterOf('BCS-III-A')).toBe('A');
    expect(yearOf('BCS-III-A')).toBe('III');
  });

  it('reads the other shapes the university publishes', () => {
    expect(parsePublishedSection('MBA II')).toEqual({
      programmeCode: 'MBA',
      year: 'II',
      sectionLetter: 'General',
    });
    expect(parsePublishedSection('BCA-I A')).toEqual({
      programmeCode: 'BCA',
      year: 'I',
      sectionLetter: 'A',
    });
    expect(parsePublishedSection('MT-AIR-II-A')).toEqual({
      programmeCode: 'MT-AIR',
      year: 'II',
      sectionLetter: 'A',
    });
    expect(parsePublishedSection('CSE-CS-III')).toEqual({
      programmeCode: 'CSE-CS',
      year: 'III',
      sectionLetter: 'General',
    });
    expect(parsePublishedSection('Ph.D. Biotechnology')).toEqual({
      programmeCode: 'Ph.D. Biotechnology',
      year: '',
      sectionLetter: 'General',
    });
  });
});

describe('class catalogue: building a section code', () => {
  it('prefers the code the university publishes', () => {
    expect(buildSectionCode('BCS', 'II', 'B', LIVE_SECTIONS)).toBe('BCS-II B');
    expect(buildSectionCode('BCS', 'III', 'A', LIVE_SECTIONS)).toBe('BCS-III-A');
    expect(buildSectionCode('CSE-CS', 'I', 'General', LIVE_SECTIONS)).toBe('CSE-CS-I');
  });

  it('finds the published code through the university programme code', () => {
    expect(apiCodeOf('CSE-CS')).toBe('CSE-Cyber');
    expect(buildSectionCode('CSE-Cyber', 'II', 'General', LIVE_SECTIONS)).toBe('CSE-CS-II');
  });

  it('falls back to a code in the university separator style when nothing is published', () => {
    expect(buildSectionCode('BCS', 'V', 'A', LIVE_SECTIONS)).toBe('BCS-V-A');
    expect(buildSectionCode('BCS', 'II', 'Z', LIVE_SECTIONS)).toBe('BCS-II Z');
  });
});

describe('class catalogue: grouping the live list', () => {
  const live = [
    { section: 'BCS-II B', school: 'SOICT', programme: 'B.Tech (CS)', programmeCode: 'BCS' },
    { section: 'BCS-III-A', school: 'SOICT', programme: 'B.Tech (CS)', programmeCode: 'BCS' },
    { section: 'CSE-CS-I', school: 'SOICT', programme: 'B.Tech. CSE Cyber Security', programmeCode: 'CSE-Cyber' },
    { section: 'MBA II', school: 'SOM', programme: 'MBA', programmeCode: 'MBA' },
  ];

  it('groups the published codes into programmes', () => {
    const programmes = groupSectionsIntoProgrammes(live);
    expect(programmes.map((programme) => programme.code)).toEqual([
      'BCS',
      'CSE-CS',
      'MBA',
    ]);
    const bcs = programmes.find((programme) => programme.code === 'BCS');
    expect(bcs?.name).toBe('B.Tech (CS)');
    expect(bcs?.school).toBe('SOICT');
    expect(bcs?.apiCode).toBe('BCS');
  });

  it('keeps the university programme code next to the published prefix', () => {
    const programmes = groupSectionsIntoProgrammes(live);
    const cyber = programmes.find((programme) => programme.code === 'CSE-CS');
    expect(cyber?.apiCode).toBe('CSE-Cyber');
    expect(cyber?.name).toBe('B.Tech. CSE Cyber Security');
  });

  it('offers only the years and sections that exist', () => {
    expect(yearsForProgramme(LIVE_SECTIONS, 'BCS')).toEqual(['I', 'II', 'III', 'IV']);
    expect(yearsForProgramme(LIVE_SECTIONS, 'BEC')).toEqual(['I', 'IV']);
    expect(yearsForProgramme(LIVE_SECTIONS, 'BCS')).not.toContain('V');

    expect(sectionsForYear(LIVE_SECTIONS, 'BCS', 'II')).toEqual(['BCS-II A', 'BCS-II B']);
    expect(sectionsForYear(LIVE_SECTIONS, 'BCS', 'V')).toEqual([]);
    expect(sectionsForYear(LIVE_SECTIONS, 'BCS', 'III')).toEqual(['BCS-III-A', 'BCS-III-B']);
  });

  it('lists the sections of one programme only', () => {
    const sections = sectionsForProgramme(LIVE_SECTIONS, 'BCS');
    expect(sections.map((section) => section.section)).toEqual([
      'BCS-I-A',
      'BCS-I-B',
      'BCS-II A',
      'BCS-II B',
      'BCS-III-A',
      'BCS-III-B',
      'BCS-IV-A',
    ]);
    expect(sections.every((section) => section.programmeCode === 'BCS')).toBe(true);
  });

  it('does not leak one programme into another that shares a code', () => {
    const codes = ['BCE-I', 'BEE-I', 'BEE-II', 'BME-I'];
    expect(sectionsForProgramme(codes, 'BEE').map((section) => section.section)).toEqual([
      'BEE-I',
      'BEE-II',
    ]);
  });

  it('groups the programmes of one school', () => {
    const programmes = groupSectionsIntoProgrammes(live);
    expect(schoolProgrammesFor(programmes, 'SOM').map((programme) => programme.code)).toEqual([
      'MBA',
    ]);
    expect(schoolProgrammesFor(programmes, 'SOICT')).toHaveLength(2);
  });
});

describe('class catalogue: the offline fallback', () => {
  it('ships the published class codes', () => {
    const sections = fallbackSections();
    expect(sections).toContain('BCS-II B');
    expect(sections).toContain('BCS-III-A');
    expect(sections).toContain('CSE-CS-II');
    expect(new Set(sections).size).toBe(sections.length);
  });

  it('ships a programme list for every school the university runs', () => {
    const programmes = fallbackProgrammes();
    const codes = fallbackSections();
    expect(programmes.length).toBeGreaterThan(0);
    expect(programmes.find((programme) => programme.code === 'BCS')?.name).toBe(
      'B.Tech (CS)',
    );
    expect(programmes.find((programme) => programme.code === 'BCS')?.school).toBe('SOICT');
    expect(
      programmes.every(
        (programme) => sectionsForProgramme(codes, programme.code).length > 0,
      ),
    ).toBe(true);
  });

  it('keeps the fallback codes usable as stored class keys', () => {
    const codes = fallbackSections();
    expect(buildSectionCode('BCS', 'II', 'B', codes)).toBe('BCS-II B');
    expect(buildSectionCode('BCS', 'III', 'A', codes)).toBe('BCS-III-A');
  });
});
