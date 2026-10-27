/**
 * Unit tests for the pure helpers behind the notice document viewer.
 *
 * The GBU download endpoint is the reason these exist: it answers with HTML
 * error pages instead of documents, sometimes with HTTP 500 and sometimes
 * with HTTP 200 and a "404 - Page not found" body. Every branch of that
 * behaviour is pinned down here so the viewer never renders a blank screen.
 */
import {
  buildCacheFileName,
  describeDownloadProblem,
  hostOfUrl,
  isPdfErrorPage,
  isProbablyImage,
  isProbablyPdf,
  isSafePdfUrl,
  looksLikeImageUrl,
  looksLikePdfUrl,
  looksLikeSoft404,
  MIN_PDF_BYTES,
} from '../src/components/pdf/pdfHelpers';

const PDF_HEAD = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj';

const SOFT_404_BODY = `
<!DOCTYPE html>
<html><head><title>404 - Page not found</title></head>
<body><h1>404 - Page not found</h1><p>The requested resource is not available.</p></body></html>
`;

const ERROR_PAGE_BODY = `
<!DOCTYPE html>
<html><head><title>Error</title></head>
<body><h1>Error</h1><p>An error occurred while processing your request.</p></body></html>
`;

describe('isProbablyPdf', () => {
  it('accepts a real PDF header', () => {
    expect(isProbablyPdf(PDF_HEAD)).toBe(true);
  });

  it('rejects an HTML error page', () => {
    expect(isProbablyPdf(ERROR_PAGE_BODY)).toBe(false);
  });

  it('rejects an empty body', () => {
    expect(isProbablyPdf('')).toBe(false);
  });

  it('finds the magic a little way into the file', () => {
    expect(isProbablyPdf(`\uFEFF${PDF_HEAD}`)).toBe(true);
  });
});

describe('looksLikeSoft404', () => {
  it('recognises the GBU soft 404 body', () => {
    expect(looksLikeSoft404(SOFT_404_BODY)).toBe(true);
  });

  it('ignores a real document', () => {
    expect(looksLikeSoft404(PDF_HEAD)).toBe(false);
  });

  it('needs both the code and the wording', () => {
    expect(looksLikeSoft404('Error 500 while processing your request')).toBe(false);
  });
});

describe('isPdfErrorPage', () => {
  it('recognises the GBU error page', () => {
    expect(isPdfErrorPage(ERROR_PAGE_BODY)).toBe(true);
  });

  it('ignores a real document', () => {
    expect(isPdfErrorPage(PDF_HEAD)).toBe(false);
  });

  it('ignores the soft 404 page', () => {
    expect(isPdfErrorPage(SOFT_404_BODY)).toBe(false);
  });
});

describe('describeDownloadProblem', () => {
  it('explains a soft 404 that arrived with HTTP 200', () => {
    const message = describeDownloadProblem(200, SOFT_404_BODY, 38_000);
    expect(message).toContain('404 - Page not found');
  });

  it('explains the error page that arrived with HTTP 500', () => {
    const message = describeDownloadProblem(500, ERROR_PAGE_BODY, 4_000);
    expect(message).toContain('error page');
  });

  it('reports a refused download', () => {
    const message = describeDownloadProblem(403, '', 0);
    expect(message).toContain('403');
  });

  it('reports a body that is not a PDF at all', () => {
    const message = describeDownloadProblem(200, '<html><body>Login</body></html>', 900);
    expect(message).toContain('not a PDF');
  });

  it('reports a file that is too small to be a document', () => {
    const message = describeDownloadProblem(200, PDF_HEAD, 10);
    expect(message).toContain('10 bytes');
  });

  it('never returns an empty sentence', () => {
    const message = describeDownloadProblem(200, PDF_HEAD, 120_000);
    expect(message.length).toBeGreaterThan(10);
  });
});

