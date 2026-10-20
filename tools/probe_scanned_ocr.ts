/**
 * Proves the scanned-document path: a real GBU scanned PDF is downloaded,
 * its page images are extracted, and the OCR runner receives them.
 *
 *   npx ts-node tools/probe_scanned_ocr.ts
 *
 * The OCR itself is stubbed, so this checks the wiring rather than the
 * recognition: the point is that a scanned PDF never silently produces empty
 * text - it either reaches the OCR runner or it fails loudly.
 */
import { extractAttachment } from '../worker/attachmentPipeline';
import { fetchWithTlsTolerance, parseMainNoticesHtml } from '../worker/noticesJob';

async function main() {
  const res = await fetchWithTlsTolerance('https://www.gbu.ac.in/page/notices', {
    headers: { 'User-Agent': 'GBUOne-Worker/1.0 (student project)' },
  });
  const notices = parseMainNoticesHtml(await res.text());
  const withFile = notices.filter((n) => n.url && /DownloadFile/i.test(n.url));

  let ocrCalls = 0;
  let ocrBytes = 0;

  for (const notice of withFile.slice(0, 6)) {
    const outcome = await extractAttachment(notice.url, 'probe', {
      download: async (url) => {
        const r = await fetchWithTlsTolerance(url, {
          headers: { 'User-Agent': 'GBUOne-Worker/1.0 (student project)' },
        });
        const bytes = Buffer.from(await r.arrayBuffer());
        return { bytes, contentType: r.headers.get('content-type') };
      },
      ocr: async (input) => {
        ocrCalls++;
        ocrBytes += input.bytes.length;
        // A real OCR would return text here; the stub proves the image
        // reached the runner.
        return 'OCR STUB';
      },
    });

    if (outcome) {
      console.log(
        `- ${outcome.kind} | provider ${outcome.provider} | scanned ${outcome.isScanned} | ` +
          `text "${outcome.rawText.slice(0, 40)}"`,
      );
    }
  }

  console.log(`\nOCR runner called ${ocrCalls} time(s), ${ocrBytes} bytes of page images`);
  if (ocrCalls === 0) {
    console.log('WARNING: no scanned document reached the OCR runner');
  }
}

void main();
