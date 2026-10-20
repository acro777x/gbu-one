/**
 * Unit tests for the worker attachment pipeline (download -> extract -> store).
 * Per docs/ROADMAP.md line 36 and docs/NOTIFICATIONS.md.
 */
import {
  attachmentFileName,
  detectAttachmentKind,
  extractAttachment,
  extractAttachments,
  isAllowedAttachmentHost,
  looksLikeBinaryDocument,
  resolveAttachmentUrl,
  MAX_ATTACHMENT_BYTES,
} from '../worker/attachmentPipeline';
import { extractPdfImages, extractPdfText, extractTextFromContentStream, normalisePdfText, parseToUnicode } from '../worker/pdfText';
import { isTesseractAvailable, runVision } from '../worker/ocrRunner';
import { parseDeadlineToIso } from '../worker/supabaseClient';

function pdfWithText(text: string): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  return Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\ntrailer\n%%EOF\n`,
    'latin1',
  );
}

/** A scanned-style PDF: one page holding a single embedded JPEG. */
function scannedPdfWithImage(): Buffer {
  const jpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
  const dict = '<< /Type /XObject /Subtype /Image /Width 800 /Height 600 /Filter /DCTDecode /Length '
    + jpeg.length + ' >>';
  const header = Buffer.from(
    `%PDF-1.4\n1 0 obj\n${dict}\nstream\n`,
    'latin1',
  );
  const footer = Buffer.from('\nendstream\nendobj\ntrailer\n%%EOF\n', 'latin1');
  return Buffer.concat([header, jpeg, footer]);
}

describe('attachment URL resolution', () => {
  it('resolves relative GBU notice links', () => {
    expect(resolveAttachmentUrl('/Admissions/DownloadFile?nName=exam.pdf')).toBe(
      'https://www.gbu.ac.in/Admissions/DownloadFile?nName=exam.pdf',
    );
  });

  it('keeps absolute GBU links', () => {
    expect(resolveAttachmentUrl('https://exams.gbu.ac.in/uploads/a.pdf')).toBe(
      'https://exams.gbu.ac.in/uploads/a.pdf',
    );
  });

  it('refuses hosts outside the university', () => {
    expect(resolveAttachmentUrl('https://evil.example.com/a.pdf')).toBeNull();
    expect(isAllowedAttachmentHost('evil.example.com')).toBe(false);
    expect(isAllowedAttachmentHost('www.gbu.ac.in')).toBe(true);
    expect(isAllowedAttachmentHost('samay.mygbu.in')).toBe(true);
  });

  it('refuses empty and non-http links', () => {
    expect(resolveAttachmentUrl('')).toBeNull();
    expect(resolveAttachmentUrl('   ')).toBeNull();
    expect(resolveAttachmentUrl('data:application/pdf;base64,AAAA')).toBeNull();
    expect(resolveAttachmentUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('attachment kind detection', () => {
  it('uses the content type when present', () => {
    expect(detectAttachmentKind('https://x.gbu.ac.in/a', 'application/pdf')).toBe('pdf');
    expect(detectAttachmentKind('https://x.gbu.ac.in/a', 'image/png')).toBe('image');
    expect(detectAttachmentKind('https://x.gbu.ac.in/a', 'text/html; charset=utf-8')).toBe('html');
  });

  it('falls back to the URL extension', () => {
    expect(detectAttachmentKind('https://x.gbu.ac.in/a.pdf')).toBe('pdf');
    expect(detectAttachmentKind('https://x.gbu.ac.in/a.JPG')).toBe('image');
    expect(detectAttachmentKind('https://x.gbu.ac.in/Admissions/DownloadFile?nName=x')).toBe('pdf');
    expect(detectAttachmentKind('https://x.gbu.ac.in/a')).toBe('unknown');
  });
});

describe('attachment file names', () => {
  it('uses the GBU nName parameter when present', () => {
    expect(
      attachmentFileName('https://www.gbu.ac.in/Admissions/DownloadFile?nName=Semester%20Fees.pdf', 'src_1'),
    ).toBe('Semester_Fees.pdf');
  });

  it('falls back to the source id', () => {
    expect(attachmentFileName('https://www.gbu.ac.in/', 'src_abc')).toBe('src_abc.bin');
  });
});

describe('document sanity checks', () => {
  it('accepts a real PDF and rejects an HTML error page', () => {
    expect(looksLikeBinaryDocument(Buffer.from('%PDF-1.7 ...'), 'pdf')).toBe(true);
    expect(looksLikeBinaryDocument(Buffer.from('<html>404</html>'), 'pdf')).toBe(false);
    expect(looksLikeBinaryDocument(Buffer.alloc(0), 'pdf')).toBe(false);
  });
});

describe('PDF text-layer extraction', () => {
  it('pulls text out of a simple content stream', () => {
    expect(extractTextFromContentStream('BT (Hello GBU) Tj ET').join('')).toContain('Hello GBU');
  });

  it('decodes escaped characters in literal strings', () => {
    expect(extractTextFromContentStream('BT (Fee \\(s\\) due) Tj ET').join('')).toContain('Fee (s) due');
  });

  it('decodes hex strings', () => {
    expect(extractTextFromContentStream('BT <48656C6C6F> Tj ET').join('')).toContain('Hello');
  });

  it('extracts a text layer from a real PDF buffer', () => {
    const result = extractPdfText(pdfWithText('Revised Examination Notice'));
    expect(result.isScanned).toBe(false);
    expect(result.text).toContain('Revised Examination Notice');
  });

  it('reports a PDF with no text layer as scanned', () => {
    const scanned = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Subtype /Image >>\nendobj\ntrailer\n%%EOF\n',
      'latin1',
    );
    const result = extractPdfText(scanned);
    expect(result.isScanned).toBe(true);
    expect(result.text).toBe('');
  });

  it('normalises whitespace', () => {
    expect(normalisePdfText('a   b\n\n\n\nc  ')).toBe('a b\n\nc');
  });
});

describe('ToUnicode CMap parsing', () => {
  it('reads bfchar entries', () => {
    const cmap = parseToUnicode(
      'beginbfchar\n<0003> <0020>\n<0004> <0041>\nendbfchar',
    );
    expect(cmap.get(0x03)).toBe(' ');
    expect(cmap.get(0x04)).toBe('A');
  });

  it('reads bfrange entries', () => {
    const cmap = parseToUnicode(
      'beginbfrange\n<0010> <0012> <0041>\nendbfrange',
    );
    expect(cmap.get(0x10)).toBe('A');
    expect(cmap.get(0x11)).toBe('B');
    expect(cmap.get(0x12)).toBe('C');
  });

  it('decodes hex strings through the map', () => {
    const cmap = parseToUnicode('beginbfchar\n<0003> <0020>\n<0061> <0061>\nendbfchar');
    const pieces = extractTextFromContentStream('BT /F1 12 Tf <0361> Tj ET', new Map([['F1', cmap]]));
    expect(pieces.join('')).toContain(' a');
  });

  it('selects the font map with the Tf operator', () => {
    const cmap = parseToUnicode('beginbfchar\n<0003> <0020>\nendbfchar');
    const pieces = extractTextFromContentStream('BT /F1 12 Tf <03> Tj ET', new Map([['F1', cmap]]));
    expect(pieces.join('')).toContain(' ');
  });

  it('keeps the kerning threshold conservative', () => {
    // A -2 kern is letter spacing; a -400 kern is a missing space.
    const tight = extractTextFromContentStream('BT [(A)-2(B)] TJ ET').join('');
    const loose = extractTextFromContentStream('BT [(A)-400(B)] TJ ET').join('');
    expect(tight).toBe('AB\n');
    expect(loose).toBe('A B\n');
  });
});

describe('attachment extraction pipeline', () => {
  const download = async () => ({
    bytes: pdfWithText('Fee Submission Deadline Extended'),
    contentType: 'application/pdf',
  });

  it('extracts the text layer of a PDF without calling OCR', async () => {
    let ocrCalled = false;
    const outcome = await extractAttachment(
      'https://www.gbu.ac.in/Admissions/DownloadFile?nName=fees.pdf',
      'src_1',
      {
        download,
        ocr: async () => {
          ocrCalled = true;
          return 'ocr text';
        },
      },
    );
    expect(outcome).not.toBeNull();
    expect(outcome?.provider).toBe('pdf-text');
    expect(outcome?.rawText).toContain('Fee Submission Deadline Extended');
    expect(outcome?.isScanned).toBe(false);
    expect(ocrCalled).toBe(false);
  });

  it('falls back to OCR for a scanned PDF', async () => {
    const scanned = scannedPdfWithImage();
    const outcome = await extractAttachment(
      'https://www.gbu.ac.in/a.pdf',
      'src_2',
      {
        download: async () => ({ bytes: scanned, contentType: 'application/pdf' }),
        ocr: async () => 'Scanned circular text about the deadline',
      },
    );
    expect(outcome?.isScanned).toBe(true);
    expect(outcome?.provider).toBe('tesseract');
    expect(outcome?.rawText).toContain('Scanned circular text');
  });

  it('extracts the page images of a scanned PDF for OCR', () => {
    const images = extractPdfImages(scannedPdfWithImage());
    expect(images).toHaveLength(1);
    // JPEG start-of-image marker.
    expect(images[0].subarray(0, 2).toString('hex')).toBe('ffd8');
  });

  it('extracts deadlines from the text', async () => {
    const outcome = await extractAttachment(
      'https://www.gbu.ac.in/a.pdf',
      'src_3',
      {
        download: async () => ({
          bytes: pdfWithText('Last Date: 31 Oct 2026 for fee submission'),
          contentType: 'application/pdf',
        }),
      },
    );
    expect(outcome?.extractedDeadlines.length).toBeGreaterThan(0);
  });

  it('skips a link that is not a document', async () => {
    const outcome = await extractAttachment(
      'https://www.gbu.ac.in/a.html',
      'src_4',
      {
        download: async () => ({ bytes: Buffer.from('<html>hi</html>'), contentType: 'text/html' }),
      },
    );
    expect(outcome).toBeNull();
  });

  it('skips a file that is too large', async () => {
    const outcome = await extractAttachment(
      'https://www.gbu.ac.in/a.pdf',
      'src_5',
      {
        download: async () => ({
          bytes: Buffer.alloc(MAX_ATTACHMENT_BYTES + 1, 0x41),
          contentType: 'application/pdf',
        }),
      },
    );
    expect(outcome).toBeNull();
  });

  it('returns null when the download fails', async () => {
    const outcome = await extractAttachment(
      'https://www.gbu.ac.in/a.pdf',
      'src_6',
      {
        download: async () => {
          throw new Error('offline');
        },
      },
    );
    expect(outcome).toBeNull();
  });

  it('respects the per-run budget', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      sourceId: `src_${i}`,
      fileUrl: 'https://www.gbu.ac.in/a.pdf',
    }));
    const results = await extractAttachments(items, { download, budget: 3 });
    expect(results).toHaveLength(3);
  });

  it('hashes content so the same file is identifiable', async () => {
    const first = await extractAttachment('https://www.gbu.ac.in/a.pdf', 'src_7', { download });
    const second = await extractAttachment('https://www.gbu.ac.in/b.pdf', 'src_8', { download });
    expect(first?.contentHash).toBe(second?.contentHash);
  });

  it('skips a file whose hash was already processed', async () => {
    const first = await extractAttachment('https://www.gbu.ac.in/a.pdf', 'src_9', { download });
    const processed = new Set([first?.contentHash ?? '']);
    const second = await extractAttachment('https://www.gbu.ac.in/a.pdf', 'src_10', {
      download,
      processedHashes: processed,
    });
    expect(second).toBeNull();
  });
});

describe('deadline parsing from extracted text', () => {
  it('parses a named month', () => {
    expect(parseDeadlineToIso('31 Oct 2026')).toBe('2026-10-31T23:59:00.000Z');
    expect(parseDeadlineToIso('3 November 2026')).toBe('2026-11-03T23:59:00.000Z');
  });

  it('parses a numeric date', () => {
    expect(parseDeadlineToIso('31-10-2026')).toBe('2026-10-31T23:59:00.000Z');
    expect(parseDeadlineToIso('31/10/2026')).toBe('2026-10-31T23:59:00.000Z');
  });

  it('rejects an unparseable value', () => {
    expect(parseDeadlineToIso('soon')).toBeNull();
    expect(parseDeadlineToIso('')).toBeNull();
    expect(parseDeadlineToIso('31 Smarch 2026')).toBeNull();
  });
});

describe('OCR runner guards', () => {
  it('reports the vision provider without a key', async () => {
    const result = await runVision(
      { bytes: Buffer.from('x'), fileName: 'a.png', kind: 'image' },
      { apiKey: '' },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-api-key');
  });

  it('exposes a tesseract availability probe', () => {
    expect(typeof isTesseractAvailable()).toBe('boolean');
  });
});
