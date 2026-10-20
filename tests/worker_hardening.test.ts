import {
  isSoft404,
  generateSourceId,
  NoticesWorkerJob,
} from '../worker/noticesJob';
import { resolveOcrProvider, hashContent, isAlreadyProcessed, markProcessed } from '../worker/ocrService';

describe('GBU soft-404 detection', () => {
  it('flags the canonical ~38,725-byte "404 - Page not found" page', () => {
    const fake = 'x'.repeat(38725 - 30) + '404 - Page not found';
    expect(isSoft404(fake)).toBe(true);
  });

  it('flags bodies in the soft-404 length band even without the marker', () => {
    expect(isSoft404('a'.repeat(38700))).toBe(true);
  });

  it('accepts the real notices page shape', () => {
    const real = '<html>' + 'n'.repeat(146859) + '</html>';
    expect(isSoft404(real)).toBe(false);
  });

  it('treats empty bodies as failures', () => {
    expect(isSoft404('')).toBe(true);
  });
});

describe('sourceId idempotency', () => {
  it('is deterministic for identical inputs', () => {
    const a = generateSourceId('main', 'https://www.gbu.ac.in/x.pdf', '01 Oct 2026');
    const b = generateSourceId('main', 'https://www.gbu.ac.in/x.pdf', '01 Oct 2026');
    expect(a).toBe(b);
    expect(a).toMatch(/^src_[a-z0-9]+$/);
  });

  it('differs when url or date differs', () => {
    const a = generateSourceId('main', 'https://www.gbu.ac.in/x.pdf', '01 Oct 2026');
    const b = generateSourceId('main', 'https://www.gbu.ac.in/y.pdf', '01 Oct 2026');
    const c = generateSourceId('main', 'https://www.gbu.ac.in/x.pdf', '02 Oct 2026');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('seeded worker does not re-report known ids as new', async () => {
    // resolveMainNotices hrefs against test.gbu.ac.in (see parseMainNoticesHtml)
    const id = generateSourceId(
      'main',
      'https://test.gbu.ac.in/Admissions/DownloadFile?nName=known.pdf',
      '01 Oct 2026'
    );
    const worker = new NoticesWorkerJob([id]);
    const html = `
      <table>
        <tr><td>01 Oct 2026</td>
        <td><a href="/Admissions/DownloadFile?nName=known.pdf">Known Notice</a></td></tr>
      </table>`;
    const res = await worker.runJob({
      main: html,
      exams: '<table><tr><td>01 Oct 2026</td><td><a href="/uploads/x.pdf">Exam Notice</a></td></tr></table>',
      hostel: '',
      ohms: '',
      csms: '',
      digiforms: '',
    });
    expect(res.notices.length).toBeGreaterThanOrEqual(1);
    expect(res.newNoticesCount).toBeLessThan(res.totalScraped);
  });
});

describe('OCR provider decision (OPEN_QUESTIONS #4)', () => {
  it('defaults to tesseract', () => {
    expect(resolveOcrProvider({})).toBe('tesseract');
  });

  it('uses vision only when explicitly configured with a key', () => {
    expect(resolveOcrProvider({ OCR_PROVIDER: 'vision' })).toBe('tesseract');
    expect(resolveOcrProvider({ OCR_PROVIDER: 'vision', VISION_API_KEY: 'k' })).toBe('vision');
  });
});

describe('OCR content-hash dedupe', () => {
  it('never reprocesses the same bytes', () => {
    const h = hashContent(Buffer.from('same-bytes'));
    expect(isAlreadyProcessed(h)).toBe(false);
    markProcessed(h);
    expect(isAlreadyProcessed(hashContent(Buffer.from('same-bytes')))).toBe(true);
    expect(isAlreadyProcessed(hashContent(Buffer.from('other')))).toBe(false);
  });
});
