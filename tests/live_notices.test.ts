import {
  EXAM_NOTICES_URL,
  MAIN_NOTICES_MIRROR_URL,
  MAIN_NOTICES_URL,
  classifyLiveNotice,
  fetchLiveNotices,
  parseDateSheetModalLinks,
  parseExamNoticesHtml,
  parseMainNoticesHtml,
  resolveAbsoluteUrl,
  scoreLiveNoticeImportance,
} from '../src/features/notices/liveNotices';

const MAIN_HTML = `
<html><body>
<table class="table table-condensed table-striped">
  <tr>
    <th style="width:150px">Date</th>
    <th>Title</th>
  </tr>
  <tr>
    <td>21 Oct 2026</td>
    <td><a href="/Admissions/DownloadFile?nName=-1071752_8ba41d50.pdfNew%20Township%20Project.pdf" target="_blank">Expression of Interest in the SIA Project</a></td>
  </tr>
  <tr>
    <td>01 Oct 2026</td>
    <td><a href="/Admissions/DownloadFile?nName=-3239624_135ecad8.pdfScan30092026.pdf" target="_blank">Notice for Scholarship on NSP Portal</a></td>
  </tr>
  <tr>
    <td>18 Sep 2026</td>
    <td>Board of Studies Meeting Schedule</td>
  </tr>
  <tr>
    <td>17 Sep 2026</td>
    <td><a href="/Admissions/DownloadFile?nName=15075047_e33e3e00.pdfScooterUyjona.pdf">Rani&#39;s Scooty Yojna &amp; Guidelines</a></td>
  </tr>
</table>
</body></html>`;

const MALFORMED_HTML = `
<table>
  <tr><th>Date</th><th>Title</th></tr>
  <tr><td>12 Aug 2026</td><td><a href="/Admissions/DownloadFile?nName=broken.pdfBroken%20Notice">Broken Notice</a>
  <tr><td>11 Aug 2026</td><td><a href="/Admissions/DownloadFile?nName=ok.pdfFine%20Notice">Fine Notice</a></td></tr>
</table>`;

const EXAM_HTML = `
<div class="card-body">
  <div class="notice-item border-bottom pb-3 mb-3">
    <div class="d-flex justify-content-between align-items-start gap-2">
      <div class="flex-grow-1">
        <h6 class="mb-1 text-dark">Special back passout and not promoted Revised Result</h6>
        <p class="small text-muted mb-2">Posted on: 07-10-2026</p>
        <a href="/admin/public/uploads/notices/Revise.pdf" target="_blank" class="text-primary text-decoration-none">View Attachment</a>
      </div>
      <span class="badge bg-danger flex-shrink-0">New</span>
    </div>
  </div>
  <div class="notice-item border-bottom pb-3 mb-3">
    <div class="d-flex justify-content-between align-items-start gap-2">
      <div class="flex-grow-1">
        <h6 class="mb-1 text-dark">Datesheet for End Semester Examination &ndash; December 2025</h6>
        <p class="small text-muted mb-2">Posted on: 05-12-2025</p>
        <a href="javascript:void(0)" class="text-primary fw-semibold" data-bs-toggle="modal" onclick="loadDateSheetModal()">View School-wise Datesheet</a>
      </div>
    </div>
  </div>
  <div class="notice-item border-bottom pb-3 mb-3">
    <div class="d-flex justify-content-between align-items-start gap-2">
      <div class="flex-grow-1">
        <h6 class="mb-1 text-dark">Notice Regarding Back Paper Examinations- Dec 2025</h6>
        <p class="small text-muted mb-2">Posted on: 22-11-2025</p>
        <a href="uploads/notices/Back-paper-odd-sem-dec-2025.pdf" class="text-primary text-decoration-none">View Attachment</a>
      </div>
    </div>
  </div>
  <div class="notice-item border-bottom pb-3 mb-3">
    <div class="d-flex justify-content-between align-items-start gap-2">
      <div class="flex-grow-1">
        <h6 class="mb-1 text-dark">Notice regarding Special Back Paper Examination for Not Promoted Students</h6>
        <p class="small text-muted mb-2">Posted on: 01-7-2026</p>
      </div>
    </div>
  </div>
</div>
<div class="modal fade" id="commonNoticeModal">
  <div class="modal-body" id="commonNoticeModalBody"><!-- Dynamic content will load here --></div>
</div>
<script>
  function loadDateSheetModal() {
    document.getElementById('commonNoticeModalTitle').innerText = 'School-wise Datesheet';
    document.getElementById('commonNoticeModalBody').innerHTML = \`
      <table class="table table-bordered">
        <tr><td>School of Information &amp; Communication Technology (SOICT)</td>
            <td><a href="uploads/datesheet/soict-end-sem-dec-2025.pdf" target="_blank">View PDF</a></td></tr>
        <tr><td>School of Engineering (SOE)</td>
            <td><a href="uploads/datesheet/soe-end-sem-dec-2025.pdf" target="_blank">View PDF</a></td></tr>
        <tr><td>School of Biotechnology (SOBT)</td>
            <td><a href="uploads/datesheet/sobt-end-sem-dec-2025.pdf" target="_blank">View PDF</a></td></tr>
        <tr><td>School of Humanities &amp; Social Sciences (SOHSS)</td>
            <td><a href="uploads/datesheet/sohss-end-sem-dec-2025.pdf" target="_blank">View PDF</a></td></tr>
        <tr><td>School of Management (SOM)</td>
            <td><a href="uploads/datesheet/som-end-sem-dec-2025.pdf" target="_blank">View PDF</a></td></tr>
        <tr><td>School of Law &amp; Jurisprudence (SOLJG)</td>
            <td><a href="uploads/datesheet/soljg-end-sem-dec-2025.pdf" target="_blank">View PDF</a></td></tr>
        <tr><td>School of Vocational Agriculture &amp; Animal Sciences (SOVASAS)</td>
            <td><a href="uploads/datesheet/sovasas-end-sem-dec-2025.pdf" target="_blank">View PDF</a></td></tr>
        <tr><td>School of Basic Sciences (SOBSC)</td>
            <td><a href="uploads/datesheet/sobsc-end-sem-dec-2025.pdf" target="_blank">View PDF</a></td></tr>
      </table>\`;
  }
</script>`;

