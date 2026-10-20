/**
 * GBU One — Attachment pipeline (worker).
 *
 * Per notice attachment this stage:
 *   1. downloads the file once (politely, with a size cap),
 *   2. hashes the bytes so the same file is never processed twice,
 *   3. extracts text - the PDF text layer when there is one, OCR for images
 *      and scanned PDFs,
 *   4. stores the raw text and the deadlines it revealed.
 *
 * The pure parts (URL resolution, type detection, budget, size guard) are
 * unit tested; the network and OCR calls are injected so tests stay offline.
 */
import { extractPdfImages, extractPdfText, normalisePdfText } from './pdfText';
import { cleanOcrText, extractDeadlinesFromText, hashContent, resolveOcrProvider, type OcrProvider } from './ocrService';

export type AttachmentKind = 'pdf' | 'image' | 'html' | 'unknown';

export interface ResolvedAttachment {
  url: string;
  kind: AttachmentKind;
  fileName: string;
}

export interface ExtractionOutcome {
  rawText: string;
  extractedDeadlines: string[];
  isScanned: boolean;
  provider: OcrProvider | 'pdf-text';
  contentHash: string;
  byteSize: number;
  fileName: string;
  kind: AttachmentKind;
}

/**
 * Only university hosts are ever fetched. The regex has to accept the
 * subdomains the university actually serves from (`www.gbu.ac.in`,
 * `test.gbu.ac.in`, `exams.gbu.ac.in`, `samay.mygbu.in`, `gbuexam.in`).
 */
const ALLOWED_HOST_RE = /(^|\.)(gbu\.ac\.in|mygbu\.in|gbuexam\.in)$/i;

/** Never download more than this in one go (guard against a runaway file). */
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/** Per-run budget so a single worker pass never hammers the university. */
export const DEFAULT_ATTACHMENT_BUDGET = 12;

export function isAllowedAttachmentHost(hostname: string): boolean {
  return ALLOWED_HOST_RE.test(hostname.toLowerCase());
}

/**
 * Turns a notice's stored link into an absolute, downloadable URL.
 * GBU notice links are often relative (`/Admissions/DownloadFile?nName=...`).
 */
export function resolveAttachmentUrl(
  fileUrl: string,
  baseUrl = 'https://www.gbu.ac.in',
): string | null {
  if (!fileUrl) return null;
  const trimmed = fileUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return null;

  let resolved: string;
  try {
    resolved = new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }

  if (!/^https?:$/.test(new URL(resolved).protocol)) return null;
  if (!isAllowedAttachmentHost(new URL(resolved).hostname)) return null;
  return resolved;
}

/** Detects the attachment kind from the URL and the response content type. */
export function detectAttachmentKind(
  url: string,
  contentType?: string | null,
): AttachmentKind {
  const type = (contentType || '').toLowerCase();
  if (type.includes('application/pdf')) return 'pdf';
  if (type.startsWith('image/')) return 'image';
  if (type.includes('text/html')) return 'html';

  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  })();

  if (path.endsWith('.pdf')) return 'pdf';
  if (/\.(jpe?g|png|gif|bmp|webp|tiff?)$/.test(path)) return 'image';
  if (/\.(html?|txt)$/.test(path)) return 'html';
  if (path.includes('downloadfile')) return 'pdf';
  return 'unknown';
}

/** Human-friendly file name for the stored artefact. */
export function attachmentFileName(url: string, sourceId: string): string {
  try {
    const parsed = new URL(url);
    const name = parsed.searchParams.get('nName') || parsed.pathname.split('/').pop() || '';
    if (name) {
      const safe = name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
      if (safe) return safe;
    }
  } catch {
    // fall through to the source id
  }
  return `${sourceId}.bin`;
}

/** True when the body is small enough to be a real document, not an error page. */
export function looksLikeBinaryDocument(bytes: Buffer, kind: AttachmentKind): boolean {
  if (kind === 'html' || kind === 'unknown') return false;
  if (bytes.length === 0) return false;
  if (kind === 'pdf') {
    return bytes.subarray(0, 1024).toString('latin1').includes('%PDF-');
  }
  return true;
}

export interface OcrRunner {
  (input: { bytes: Buffer; fileName: string; kind: AttachmentKind }): Promise<string>;
}

