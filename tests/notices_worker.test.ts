/**
 * Unit Tests for Notices Scraper, Parser, Classifier, Threading & Push Pipeline
 * Per docs/DATA_SOURCES.md, docs/ARCHITECTURE.md, docs/NOTIFICATIONS.md
 */

import {
  parseMainNoticesHtml,
  parseExamsNoticesHtml,
  generateSourceId,
  enrichScrapedNotice,
  NoticesWorkerJob,
} from '../worker/noticesJob';
import {
  cleanNoticeTitle,
  detectNoticeAudience,
  extractNoticeDeadline,
  calculateNoticeImportance,
  groupNoticeThreads,
  NoticeItem,
} from '../src/features/notices/noticeService';

describe('Notices Scraper & Parser Worker', () => {
  const sampleMainHtml = `
    <html>
      <body>
        <table>
          <tr>
            <td>18/10/2026</td>
            <td><a href="/Admissions/DownloadFile?nName=MidSemDatesheet2026.pdf">Revised Schedule for Mid Semester Examination Autumn 2026</a></td>
          </tr>
          <tr>
            <td>17/10/2026</td>
            <td><a href="https://test.gbu.ac.in/Admissions/DownloadFile?nName=Fee_Ext_3.pdf">Office Order: Final Extension of Fee Submission Date for Monsoon Semester 2026-27</a></td>
          </tr>
          <tr>
            <td>10/10/2026</td>
            <td><a href="/tenders/wifi_tender.pdf">Tender Notice for Campus Wi-Fi Equipment Procurement</a></td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const sampleExamsHtml = `
    <html>
      <body>
        <div class="notices">
          <a href="/uploads/notices/datesheet_autumn_2026.pdf">B.Tech SOICT Datesheet Autumn 2026</a>
          <a href="admin/public/uploads/notices/special_back_res.pdf">Special Back Paper Results Announced for SOM MBA</a>
        </div>
      </body>
    </html>
  `;

  it('parses main notices HTML correctly and normalises URLs', () => {
    const parsed = parseMainNoticesHtml(sampleMainHtml);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].rawTitle).toBe('Revised Schedule for Mid Semester Examination Autumn 2026');
    expect(parsed[0].url).toBe('https://test.gbu.ac.in/Admissions/DownloadFile?nName=MidSemDatesheet2026.pdf');
    expect(parsed[0].dateStr).toBe('18/10/2026');
    expect(parsed[1].url).toBe('https://test.gbu.ac.in/Admissions/DownloadFile?nName=Fee_Ext_3.pdf');
  });

  it('parses exams portal HTML links correctly', () => {
    const parsed = parseExamsNoticesHtml(sampleExamsHtml);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].rawTitle).toBe('B.Tech SOICT Datesheet Autumn 2026');
    expect(parsed[0].url).toBe('https://exams.gbu.ac.in/uploads/notices/datesheet_autumn_2026.pdf');
    expect(parsed[1].url).toBe('https://exams.gbu.ac.in/admin/public/uploads/notices/special_back_res.pdf');
  });

  it('generates deterministic sourceId and enriches raw notice', () => {
    const id1 = generateSourceId('main', 'https://test.gbu.ac.in/fee.pdf', '17/10/2026');
    const id2 = generateSourceId('main', 'https://test.gbu.ac.in/fee.pdf', '17/10/2026');
    const id3 = generateSourceId('main', 'https://test.gbu.ac.in/other.pdf', '17/10/2026');
    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);

    const enriched = enrichScrapedNotice({
      source: 'main',
      rawTitle: 'Office Order: Final Extension of Fee Submission Date till 31st Oct',
      url: 'https://test.gbu.ac.in/fee.pdf',
      dateStr: '17/10/2026',
    });
    expect(enriched.cleanTitle).toBe('Final Extension of Fee Submission Date till 31st Oct');
    expect(enriched.category).toBe('fees');
    expect(enriched.fileType).toBe('pdf');
  });

  it('cleans formal administrative prefixes from notice titles', () => {
    expect(cleanNoticeTitle('Office Order: Final Extension of Fee Submission')).toBe('Final Extension of Fee Submission');
    expect(cleanNoticeTitle('Notice regarding Mid Sem Examination')).toBe('Mid Sem Examination');
    expect(cleanNoticeTitle('Urgent Notice: Hostel fee payment')).toBe('Hostel fee payment');
  });

  it('detects targeted audience (schools, programmes, semesters)', () => {
    const audience1 = detectNoticeAudience('Datesheet for SOICT B.Tech 3rd Sem Students');
    expect(audience1.schools).toContain('SOICT');
    expect(audience1.programmes).toContain('B.Tech');
    expect(audience1.all).toBe(false);

    const audience2 = detectNoticeAudience('General Holiday on Occasion of Diwali');
    expect(audience2.all).toBe(true);
    expect(audience2.schools).toBeUndefined();
  });

  it('extracts deadline dates from notice titles', () => {
    const deadline1 = extractNoticeDeadline('Final Extension of Fee Submission Date till 31st Oct 2026');
    expect(deadline1).not.toBeNull();
    const d1 = new Date(deadline1 as string);
    expect(d1.getUTCMonth()).toBe(9); // October
    expect(d1.getUTCDate()).toBe(31);

    const deadline2 = extractNoticeDeadline('Scholarship submission last date 10-11-2026');
    expect(deadline2).not.toBeNull();
    const d2 = new Date(deadline2 as string);
    expect(d2.getUTCMonth()).toBe(10); // November
    expect(d2.getUTCDate()).toBe(10);
  });

  it('calculates notice importance per NOTIFICATIONS.md specification', () => {
    // High priority fee notice with deadline
    const highImportance = calculateNoticeImportance({
      title: 'Fee Submission Deadline Extended to 31st Oct',
      category: 'fees',
      deadlineAt: '2026-10-31T23:59:59.000Z',
      audience: { all: true },
      postedAt: new Date().toISOString(),
    });
    expect(highImportance).toBeGreaterThanOrEqual(4);

    // Administrative tender
    const tenderImportance = calculateNoticeImportance({
      title: 'Tender for cafeteria canteen procurement',
      category: 'other',
      audience: { all: true },
    });
    expect(tenderImportance).toBe(0);
  });

  it('groups related notices into threads with update count', () => {
    const notices: NoticeItem[] = [
      {
        id: '1',
        source: 'main',
        sourceId: 's1',
        title: 'Fee Submission Notice Monsoon 2026',
        cleanTitle: 'Fee Submission Monsoon 2026',
        postedAt: '2026-10-01T00:00:00.000Z',
        fileUrl: 'http://test.gbu.ac.in/f1.pdf',
        fileType: 'pdf',
        category: 'fees',
        audience: { all: true },
        importance: 3,
      },
      {
        id: '2',
        source: 'main',
        sourceId: 's2',
        title: 'Office Order: Final Extension of Fee Submission Monsoon 2026',
        cleanTitle: 'Fee Submission Monsoon 2026 - Extended',
        postedAt: '2026-10-17T00:00:00.000Z',
        fileUrl: 'http://test.gbu.ac.in/f2.pdf',
        fileType: 'pdf',
        category: 'fees',
        audience: { all: true },
        importance: 4,
      },
    ];

    const grouped = groupNoticeThreads(notices);
    expect(grouped[0].threadId).toBeDefined();
    expect(grouped[0].threadId).toBe(grouped[1].threadId);
    expect(grouped[0].threadUpdateCount).toBe(2);
  });

  it('executes full NoticesWorkerJob and identifies push candidates', async () => {
    const job = new NoticesWorkerJob();
    const result = await job.runJob({
      main: sampleMainHtml,
      exams: sampleExamsHtml,
    });

    expect(result.totalScraped).toBe(5);
    expect(result.newNoticesCount).toBe(5);
    expect(result.highPriorityPushCount).toBeGreaterThan(0);
    expect(result.pushCandidates.every((n) => n.importance >= 3)).toBe(true);
  });
});