const DUPLICATE_EXAM_HTML = `
<div class="notice-item border-bottom pb-3 mb-3">
  <div class="flex-grow-1">
    <h6 class="mb-1 text-dark">Notice for Scholarship on NSP Portal</h6>
    <p class="small text-muted mb-2">Posted on: 01-10-2026</p>
    <a href="https://www.gbu.ac.in/Admissions/DownloadFile?nName=-3239624_135ecad8.pdfScan30092026.pdf">View Attachment</a>
  </div>
</div>`;

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function makeFetch(
  handlers: Record<string, () => string | Response>
): { impl: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    calls.push({ url, init });
    const handler = handlers[url];
    if (!handler) throw new Error(`unexpected url: ${url}`);
    const result = handler();
    if (result instanceof Response) return result;
    return new Response(result, { status: 200, headers: { 'Content-Type': 'text/html' } });
  };
  return { impl: impl as typeof fetch, calls };
}

describe('parseMainNoticesHtml (source A)', () => {
  it('parses every data row and ignores the Date/Title header row', () => {
    const notices = parseMainNoticesHtml(MAIN_HTML);
    expect(notices).toHaveLength(4);
    expect(notices.every((notice) => notice.source === 'main')).toBe(true);
    expect(notices.some((notice) => notice.title === 'Date')).toBe(false);
  });

  it('resolves a relative attachment href against the university host', () => {
    const notices = parseMainNoticesHtml(MAIN_HTML);
    const first = notices[0];
    expect(first.title).toBe('Expression of Interest in the SIA Project');
    expect(first.fileUrl).toBe(
      'https://www.gbu.ac.in/Admissions/DownloadFile?nName=-1071752_8ba41d50.pdfNew%20Township%20Project.pdf'
    );
    expect(first.attachmentKind).toBe('file');
  });

  it('never double-encodes the already encoded nName query value', () => {
    const notices = parseMainNoticesHtml(MAIN_HTML);
    expect(notices[0].fileUrl).toContain('%20Township%20Project.pdf');
    expect(notices[0].fileUrl).not.toContain('%2520');
  });

  it('keeps a row without any attachment with a null file url', () => {
    const notices = parseMainNoticesHtml(MAIN_HTML);
    const withoutFile = notices.find((notice) => notice.title === 'Board of Studies Meeting Schedule');
    expect(withoutFile).toBeDefined();
    expect(withoutFile?.fileUrl).toBeNull();
    expect(withoutFile?.attachmentKind).toBe('none');
  });

  it('decodes html entities and collapses whitespace in titles', () => {
    const notices = parseMainNoticesHtml(MAIN_HTML);
    const encoded = notices.find((notice) => notice.title.startsWith('Rani'));
    expect(encoded?.title).toBe("Rani's Scooty Yojna & Guidelines");
  });

  it('parses the DD Mon YYYY publication date into an ISO instant', () => {
    const notices = parseMainNoticesHtml(MAIN_HTML);
    expect(notices[0].postedAt).toBe('2026-10-21T00:00:00.000Z');
    expect(notices[0].postedOn).toBe('21 Oct 2026');
  });

  it('classifies notices and scores their importance', () => {
    const notices = parseMainNoticesHtml(MAIN_HTML);
    const scholarship = notices.find((notice) => notice.title.includes('Scholarship'));
    expect(scholarship?.category).toBe('scholarship');
    expect(scholarship?.importance).toBe(2);
    expect(classifyLiveNotice('Revised Date Sheet for End Semester Examination')).toBe('datesheet');
    expect(classifyLiveNotice('Tender Notice for Campus Wi-Fi Maintenance')).toBe('other');
    expect(classifyLiveNotice('Notice for NCC Enrollment and Selection Process')).toBe('event');
    expect(classifyLiveNotice('Tablet Distribution programme for Students')).toBe('scholarship');
    expect(classifyLiveNotice('Corrigendum Regarding Eligibility of M.Tech. Programme')).toBe('academic');
    expect(scoreLiveNoticeImportance('Last date extended for Back Paper form', 'exam')).toBe(5);
  });

  it('returns the notices newest first', () => {
    const notices = parseMainNoticesHtml(MAIN_HTML);
    expect(notices.map((notice) => notice.postedAt)).toEqual([
      '2026-10-21T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z',
      '2026-09-18T00:00:00.000Z',
      '2026-09-17T00:00:00.000Z',
    ]);
  });
});