describe('isSafePdfUrl', () => {
  it('accepts an https link', () => {
    expect(isSafePdfUrl('https://www.gbu.ac.in/Admissions/DownloadFile?nName=a.pdf')).toBe(true);
  });

  it('accepts an http link', () => {
    expect(isSafePdfUrl('http://exams.gbu.ac.in/notices/a.pdf')).toBe(true);
  });

  it('refuses a local file', () => {
    expect(isSafePdfUrl('file:///data/user/0/in.gbu.one/cache/a.pdf')).toBe(false);
  });

  it('refuses a script url', () => {
    expect(isSafePdfUrl('javascript:alert(1)')).toBe(false);
  });

  it('refuses a content handle', () => {
    expect(isSafePdfUrl('content://in.gbu.one.provider/a.pdf')).toBe(false);
  });

  it('refuses an empty string', () => {
    expect(isSafePdfUrl('')).toBe(false);
  });

  it('refuses a url that smuggles a second scheme', () => {
    expect(isSafePdfUrl('https://gbu.ac.in/a.pdf\njavascript:alert(1)')).toBe(false);
  });
});

describe('cache file names', () => {
  it('is stable for the same url', () => {
    expect(buildCacheFileName('https://gbu.ac.in/a.pdf')).toBe(
      buildCacheFileName('https://gbu.ac.in/a.pdf'),
    );
  });

  it('differs for two different urls', () => {
    expect(buildCacheFileName('https://gbu.ac.in/a.pdf')).not.toBe(
      buildCacheFileName('https://gbu.ac.in/b.pdf'),
    );
  });

  it('ends with the pdf extension', () => {
    expect(buildCacheFileName('https://gbu.ac.in/a.pdf').endsWith('.pdf')).toBe(true);
  });

  it('ends with the image extension for image links', () => {
    expect(buildCacheFileName('https://gbu.ac.in/scan.jpg').endsWith('.jpg')).toBe(true);
    expect(buildCacheFileName('https://gbu.ac.in/scan.png').endsWith('.png')).toBe(true);
  });

  it('gives two overlapping runs of the same url their own file', () => {
    expect(buildCacheFileName('https://gbu.ac.in/a.pdf', 1)).not.toBe(
      buildCacheFileName('https://gbu.ac.in/a.pdf', 2),
    );
  });
});

describe('isProbablyImage', () => {
  it('accepts JPEG bytes', () => {
    expect(isProbablyImage('\xFF\xD8\xFF\xE0\x00\x10JFIF')).toBe(true);
  });

  it('accepts PNG bytes', () => {
    expect(isProbablyImage('\x89PNG\r\n\x1a\n')).toBe(true);
  });

  it('accepts WebP and GIF bytes', () => {
    expect(isProbablyImage('RIFF1234WEBPVP8')).toBe(true);
    expect(isProbablyImage('GIF89a')).toBe(true);
  });

  it('rejects PDF or short content', () => {
    expect(isProbablyImage(PDF_HEAD)).toBe(false);
    expect(isProbablyImage('')).toBe(false);
    expect(isProbablyImage('ab')).toBe(false);
  });
});

describe('attachment kinds', () => {
  it('sees a PDF behind the GBU download endpoint', () => {
    expect(
      looksLikePdfUrl(
        'https://www.gbu.ac.in/Admissions/DownloadFile?nName=21370280_a0c8e722.pdfNCC%20Enrollment.pdf',
      ),
    ).toBe(true);
  });

  it('sees a PDF on the exam portal', () => {
    expect(looksLikePdfUrl('https://exams.gbu.ac.in/admin/public/uploads/notices/abc.pdf')).toBe(
      true,
    );
  });

  it('does not mistake a portal home page for a PDF', () => {
    expect(looksLikePdfUrl('https://exams.gbu.ac.in/')).toBe(false);
  });

  it('sees an image', () => {
    expect(looksLikeImageUrl('https://gbu.ac.in/notice.jpg')).toBe(true);
  });

  it('does not mistake a PDF for an image', () => {
    expect(looksLikeImageUrl('https://gbu.ac.in/notice.pdf')).toBe(false);
  });
});

describe('hostOfUrl', () => {
  it('reads the host of a notice link', () => {
    expect(hostOfUrl('https://www.gbu.ac.in/Admissions/DownloadFile?nName=a.pdf')).toBe(
      'www.gbu.ac.in',
    );
  });

  it('drops the port', () => {
    expect(hostOfUrl('https://gbu.ac.in:8443/a.pdf')).toBe('gbu.ac.in');
  });

  it('returns an empty string for nonsense', () => {
    expect(hostOfUrl('not a url')).toBe('');
  });
});

describe('minimum document size', () => {
  it('is larger than a stub page but smaller than a circular', () => {
    expect(MIN_PDF_BYTES).toBeGreaterThan(512);
    expect(MIN_PDF_BYTES).toBeLessThan(38_000);
  });
});
