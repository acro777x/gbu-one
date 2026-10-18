/**
 * GBU One — Worker Attachment & OCR Processing Service
 * Per docs/DATA_SOURCES.md & docs/ARCHITECTURE.md
 */

export interface OcrResult {
  fileUrl: string;
  rawText: string;
  confidence: number;
  extractedDeadlines: string[];
  isScanned: boolean;
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

/**
 * Simulates / runs attachment OCR extraction
 */
export async function processAttachmentOcr(
  fileUrl: string,
  mockTextFallback?: string,
): Promise<OcrResult> {
  const isImage = /\.(jpe?g|png)$/i.test(fileUrl);
  const isPdf = /\.pdf$/i.test(fileUrl);

  const text = mockTextFallback || (isPdf ? 'GBU Examination Notice Text' : 'GBU Scanned Circular Text');
  const cleaned = cleanOcrText(text);
  const deadlines = extractDeadlinesFromText(cleaned);

  return {
    fileUrl,
    rawText: cleaned,
    confidence: isPdf ? 0.95 : 0.85,
    extractedDeadlines: deadlines,
    isScanned: isImage,
  };
}