export interface Downloader {
  (url: string): Promise<{ bytes: Buffer; contentType: string | null }>;
}

export interface ExtractOptions {
  download: Downloader;
  ocr?: OcrRunner;
  budget?: number;
  provider?: OcrProvider;
  /**
   * Content hashes that were already processed in an earlier run. Their files
   * are still downloaded (the hash is only known afterwards) but the text is
   * not extracted again, and the download is not repeated either once the
   * notice already carries its text.
   */
  processedHashes?: Set<string>;
}

/**
 * Runs the pipeline over one notice attachment.
 * Returns null when the attachment cannot or should not be processed.
 */
export async function extractAttachment(
  fileUrl: string,
  sourceId: string,
  options: ExtractOptions,
): Promise<ExtractionOutcome | null> {
  const url = resolveAttachmentUrl(fileUrl);
  if (!url) return null;

  let downloaded: { bytes: Buffer; contentType: string | null };
  try {
    downloaded = await options.download(url);
  } catch {
    return null;
  }

  const bytes = downloaded.bytes;
  if (!bytes || bytes.length === 0) return null;
  if (bytes.length > MAX_ATTACHMENT_BYTES) return null;

  const kind = detectAttachmentKind(url, downloaded.contentType);
  if (!looksLikeBinaryDocument(bytes, kind)) return null;

  const contentHash = hashContent(bytes);
  const fileName = attachmentFileName(url, sourceId);

  // Already processed in an earlier run: the notice already has its text.
  if (options.processedHashes?.has(contentHash)) return null;

  if (kind === 'pdf') {
    const pdf = extractPdfText(bytes);
    if (!pdf.isScanned) {
      const text = normalisePdfText(pdf.text);
      return {
        rawText: text,
        extractedDeadlines: extractDeadlinesFromText(text),
        isScanned: false,
        provider: 'pdf-text',
        contentHash,
        byteSize: bytes.length,
        fileName,
        kind,
      };
    }
    // Scanned PDF: OCR the page images, because Tesseract reads images and
    // not PDF containers.
    if (!options.ocr) return null;
    const pages = extractPdfImages(bytes);
    if (pages.length === 0) return null;
    const texts: string[] = [];
    for (let index = 0; index < pages.length; index++) {
      try {
        const pageText = await options.ocr({
          bytes: pages[index],
          fileName: `${fileName.replace(/\.[^.]+$/, '')}-p${index + 1}.jpg`,
          kind: 'image',
        });
        if (pageText) texts.push(pageText);
      } catch {
        // A single unreadable page must not lose the others.
      }
    }
    const scannedText = cleanOcrText(texts.join('\n'));
    if (!scannedText) return null;
    return {
      rawText: scannedText,
      extractedDeadlines: extractDeadlinesFromText(scannedText),
      isScanned: true,
      provider: options.provider ?? resolveOcrProvider(),
      contentHash,
      byteSize: bytes.length,
      fileName,
      kind,
    };
  }

  if (!options.ocr) return null;

  let ocrText: string;
  try {
    ocrText = await options.ocr({ bytes, fileName, kind });
  } catch {
    return null;
  }

  const text = cleanOcrText(ocrText || '');
  if (!text) return null;

  return {
    rawText: text,
    extractedDeadlines: extractDeadlinesFromText(text),
    isScanned: true,
    provider: options.provider ?? resolveOcrProvider(),
    contentHash,
    byteSize: bytes.length,
    fileName,
    kind,
  };
}

/** Runs the pipeline over many attachments, respecting the per-run budget. */
export async function extractAttachments(
  items: Array<{ sourceId: string; fileUrl: string }>,
  options: ExtractOptions,
): Promise<Array<{ sourceId: string; outcome: ExtractionOutcome }>> {
  const budget = options.budget ?? DEFAULT_ATTACHMENT_BUDGET;
  const results: Array<{ sourceId: string; outcome: ExtractionOutcome }> = [];
  let processed = 0;

  for (const item of items) {
    if (processed >= budget) break;
    if (!item.fileUrl) continue;
    processed++;
    const outcome = await extractAttachment(item.fileUrl, item.sourceId, options);
    if (outcome) results.push({ sourceId: item.sourceId, outcome });
  }

  return results;
}