describe('parseExamNoticesHtml (source B)', () => {
  it('parses every notice block including the ones hidden behind #allNotices', () => {
    const notices = parseExamNoticesHtml(EXAM_HTML);
    expect(notices).toHaveLength(4);
    expect(notices.every((notice) => notice.source === 'exams')).toBe(true);
    expect(notices.some((notice) => notice.title.includes('Not Promoted Students'))).toBe(true);
  });

  it('reads the title, the posted date and the New badge', () => {
    const notices = parseExamNoticesHtml(EXAM_HTML);
    const revisedResult = notices.find((notice) => notice.title.startsWith('Special back'));
    expect(revisedResult?.title).toBe('Special back passout and not promoted Revised Result');
    expect(revisedResult?.postedAt).toBe('2026-10-07T00:00:00.000Z');
    expect(revisedResult?.postedOn).toBe('Posted on: 07-10-2026');
    expect(revisedResult?.isNew).toBe(true);
    expect(revisedResult?.category).toBe('result');
  });

  it('resolves both attachment roots used by the exam portal', () => {
    const notices = parseExamNoticesHtml(EXAM_HTML);
    const revisedResult = notices.find((notice) => notice.title.startsWith('Special back'));
    expect(revisedResult?.fileUrl).toBe(
      'https://exams.gbu.ac.in/admin/public/uploads/notices/Revise.pdf'
    );
    const older = notices.find((notice) => notice.title.startsWith('Notice Regarding Back Paper'));
    expect(older?.fileUrl).toBe('https://exams.gbu.ac.in/uploads/notices/Back-paper-odd-sem-dec-2025.pdf');
  });

  it('turns the javascript:void(0) notice into a modal notice with recovered date sheets', () => {
    const notices = parseExamNoticesHtml(EXAM_HTML);
    const datesheet = notices.find((notice) => notice.title.includes('School-wise') === false && notice.title.includes('December 2025'));
    expect(datesheet).toBeDefined();
    expect(datesheet?.fileUrl).toBeNull();
    expect(datesheet?.attachmentKind).toBe('modal');
    expect(datesheet?.attachmentLabel).toBe('View School-wise Datesheet');
    expect(datesheet?.relatedUrls).toHaveLength(8);
    expect(datesheet?.relatedUrls).toContain(
      'https://exams.gbu.ac.in/uploads/datesheet/soict-end-sem-dec-2025.pdf'
    );
  });

  it('handles a notice without any link and a single digit month', () => {
    const notices = parseExamNoticesHtml(EXAM_HTML);
    const noLink = notices.find((notice) => notice.title.includes('Not Promoted Students'));
    expect(noLink?.fileUrl).toBeNull();
    expect(noLink?.attachmentKind).toBe('none');
    expect(noLink?.postedAt).toBe('2026-07-01T00:00:00.000Z');
  });

  it('decodes the entity encoded en dash in the title', () => {
    const notices = parseExamNoticesHtml(EXAM_HTML);
    const datesheet = notices.find((notice) => notice.title.includes('December 2025'));
    expect(datesheet?.title).toBe('Datesheet for End Semester Examination – December 2025');
  });

  it('returns the notices newest first even when the page is not sorted', () => {
    const notices = parseExamNoticesHtml(EXAM_HTML);
    expect(notices.map((notice) => notice.postedAt)).toEqual([
      '2026-10-07T00:00:00.000Z',
      '2026-07-01T00:00:00.000Z',
      '2025-12-05T00:00:00.000Z',
      '2025-11-22T00:00:00.000Z',
    ]);
  });
});

