/**
 * GBU One — Pure helpers for the notice document viewer.
 *
 * WHY THIS FILE EXISTS
 * The university download endpoint is unreliable in two specific, repeatable
 * ways, and the app has to survive both:
 *
 *   1. `www.gbu.ac.in/Admissions/DownloadFile` answers HTTP 500 with a PDF
 *      that actually renders an "Error / An error occurred while processing
 *      your request" page.
 *   2. The same endpoint sometimes answers HTTP 200 with a ~38 KB HTML body
 *      that says "404 - Page not found" (a soft 404), so a naive client
 *      believes it downloaded a document and then fails to parse it.
 *
 * Because of that, a download is never trusted: the HTTP status, the leading
 * bytes and the file size are all checked before the file is handed to the PDF
 * renderer. The checks live here, away from React, so they can be unit tested
 * under plain Node without a device, a network or a native module.
 */

/** Every PDF file starts with this magic string. */
const PDF_MAGIC = '%PDF';

/**
 * How many leading bytes are inspected to recognise a body. The two GBU
 * error pages both declare their type inside the first kilobyte.
 */
const HEAD_WINDOW = 2048;

/**
 * A real GBU circular is tens of kilobytes at least. Anything smaller is a
 * stub page rather than a document.
 */
export const MIN_PDF_BYTES = 1024;

/** MIME type handed to the OS when the file is passed to another app. */
export const PDF_MIME_TYPE = 'application/pdf';

/**
 * An absolute URL with an explicit scheme and a non-empty authority.
 * Matched by hand instead of with `URL` so the check behaves identically on
 * Hermes, on JSC and in Node.
 */
const ABSOLUTE_URL = /^([a-z][a-z0-9+.-]*):\/\/([^/?#\s]+)/i;

/**
 * Whitespace and control characters are never part of a usable document URL.
 * They are checked by code point so that a link cannot smuggle a second
 * scheme past the prefix check.
 */
const hasUnsafeCharacter = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    // Space, tab, the C0 controls and DEL.
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
};

/**
 * True when the bytes look like the start of a PDF document.
 *
 * The magic is searched inside the first {@link HEAD_WINDOW} bytes rather than
 * only at offset 0, because a few generators prepend a stray byte or a BOM.
 */
export function isProbablyPdf(bytes: string): boolean {
  if (!bytes) return false;
  return bytes.slice(0, HEAD_WINDOW).indexOf(PDF_MAGIC) !== -1;
}

/**
 * True for the GBU "404 - Page not found" body, which is served with HTTP
 * 200 and therefore looks like a successful download to the HTTP layer.
 */
export function looksLikeSoft404(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return lower.indexOf('404') !== -1 && lower.indexOf('page not found') !== -1;
}

/**
 * True for the GBU error page, which the download endpoint returns with HTTP
 * 500 and which reads "Error / An error occurred while processing your
 * request".
 */
export function isPdfErrorPage(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  if (lower.indexOf('an error occurred while processing your request') !== -1) {
    return true;
  }
  return lower.indexOf('error') !== -1 && lower.indexOf('processing your request') !== -1;
}

/**
 * Turns a failed download into one sentence a student can act on.
 *
 * The body is inspected before the status code on purpose: a 500 that carries
 * the error page and a 404 that carries a page-not-found body both need a
 * different explanation from a plain "the server refused the download".
 */
export function describeDownloadProblem(
  status: number,
  head: string,
  byteLength: number,
): string {
  if (looksLikeSoft404(head)) {
    return 'The university portal answered with its "404 - Page not found" page instead of the document. The file was probably renamed or withdrawn.';
  }
  if (isPdfErrorPage(head)) {
    return 'The university portal answered with an error page instead of the document — its download service failed for this file. Opening it in another app may still work.';
  }
  if (status >= 400) {
    return `The university server refused the download (HTTP ${status}). Opening the original link may still work.`;
  }
  if (status < 200 || status >= 300) {
    return `The university server answered with an unexpected status (HTTP ${status}).`;
  }
  if (!isProbablyPdf(head)) {
    return 'The downloaded file is not a PDF — the portal returned a web page instead of the document.';
  }
  if (byteLength < MIN_PDF_BYTES) {
    return `The downloaded file is only ${byteLength} bytes, which is too small to be a real document.`;
  }
  return 'The document could not be opened. Please try again.';
}

/**
 * True only for `http` and `https` URLs.
 *
 * The viewer downloads whatever it is given, so anything else — a `file://`
 * path, a `javascript:` payload, a `content://` handle — is refused before a
 * single byte is fetched.
 */
export function isSafePdfUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed || hasUnsafeCharacter(trimmed)) return false;
  const match = ABSOLUTE_URL.exec(trimmed);
  if (!match) return false;
  const scheme = match[1].toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') return false;
  return match[2].length > 0;
}

