/**
 * Live check of the worker pipeline against the real GBU sites.
 *
 *   npx ts-node tools/probe_worker_pipeline.ts
 *
 * Downloads a few live notice attachments, extracts their text and shows
 * the deadlines it revealed. Nothing is written to a database.
 */
import { extractAttachment } from '../worker/attachmentPipeline';
import { fetchWithTlsTolerance, parseMainNoticesHtml } from '../worker/noticesJob';

const SAMPLE_COUNT = 6;

async function main() {
  const listUrl = 'https://www.gbu.ac.in/page/notices';
  const res = await fetchWithTlsTolerance(listUrl, {
    headers: { 'User-Agent': 'GBUOne-Worker/1.0 (student project)' },
  });
  console.log('list status', res.status);
  const html = await res.text();
  const notices = parseMainNoticesHtml(html);
  console.log('notices parsed', notices.length);

  const withFile = notices
    .filter((n) => n.url && /DownloadFile/i.test(n.url))
    .slice(0, SAMPLE_COUNT);

  let extracted = 0;
  for (const notice of withFile) {
    const outcome = await extractAttachment(notice.url, 'probe', {
      download: async (url) => {
        const r = await fetchWithTlsTolerance(url, {
          headers: { 'User-Agent': 'GBUOne-Worker/1.0 (student project)' },
        });
        const bytes = Buffer.from(await r.arrayBuffer());
        return { bytes, contentType: r.headers.get('content-type') };
      },
      // A scanned PDF needs OCR. The probe has no OCR provider, so those
      // files report "no text layer" and are skipped.
      ocr: async () => '',
    });

    if (!outcome) {
      console.log('- scanned or unsupported, no text layer without OCR');
      continue;
    }
    extracted++;
    console.log(
      `- ${outcome.kind} | ${outcome.provider} | ${outcome.byteSize} bytes | ` +
        `deadlines: ${JSON.stringify(outcome.extractedDeadlines)}`,
    );
    console.log(`  ${outcome.rawText.slice(0, 160).replace(/\n/g, ' / ')}`);
  }

  console.log(`\nextracted ${extracted} of ${withFile.length} sampled attachments`);
}

void main();