describe('parseDateSheetModalLinks', () => {
  it('recovers the school wise date sheet pdf mapping from the inline script', () => {
    const links = parseDateSheetModalLinks(EXAM_HTML);
    expect(links).toHaveLength(8);
    expect(links.map((link) => link.schoolCode)).toEqual([
      'soict',
      'soe',
      'sobt',
      'sohss',
      'som',
      'soljg',
      'sovasas',
      'sobsc',
    ]);
    expect(links[0].url).toBe('https://exams.gbu.ac.in/uploads/datesheet/soict-end-sem-dec-2025.pdf');
  });

  it('returns an empty list when the page has no inline modal script', () => {
    expect(parseDateSheetModalLinks('<html><body>nothing here</body></html>')).toEqual([]);
  });
});

describe('resolveAbsoluteUrl', () => {
  it('resolves relative paths against the page directory', () => {
    expect(resolveAbsoluteUrl('uploads/notices/a.pdf', 'https://exams.gbu.ac.in/')).toBe(
      'https://exams.gbu.ac.in/uploads/notices/a.pdf'
    );
  });

  it('resolves root relative paths against the origin', () => {
    expect(
      resolveAbsoluteUrl('/Admissions/DownloadFile?nName=abc.pdf', 'https://www.gbu.ac.in/page/notices')
    ).toBe('https://www.gbu.ac.in/Admissions/DownloadFile?nName=abc.pdf');
  });

  it('rejects links that are not downloadable files', () => {
    expect(resolveAbsoluteUrl('javascript:void(0)', EXAM_NOTICES_URL)).toBeNull();
    expect(resolveAbsoluteUrl('mailto:office@gbu.ac.in', EXAM_NOTICES_URL)).toBeNull();
    expect(resolveAbsoluteUrl('', EXAM_NOTICES_URL)).toBeNull();
  });

  it('encodes raw spaces but preserves existing percent escapes', () => {
    expect(resolveAbsoluteUrl('https://exams.gbu.ac.in/a b.pdf', EXAM_NOTICES_URL)).toBe(
      'https://exams.gbu.ac.in/a%20b.pdf'
    );
    expect(resolveAbsoluteUrl('/x%20y.pdf', 'https://www.gbu.ac.in/page/notices')).toBe(
      'https://www.gbu.ac.in/x%20y.pdf'
    );
  });
});

describe('malformed html', () => {
  it('does not throw on broken rows and still recovers usable notices', () => {
    let notices: ReturnType<typeof parseMainNoticesHtml> = [];
    expect(() => {
      notices = parseMainNoticesHtml(MALFORMED_HTML);
    }).not.toThrow();
    expect(notices).toHaveLength(2);
    expect(notices.map((notice) => notice.title)).toContain('Broken Notice');
    expect(notices[0].fileUrl).toBe(
      'https://www.gbu.ac.in/Admissions/DownloadFile?nName=broken.pdfBroken%20Notice'
    );
  });

  it('returns an empty list for empty or unrelated input', () => {
    expect(parseMainNoticesHtml('')).toEqual([]);
    expect(parseExamNoticesHtml('')).toEqual([]);
    expect(parseMainNoticesHtml('<div><p>nothing tabular here</p></div>')).toEqual([]);
  });
});