/**
 * A stable file name for a document, derived from its URL.
 *
 * The name has to be stable so that a retry overwrites the previous attempt
 * instead of filling the cache with copies, and unique so that two notices
 * never share one file. A discriminator can be added for the rare case of two
 * runs of the same URL overlapping, so that the older run cannot delete the
 * file the newer one is writing.
 */
export function buildCacheFileName(url: string, discriminator?: string | number): string {
  let hash = 5381;
  for (let index = 0; index < url.length; index += 1) {
    hash = ((hash << 5) + hash + url.charCodeAt(index)) >>> 0;
  }
  const suffix = discriminator === undefined ? '' : `-${discriminator}`;
  const ext = looksLikeImageUrl(url) ? (url.toLowerCase().indexOf('.png') !== -1 ? '.png' : '.jpg') : '.pdf';
  return `gbu-document-${hash.toString(16)}${suffix}${ext}`;
}

/**
 * The host of an absolute URL, or an empty string when it cannot be read.
 *
 * React Native ships a partial `URL` implementation whose `host` getter
 * throws, so the host is parsed by hand instead.
 */
export function hostOfUrl(url: string): string {
  if (!url) return '';
  const match = ABSOLUTE_URL.exec(url.trim());
  if (!match) return '';
  const authority = match[2];
  // Drop any user info, then the port.
  const at = authority.lastIndexOf('@');
  const hostAndPort = at === -1 ? authority : authority.slice(at + 1);
  const colon = hostAndPort.indexOf(':');
  return colon === -1 ? hostAndPort : hostAndPort.slice(0, colon);
}

/**
 * True when the URL points at something that is meant to be a PDF.
 *
 * The main GBU portal hides the real file name inside the query string
 * (`/Admissions/DownloadFile?nName=21370280_a0c8e722.pdf…`), so the whole URL
 * is searched and not only its path.
 */
export function looksLikePdfUrl(url: string): boolean {
  if (!url) return false;
  return url.toLowerCase().indexOf('.pdf') !== -1;
}

/** True when the URL points at a raster image rather than a document. */
export function looksLikeImageUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.indexOf('.jpg') !== -1 ||
    lower.indexOf('.jpeg') !== -1 ||
    lower.indexOf('.png') !== -1 ||
    lower.indexOf('.webp') !== -1
  );
}

/** True when the bytes look like a common raster image format (JPEG, PNG, WebP, GIF). */
export function isProbablyImage(bytes: string): boolean {
  if (!bytes || bytes.length < 4) return false;
  // JPEG: FF D8 FF
  if (bytes.charCodeAt(0) === 0xff && bytes.charCodeAt(1) === 0xd8) return true;
  // PNG: \x89PNG
  if (bytes.charCodeAt(0) === 0x89 && bytes.slice(1, 4) === 'PNG') return true;
  if (bytes.slice(0, 4) === '\x89PNG') return true;
  // GIF: GIF8
  if (bytes.slice(0, 4) === 'GIF8') return true;
  // WEBP: RIFF...WEBP
  if (bytes.slice(0, 4) === 'RIFF' && bytes.indexOf('WEBP') !== -1) return true;
  return false;
}

