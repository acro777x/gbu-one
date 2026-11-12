/**
 * GBU One — Worker OCR service.
 * Decision (OPEN_QUESTIONS #4, owner default 2026-10-20): Tesseract is the
 * default provider (free, offline, no key). A vision-model key is an
 * optional upgrade via OCR_PROVIDER=vision + VISION_API_KEY.
 * Attachments are downloaded once and cached by content hash; the same file
 * is never re-OCR'd. Pure-logic helpers are unit-tested.
 */
import crypto from 'crypto';

export type OcrProvider = 'tesseract' | 'vision';

export function resolveOcrProvider(
  env: Record<string, string | undefined> = process.env
): OcrProvider {
  return env.OCR_PROVIDER === 'vision' && env.VISION_API_KEY ? 'vision' : 'tesseract';
}

export function hashContent(buf: Buffer | string): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

const seenHashes = new Set<string>();

export function isAlreadyProcessed(contentHash: string): boolean {
  return seenHashes.has(contentHash);
}

export function markProcessed(contentHash: string): void {
  seenHashes.add(contentHash);
}

/**
 * Normalises extracted raw text, removing artifacts and extra line breaks
 */
export function cleanOcrText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

/**
 * Extracts key dates and deadlines from raw OCR text
 */
export function extractDeadlinesFromText(rawText: string): string[] {
  const matches: string[] = [];
  const regex = /(?:last\s+date|deadline|extended\s+to|till|before|submission\s+date)[\s:]*([0-3]?[0-9](?:st|nd|rd|th)?[\s/.-]+(?:[A-Za-z]+|[0-1]?[0-9])(?:[\s/.-]+[2-9][0-9]{3})?)/gi;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(rawText)) !== null) {
    if (m[1]) {
      matches.push(m[1].trim());
    }
  }

  return matches;
}