describe('fetchLiveNotices', () => {
  it('merges both live sources, reports the sources and returns no errors', async () => {
    const { impl, calls } = makeFetch({
      [MAIN_NOTICES_URL]: () => MAIN_HTML,
      [EXAM_NOTICES_URL]: () => EXAM_HTML,
    });

    const result = await fetchLiveNotices({ fetchImpl: impl });

    expect(result.errors).toEqual([]);
    expect(result.sources).toEqual([MAIN_NOTICES_URL, EXAM_NOTICES_URL]);
    expect(result.notices).toHaveLength(8);
    expect(calls.map((call) => call.url)).toEqual([MAIN_NOTICES_URL, EXAM_NOTICES_URL]);
  });

  it('returns the merged notices newest first', async () => {
    const { impl } = makeFetch({
      [MAIN_NOTICES_URL]: () => MAIN_HTML,
      [EXAM_NOTICES_URL]: () => EXAM_HTML,
    });

    const result = await fetchLiveNotices({ fetchImpl: impl });
    const dates = result.notices.map((notice) => notice.postedAt ?? '');
    expect(dates).toEqual([...dates].sort().reverse());
    expect(result.notices[0].postedAt).toBe('2026-10-21T00:00:00.000Z');
  });

  it('de-duplicates notices that share the same absolute url and title', async () => {
    const { impl } = makeFetch({
      [MAIN_NOTICES_URL]: () => MAIN_HTML,
      [EXAM_NOTICES_URL]: () => DUPLICATE_EXAM_HTML,
    });

    const result = await fetchLiveNotices({ fetchImpl: impl });
    const matches = result.notices.filter(
      (notice) => notice.title === 'Notice for Scholarship on NSP Portal'
    );
    expect(matches).toHaveLength(1);
    expect(result.notices).toHaveLength(4);
  });

  it('falls back to the test.gbu.ac.in mirror when the primary host fails', async () => {
    const { impl } = makeFetch({
      [MAIN_NOTICES_URL]: () => {
        throw new Error('network unreachable');
      },
      [MAIN_NOTICES_MIRROR_URL]: () => MAIN_HTML,
      [EXAM_NOTICES_URL]: () => EXAM_HTML,
    });

    const result = await fetchLiveNotices({ fetchImpl: impl });
    expect(result.sources).toContain(MAIN_NOTICES_MIRROR_URL);
    expect(result.sources).not.toContain(MAIN_NOTICES_URL);
    expect(result.errors.join(' ')).toContain('network unreachable');
    expect(result.notices.length).toBeGreaterThan(0);
  });

  it('never throws when every request fails', async () => {
    const { impl } = makeFetch({
      [MAIN_NOTICES_URL]: () => {
        throw new Error('boom');
      },
      [MAIN_NOTICES_MIRROR_URL]: () => {
        throw new Error('boom');
      },
      [EXAM_NOTICES_URL]: () => {
        throw new Error('boom');
      },
    });

    const result = await fetchLiveNotices({ fetchImpl: impl });
    expect(result.notices).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join(' ')).toContain('boom');
  });

  it('treats the gbu soft-404 page as a failure instead of data', async () => {
    const { impl } = makeFetch({
      [MAIN_NOTICES_URL]: () => '<html><body>404 - Page not found</body></html>',
      [MAIN_NOTICES_MIRROR_URL]: () => '<html><body>404 - Page not found</body></html>',
      [EXAM_NOTICES_URL]: () => EXAM_HTML,
    });

    const result = await fetchLiveNotices({ fetchImpl: impl });
    expect(result.errors.join(' ')).toContain('soft-404');
    expect(result.notices.every((notice) => notice.source === 'exams')).toBe(true);
  });

  it('gives every request an abort signal so a slow host cannot hang the app', async () => {
    const { impl, calls } = makeFetch({
      [MAIN_NOTICES_URL]: () => MAIN_HTML,
      [EXAM_NOTICES_URL]: () => EXAM_HTML,
    });

    await fetchLiveNotices({ fetchImpl: impl, timeoutMs: 5000 });
    expect(calls).toHaveLength(2);
    expect(calls[0].init?.signal).toBeDefined();
    expect(typeof calls[0].init?.signal?.aborted).toBe('boolean');
  });
});
