/**
 * GBU One — PDF text-layer extractor (worker side, no dependencies).
 *
 * Most GBU notices are text PDFs, so the text layer can be read directly and
 * no OCR is needed. A PDF with no usable text layer is a *scanned* document
 * and must go through the OCR provider instead.
 *
 * The extractor reads:
 * - the document's object table (so `/ToUnicode` CMaps can be found),
 * - each page's font resources, so subset fonts with a custom encoding are
 *   decoded through their real Unicode mapping instead of raw glyph codes,
 * - the text-showing operators (`Tj`, `TJ`, `'`, `"`) of every content stream.
 *
 * It is not a full PDF renderer: it never executes embedded JavaScript, never
 * follows external references and never writes to disk.
 */
import zlib from 'zlib';

export interface PdfTextResult {
  /** Text pulled out of the PDF's text layer (may be empty). */
  text: string;
  /** Number of content streams that were decoded. */
  decodedStreams: number;
  /** True when the PDF carries images instead of selectable text. */
  isScanned: boolean;
}

/**
 * Kerning value (in thousandths of the text space) at or below which two
 * glyphs count as separate words. Inter-letter kerning in real documents sits
 * around -2..-30, while a missing space glyph shows up around -250..-400.
 */
export const WORD_SPACE_KERN = -180;

const STREAM_RE = /stream\r?\n?([\s\S]*?)\r?\n?endstream/g;

/** A parsed indirect object. */
export interface PdfObject {
  number: number;
  /** The object's dictionary text (`<< ... >>`). */
  dict: string;
  /** Decoded stream bytes, when the object has a stream. */
  data: Buffer | null;
}

function inflate(buffer: Buffer): Buffer | null {
  const attempts: Array<() => Buffer> = [
    () => zlib.inflateSync(buffer),
    () => zlib.inflateRawSync(buffer),
    () => zlib.unzipSync(buffer),
  ];
  for (const attempt of attempts) {
    try {
      return attempt();
    } catch {
      // try the next decoding strategy
    }
  }
  return null;
}

/** Reads the dictionary that precedes a stream so we can spot /FlateDecode. */
function precedingDictionary(source: string, streamStart: number): string {
  const windowStart = Math.max(0, streamStart - 800);
  const window = source.slice(windowStart, streamStart);
  const dictStart = window.lastIndexOf('<<');
  if (dictStart === -1) return '';
  const dictEnd = window.indexOf('>>', dictStart);
  if (dictEnd === -1) return window.slice(dictStart);
  return window.slice(dictStart, dictEnd + 2);
}

/** Splits the document into its indirect objects. */
export function parseObjects(source: string): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>();
  const headerRe = /(\d+)\s+(\d+)\s+obj\b/g;
  let header: RegExpExecArray | null;

  while ((header = headerRe.exec(source)) !== null) {
    const number = Number(header[1]);
    const bodyStart = header.index + header[0].length;

    // The object body runs to the next "endobj" that is not inside a stream.
    const streamIdx = source.indexOf('stream', bodyStart);
    const endObjIdx = source.indexOf('endobj', bodyStart);
    const hasStream =
      streamIdx !== -1 &&
      (endObjIdx === -1 || streamIdx < endObjIdx) &&
      /^[^\n]*\r?\n/.test(source.slice(bodyStart, streamIdx + 6));

    let bodyEnd: number;
    let data: Buffer | null = null;

    if (hasStream) {
      const dict = source.slice(bodyStart, streamIdx);
      const streamMatch = /stream\r?\n?/.exec(source.slice(streamIdx));
      const dataStart = streamIdx + (streamMatch ? streamMatch[0].length : 6);
      const endStreamIdx = source.indexOf('endstream', dataStart);
      if (endStreamIdx === -1) {
        bodyEnd = source.length;
      } else {
        bodyEnd = endStreamIdx;
        const raw = Buffer.from(source.slice(dataStart, endStreamIdx), 'latin1');
        const isFlate = /\/FlateDecode/.test(dict);
        const isImage = /\/Subtype\s*\/Image/.test(dict);
        if (isFlate) {
          data = inflate(raw);
        } else if (!isImage) {
          data = raw;
        }
      }
    } else {
      bodyEnd = endObjIdx === -1 ? source.length : endObjIdx;
    }

    const body = source.slice(bodyStart, bodyEnd);
    const dictStart = body.indexOf('<<');
    const dict = dictStart === -1 ? '' : body.slice(dictStart);

    objects.set(number, { number, dict, data });
    headerRe.lastIndex = bodyEnd;
  }

  // PDF 1.5 and later put most of the non-stream objects into COMPRESSED
  // OBJECT STREAMS (`/Type /ObjStm`). The School of ICT's date sheet is one:
  // every font dictionary of that PDF lives inside one, so a parser that
  // only reads plain `N 0 obj` bodies never sees a single font - and the
  // sheet extracts as 58 046 characters of noise.
  for (const obj of [...objects.values()]) {
    if (!obj.data) continue;
    if (!/\/Type\s*\/ObjStm/.test(obj.dict)) continue;
    // The object's data has ALREADY been inflated by the parser above, so it
    // must not be inflated again.
    parseObjectStream(obj.data, objects);
  }

  return objects;
}

/**
 * Reads the objects packed inside one compressed object stream.
 *
 * The stream starts with `N` pairs of "object number" and "offset", and the
 * objects themselves follow.
 *
 * The pair table is USUALLY two binary 32-bit integers, but some producers
 * (the PDF that iLovePDF produced the School of ICT's date sheet with, for
 * one) write the SAME table as plain text: "9 0 13 69 12 341 ...". Both
 * forms are accepted, because the text form is otherwise indistinguishable
 * from a corrupted stream - and a PDF the university actually publishes is
 * not something to refuse to read.
 */
function parseObjectStream(
  data: Buffer,
  objects: Map<number, PdfObject>,
): void {
  if (data.length < 8) return;

  const text = data.toString('latin1');
  const headers: Array<{ number: number; offset: number }> = [];

  const looksLikeTextTable = /^\s*\d+\s+\d+(\s+\d+\s+\d+)*\s/.test(text.slice(0, 200));
  if (looksLikeTextTable) {
    const numbers = (text.slice(0, 4096).match(/\d+/g) ?? []).map(Number);
    for (let i = 0; i + 1 < numbers.length; i += 2) {
      headers.push({ number: numbers[i], offset: numbers[i + 1] });
    }
    // The object data starts after the pair table.
    const tableEnd = text.slice(0, 4096).search(/[^\d\s]/);
    parsePackedObjects(text, tableEnd < 0 ? 0 : tableEnd, headers, objects);
    return;
  }

  const count = data.readUInt32BE(0);
  const first = data.readUInt32BE(4);
  if (first > data.length) return;

  for (let i = 0; i < count; i += 1) {
    const at = 8 + i * 8;
    if (at + 8 > data.length) break;
    headers.push({ number: data.readUInt32BE(at), offset: data.readUInt32BE(at + 4) });
  }

  parsePackedObjects(text, first, headers, objects);
}

/** Adds the objects described by a pair table to the object map. */
function parsePackedObjects(
  text: string,
  dataStart: number,
  headers: Array<{ number: number; offset: number }>,
  objects: Map<number, PdfObject>,
): void {
  for (let i = 0; i < headers.length; i += 1) {
    const entry = headers[i];
    const start = dataStart + entry.offset;
    if (start < 0 || start >= text.length) continue;
    const next = i + 1 < headers.length ? dataStart + headers[i + 1].offset : text.length;
    const body = text.slice(start, next);
    const dictStart = body.indexOf('<<');
    const dict = dictStart === -1 ? body : body.slice(dictStart);
    if (!objects.has(entry.number)) {
      objects.set(entry.number, { number: entry.number, dict, data: null });
    }
  }
}

/** Reads `N 0 R` references out of a dictionary. */
export function readReferences(dict: string, key: string): number[] {
  const re = new RegExp(`/${key}\\s*\\[([^\\]]*)\\]`, 's');
  const arrayMatch = re.exec(dict);
  if (arrayMatch) {
    return [...arrayMatch[1].matchAll(/(\d+)\s+\d+\s+R/g)].map((m) => Number(m[1]));
  }
  const single = new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`).exec(dict);
  if (single) return [Number(single[1])];
  return [];
}

/** Resolves a value that may be inline (`<< ... >>`) or an indirect reference. */
export function resolveDict(
  dict: string,
  key: string,
  objects: Map<number, PdfObject>,
): string {
  const inline = new RegExp(`/${key}\\s*(<<)`).exec(dict);
  if (inline) {
    const start = inline.index + inline[0].length - 2;
    const end = findDictEnd(dict, start);
    return end === -1 ? '' : dict.slice(start, end + 2);
  }
  const ref = new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`).exec(dict);
  if (ref) {
    const obj = objects.get(Number(ref[1]));
    return obj ? obj.dict : '';
  }
  return '';
}

/** Finds the `>>` that closes the `<<` at `start`. */
function findDictEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '<' && text[i + 1] === '<') {
      depth++;
      i++;
      continue;
    }
    if (text[i] === '>' && text[i + 1] === '>') {
      depth--;
      if (depth === 0) return i;
      i++;
    }
  }
  return -1;
}

/** A code -> Unicode mapping. */
export type CMap = Map<number, string>;

/**
 * Parses a `/ToUnicode` CMap.
 * Supports `beginbfchar` and `beginbfrange`, which cover virtually every
 * real-world PDF.
 */
export function parseToUnicode(cmapText: string): CMap {
  const map: CMap = new Map();

  const hexToInt = (hex: string): number => {
    const clean = hex.replace(/[^0-9a-fA-F]/g, '');
    if (!clean) return -1;
    if (clean.length <= 4) return parseInt(clean, 16);
    // Two-byte code: use the low 16 bits.
    return parseInt(clean.slice(-4), 16);
  };

  const hexToString = (hex: string): string => {
    const clean = hex.replace(/[^0-9a-fA-F]/g, '');
    let out = '';
    for (let i = 0; i + 3 < clean.length + 1; i += 4) {
      const code = parseInt(clean.slice(i, i + 4), 16);
      if (Number.isNaN(code)) break;
      out += String.fromCharCode(code);
    }
    return out;
  };

  const charRe = /beginbfchar([\s\S]*?)endbfchar/g;
  let block: RegExpExecArray | null;
  while ((block = charRe.exec(cmapText)) !== null) {
    const entryRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g;
    let entry: RegExpExecArray | null;
    while ((entry = entryRe.exec(block[1])) !== null) {
      const code = hexToInt(entry[1]);
      if (code >= 0) map.set(code, hexToString(entry[2]));
    }
  }

  const rangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((block = rangeRe.exec(cmapText)) !== null) {
    const entryRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]*)>|\[([\s\S]*?)\])/g;
    let entry: RegExpExecArray | null;
    while ((entry = entryRe.exec(block[1])) !== null) {
      const low = hexToInt(entry[1]);
      const high = hexToInt(entry[2]);
      if (low < 0 || high < 0 || high < low) continue;
      if (entry[3] !== undefined) {
        const start = entry[3] ? parseInt(entry[3].replace(/[^0-9a-fA-F]/g, '').slice(-4) || '0', 16) : 0;
        for (let code = low; code <= high && code - low < 65536; code++) {
          map.set(code, String.fromCharCode(start + (code - low)));
        }
      } else if (entry[4] !== undefined) {
        const items = [...entry[4].matchAll(/<([0-9a-fA-F]*)>/g)];
        items.forEach((item, index) => {
          map.set(low + index, hexToString(item[1]));
        });
      }
    }
  }

  return map;
}

function decodeLiteralString(
  raw: string,
  codes?: CMap | null,
  twoByte = false,
): string {
  // A CID font with the Identity-H encoding carries 2-byte character
  // identifiers, so the string has to be read in pairs and looked up.
  if (twoByte && codes && codes.size > 0) {
    let out = '';
    for (let i = 0; i + 1 < raw.length; i += 2) {
      const code = (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1);
      const mapped = codes.get(code);
      out += mapped ?? '';
    }
    if (out.length > 0) return out;
  }

  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = raw[++i];
    switch (next) {
      case 'n': out += '\n'; break;
      case 'r': out += '\r'; break;
      case 't': out += '\t'; break;
      case 'b': out += '\b'; break;
      case 'f': out += '\f'; break;
      case '(': out += '('; break;
      case ')': out += ')'; break;
      case '\\': out += '\\'; break;
      case '\n': break;
      case undefined: break;
      default:
        if (next >= '0' && next <= '7') {
          let octal = next;
          while (octal.length < 3 && raw[i + 1] >= '0' && raw[i + 1] <= '7') {
            octal += raw[++i];
          }
          out += String.fromCharCode(parseInt(octal, 8));
        } else {
          out += next;
        }
    }
  }
  return out;
}

/** Decodes a hex string, optionally through a font's Unicode mapping. */
function decodeHexString(raw: string, cmap?: CMap | null, forceTwoByte = false): string {
  const clean = raw.replace(/[^0-9a-fA-F]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i + 1 < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }

  if (cmap && cmap.size > 0) {
    // A CID font with the Identity-H encoding ALWAYS uses 2-byte codes, so
    // the one-byte attempt must be skipped for it.
    if (!forceTwoByte && bytes.length > 0) {
      let oneByte = '';
      let matchedAll = true;
      for (const b of bytes) {
        const mapped = cmap.get(b);
        if (mapped === undefined) {
          matchedAll = false;
          break;
        }
        oneByte += mapped;
      }
      if (matchedAll && oneByte.length > 0) return oneByte;
    }
    let twoByte = '';
    let matched = true;
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const code = (bytes[i] << 8) | bytes[i + 1];
      const mapped = cmap.get(code);
      if (mapped === undefined) {
        matched = false;
        break;
      }
      twoByte += mapped;
    }
    if (matched && twoByte.length > 0) return twoByte;

    // Partial mapping: translate the codes the font knows and keep the rest.
    const partial = bytes
      .map((b) => cmap.get(b) ?? String.fromCharCode(b))
      .join('');
    if (partial.length > 0) return partial;
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return out;
  }
  return bytes.map((b) => String.fromCharCode(b)).join('');
}

/**
 * Pulls the text-showing operators out of one decoded content stream.
 * Returns the pieces in document order.
 */
/**
 * The character mapping of one font.
 *
 * `twoByte` is true for the CID fonts that use the `Identity-H` encoding:
 * their strings carry 2-byte character identifiers, not 1-byte codes.
 */
export interface FontCodeMap {
  codes: CMap;
  twoByte: boolean;
}

export function extractTextFromContentStream(
  stream: string,
  fontMaps: Map<string, CMap | FontCodeMap> = new Map(),
): string[] {
  const pieces: string[] = [];
  let i = 0;
  let arrayDepth = 0;
  /** Kerning value seen inside the current TJ array (text space units). */
  let pendingKern = 0;
  /** The Unicode mapping of the font selected with `Tf`. */
  let currentMap: CMap | null = null;
  /** Whether the selected font uses 2-byte character identifiers. */
  let currentTwoByte = false;

  const selectFont = (name: string): void => {
    const entry = fontMaps.get(name);
    if (!entry) {
      currentMap = null;
      currentTwoByte = false;
      return;
    }
    if (entry instanceof Map) {
      currentMap = entry;
      currentTwoByte = false;
    } else {
      currentMap = entry.codes;
      currentTwoByte = entry.twoByte;
    }
  };

  /**
   * Reads a literal string body. The opening parenthesis has already been
   * consumed, so the nesting starts at depth 1.
   */
  const readBalanced = (): string | null => {
    let depth = 1;
    let out = '';
    for (; i < stream.length; i++) {
      const ch = stream[i];
      if (ch === '\\') {
        out += ch + (stream[i + 1] ?? '');
        i++;
        continue;
      }
      if (ch === '(') depth++;
      if (ch === ')') {
        depth--;
        if (depth === 0) {
          i++;
          return out;
        }
      }
      out += ch;
    }
    return null;
  };

  /** True when the text just read is followed by a text-showing operator. */
  const isShown = (): boolean => {
    if (arrayDepth > 0) return true;
    return /^\s*T[jJ*'"]/.test(stream.slice(i, i + 4));
  };

  while (i < stream.length) {
    const ch = stream[i];

    // Font selection: `/F1 12 Tf`
    if (ch === '/' && /^\/[A-Za-z0-9#+._-]+/.test(stream.slice(i))) {
      const nameMatch = /^\/([A-Za-z0-9#+._-]+)/.exec(stream.slice(i))!;
      const name = nameMatch[1];
      const after = stream.slice(i + nameMatch[0].length);
      if (/^\s+[\d.]+\s+Tf/.test(after)) {
        selectFont(name);
        i += nameMatch[0].length;
        continue;
      }
    }

    if (ch === '[') {
      arrayDepth++;
      pendingKern = 0;
      i++;
      continue;
    }
    if (ch === ']') {
      arrayDepth = Math.max(0, arrayDepth - 1);
      pendingKern = 0;
      i++;
      continue;
    }

    if (ch === '(') {
      i++;
      const raw = readBalanced();
      if (raw === null) break;
      if (isShown()) {
        // Inside a TJ array a large negative kern means the glyphs are a word
        // apart (the space glyph itself is often not encoded).
        if (arrayDepth > 0 && pendingKern <= WORD_SPACE_KERN) pieces.push(' ');
        pieces.push(decodeLiteralString(raw, currentMap, currentTwoByte));
      }
      pendingKern = 0;
      continue;
    }

    if (ch === '<' && stream[i + 1] !== '<') {
      const end = stream.indexOf('>', i);
      if (end === -1) break;
      const raw = stream.slice(i + 1, end);
      i = end + 1;
      if (isShown()) {
        if (arrayDepth > 0 && pendingKern <= WORD_SPACE_KERN) pieces.push(' ');
        pieces.push(decodeHexString(raw, currentMap, currentTwoByte));
      }
      pendingKern = 0;
      continue;
    }

    // Numbers inside a TJ array carry the kerning between glyphs.
    if (arrayDepth > 0 && (ch === '-' || (ch >= '0' && ch <= '9'))) {
      const match = /^-?\d+(?:\.\d+)?/.exec(stream.slice(i));
      if (match) {
        pendingKern = Number(match[0]);
        i += match[0].length;
        continue;
      }
    }

    // Line/paragraph operators: emit a separator so words do not run together.
    if (ch === 'T' && (stream[i + 1] === '*' || stream[i + 1] === 'd' || stream[i + 1] === 'D')) {
      pieces.push('\n');
      i += 2;
      continue;
    }

    if (ch === 'E' && stream.slice(i, i + 2) === 'ET') {
      pieces.push('\n');
      i += 2;
      continue;
    }

    i++;
  }

  return pieces;
}

/** Normalises extracted PDF text into readable plain text. */
export function normalisePdfText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Builds the font-name -> Unicode map for one page's resources. */
export function pageFontMaps(
  resourcesDict: string,
  objects: Map<number, PdfObject>,
): Map<string, FontCodeMap> {
  const maps = new Map<string, FontCodeMap>();
  const fontsDict = resolveDict(resourcesDict, 'Font', objects);
  if (!fontsDict) return maps;

  const fontRe = /\/([A-Za-z0-9#+._-]+)\s+(\d+)\s+\d+\s+R/g;
  let match: RegExpExecArray | null;
  while ((match = fontRe.exec(fontsDict)) !== null) {
    const name = match[1];
    const fontObj = objects.get(Number(match[2]));
    if (!fontObj) continue;
    // A CID font with the Identity-H encoding carries 2-byte character
    // identifiers.
    const isIdentityH = /\/Encoding\s*\/Identity-H/i.test(fontObj.dict);
    const toUnicodeRefs = readReferences(fontObj.dict, 'ToUnicode');
    if (toUnicodeRefs.length > 0) {
      const cmapObj = objects.get(toUnicodeRefs[0]);
      if (cmapObj && cmapObj.data) {
        const cmap = parseToUnicode(cmapObj.data.toString('latin1'));
        if (cmap.size > 0) {
          maps.set(name, { codes: cmap, twoByte: isIdentityH });
          continue;
        }
      }
    }
    // No ToUnicode CMap. The font may still be an embedded TrueType font
    // whose own `cmap` table maps Unicode to the glyph index - which is all a
    // character identifier needs to become readable.
    const embedded = embeddedFontCmap(fontObj, objects);
    if (embedded.size > 0) maps.set(name, { codes: embedded, twoByte: true });
  }

  return maps;
}

/**
 * The GID -> Unicode map of the TrueType font embedded in a CID font.
 *
 * The path through the PDF is: the Type0 font -> its descendant CIDFont ->
 * that font's descriptor -> the embedded font program (FontFile2).
 */
function embeddedFontCmap(
  fontObj: PdfObject,
  objects: Map<number, PdfObject>,
): CMap {
  const descendantRefs = readReferences(fontObj.dict, 'DescendantFonts');
  const descendantDict = descendantRefs.length
    ? objects.get(descendantRefs[0])?.dict
    : undefined;
  if (!descendantDict) return new Map();

  const descriptorRefs = readReferences(descendantDict, 'FontDescriptor');
  const descriptorDict = descriptorRefs.length
    ? objects.get(descriptorRefs[0])?.dict
    : undefined;
  if (!descriptorDict) return new Map();

  const fontFileRefs = readReferences(descriptorDict, 'FontFile2');
  const fontFileObj = fontFileRefs.length ? objects.get(fontFileRefs[0]) : undefined;
  if (!fontFileObj || !fontFileObj.data) return new Map();

  return parseEmbeddedFontCmap(fontFileObj.data);
}

/**
 * Extracts the text layer of a PDF buffer.
 * A PDF with no text-showing operators is reported as scanned.
 */
/**
 * Builds a GID -> Unicode map from an EMBEDDED TrueType font.
 *
 * Some PDFs use CID fonts with the `Identity-H` encoding and NO ToUnicode
 * CMap. The text operators then carry 2-byte CHARACTER IDENTIFIERS, which
 * are the glyph indices of the embedded font. The embedded font's own `cmap`
 * table maps Unicode -> glyph index, so reversing it turns a character
 * identifier into the character it stands for.
 *
 * This is what the School of ICT's date sheet needs: every one of its fonts
 * is `Identity-H` with no ToUnicode, so without this the whole sheet
 * extracted as 58 046 characters of noise and the school silently had no
 * date sheet at all.
 */
export function parseEmbeddedFontCmap(fontData: Buffer): CMap {
  const map: CMap = new Map();
  if (!fontData || fontData.length < 12) return map;

  // The sfnt table directory.
  const numTables = fontData.readUInt16BE(4);
  let cmapOffset = -1;
  let cmapLength = 0;
  for (let i = 0; i < numTables; i += 1) {
    const record = 12 + i * 16;
    if (record + 16 > fontData.length) break;
    const tag = fontData.toString('latin1', record, record + 4);
    if (tag === 'cmap') {
      cmapOffset = fontData.readUInt32BE(record + 8);
      cmapLength = fontData.readUInt32BE(record + 12);
      break;
    }
  }
  if (cmapOffset < 0 || cmapOffset + 4 > fontData.length) return map;

  // The cmap table is only `cmapLength` bytes long. A font whose directory
  // lies about that length must not be read past the end of its own table,
  // so the table's end bounds every read below.
  const cmapEnd = Math.min(fontData.length, cmapOffset + Math.max(cmapLength, 4));

  // The cmap table holds several encodings; take the Unicode one.
  const subtableCount = fontData.readUInt16BE(cmapOffset + 2);
  let chosen = -1;
  let chosenScore = -1;
  for (let i = 0; i < subtableCount; i += 1) {
    const record = cmapOffset + 4 + i * 8;
    if (record + 8 > cmapEnd) break;
    const platformId = fontData.readUInt16BE(record);
    const encodingId = fontData.readUInt16BE(record + 2);
    const offset = cmapOffset + fontData.readUInt32BE(record + 4);
    if (offset + 4 > cmapEnd) continue;
    const format = fontData.readUInt16BE(offset);
    // (3,10) format 12 is the full Unicode range, (3,1) format 4 is the
    // BMP, (0,x) is a Unicode platform too.
    let score = -1;
    if (platformId === 3 && encodingId === 10 && format === 12) score = 4;
    else if (platformId === 3 && encodingId === 1 && format === 4) score = 3;
    else if (platformId === 0 && format === 12) score = 2;
    else if (platformId === 0 && format === 4) score = 1;
    if (score > chosenScore) {
      chosenScore = score;
      chosen = offset;
    }
  }
  if (chosen < 0) return map;

  const unicodeToGid = new Map<number, number>();
  const format = fontData.readUInt16BE(chosen);

  if (format === 4) {
    const segCount = fontData.readUInt16BE(chosen + 6) / 2;
    const endCodes = chosen + 14;
    const startCodes = endCodes + segCount * 2 + 2;
    const idDeltas = startCodes + segCount * 2;
    const idRangeOffsets = idDeltas + segCount * 2;
    for (let seg = 0; seg < segCount; seg += 1) {
      const end = fontData.readUInt16BE(endCodes + seg * 2);
      const start = fontData.readUInt16BE(startCodes + seg * 2);
      const delta = fontData.readInt16BE(idDeltas + seg * 2);
      const rangeOffset = fontData.readUInt16BE(idRangeOffsets + seg * 2);
      if (start > end) continue;
      for (let code = start; code <= end && code !== 0xffff; code += 1) {
        let gid: number;
        if (rangeOffset === 0) {
          gid = (code + delta) & 0xffff;
        } else {
          const glyphIndexAddress =
            idRangeOffsets + seg * 2 + rangeOffset + (code - start) * 2;
          if (glyphIndexAddress + 2 > fontData.length) continue;
          gid = fontData.readUInt16BE(glyphIndexAddress);
          if (gid !== 0) gid = (gid + delta) & 0xffff;
        }
        if (gid !== 0 && !unicodeToGid.has(code)) unicodeToGid.set(code, gid);
      }
    }
  } else if (format === 12) {
    const groupCount = fontData.readUInt32BE(chosen + 12);
    for (let g = 0; g < groupCount; g += 1) {
      const group = chosen + 16 + g * 12;
      if (group + 12 > fontData.length) break;
      const start = fontData.readUInt32BE(group);
      const end = fontData.readUInt32BE(group + 4);
      const startGid = fontData.readUInt32BE(group + 8);
      for (let code = start; code <= end; code += 1) {
        if (!unicodeToGid.has(code)) unicodeToGid.set(code, startGid + (code - start));
      }
    }
  } else {
    return map;
  }

  // Reverse it: glyph index -> the character it stands for.
  for (const [code, gid] of unicodeToGid) {
    if (!map.has(gid)) {
      map.set(gid, String.fromCodePoint(code));
    }
  }
  return map;
}

export function extractPdfText(buffer: Buffer): PdfTextResult {
  if (!buffer || buffer.length === 0) {
    return { text: '', decodedStreams: 0, isScanned: false };
  }

  const source = buffer.toString('latin1');
  const objects = parseObjects(source);

  // Build a per-page view so each content stream uses its own fonts.
  const pages: Array<{ contents: number[]; fonts: Map<string, FontCodeMap> }> = [];
  for (const obj of objects.values()) {
    if (!/\/Type\s*\/Page[^s]/.test(obj.dict)) continue;
    const contents = readReferences(obj.dict, 'Contents');
    if (contents.length === 0) continue;
    const resources = resolveDict(obj.dict, 'Resources', objects);
    pages.push({ contents, fonts: pageFontMaps(resources, objects) });
  }

  const pieces: string[] = [];
  let decodedStreams = 0;
  const seenObjects = new Set<number>();

  const decodeStream = (obj: PdfObject, fonts: Map<string, FontCodeMap>): void => {
    if (!obj.data) return;
    const text = obj.data.toString('latin1');
    if (!/(?:Tj|TJ)\b/.test(text)) return;
    decodedStreams++;
    pieces.push(...extractTextFromContentStream(text, fonts));
  };

  // Prefer the page-aware path: it decodes subset fonts correctly.
  for (const page of pages) {
    for (const ref of page.contents) {
      const obj = objects.get(ref);
      if (!obj) continue;
      seenObjects.add(ref);
      decodeStream(obj, page.fonts);
    }
  }

  if (decodedStreams === 0) {
    // Fallback for documents whose page tree could not be walked.
    STREAM_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = STREAM_RE.exec(source)) !== null) {
      const raw = Buffer.from(match[1], 'latin1');
      const dictionary = precedingDictionary(source, match.index);
      if (/\/Subtype\s*\/Image/.test(dictionary)) continue;
      let decoded: Buffer | null = null;
      if (/\/FlateDecode/.test(dictionary)) {
        decoded = inflate(raw);
      } else {
        decoded = raw;
      }
      if (!decoded) continue;
      const text = decoded.toString('latin1');
      if (!/(?:Tj|TJ)\b/.test(text)) continue;
      decodedStreams++;
      pieces.push(...extractTextFromContentStream(text, new Map()));
    }
  }

  const text = normalisePdfText(pieces.join(''));
  // A real text layer always yields readable text; a scanned page yields
  // none, and a subsetted font without a ToUnicode CMap yields NOISE.
  const isScanned = !hasReadableText(text);

  return { text, decodedStreams, isScanned };
}

/**
 * True when the extracted text can actually be READ.
 *
 * A PDF that carries a subsetted font without a ToUnicode CMap extracts as
 * the raw GLYPH INDEXES - which look like text to a naive check (they are
 * full of ASCII letters) but are meaningless. The School of ICT's date sheet
 * is exactly that: the extractor returned 58 046 characters of noise, the
 * "there are enough letters" test passed, and the sheet was silently read as
 * having no slots at all.
 *
 * Real text has WORDS. Glyph-index noise does not: the runs are one or two
 * characters long, separated by the spacing operators of the content
 * stream.
 */
export function hasReadableText(text: string): boolean {
  if (!text) return false;
  const letters = text.replace(/[^A-Za-z0-9]/g, '').length;
  if (letters < 12) return false;
  // A word is a run of three or more letters. Genuine documents are full of
  // them - the School of Law sheet has 211 of them and the School of Basic
  // Science 220. Glyph-index noise has NONE: the School of ICT sheet
  // produced 58 046 characters of noise and not a single three-letter run.
  const words = text.match(/[A-Za-z]{3,}/g) ?? [];
  return words.length >= 2;
}

/**
 * Extracts the embedded raster images of a scanned PDF.
 *
 * A scanned notice is usually one JPEG per page. Tesseract reads images, not
 * PDFs, so the images have to be pulled out first. Only the common
 * `/DCTDecode` (JPEG) and `/FlateDecode` (raw bitmap) filters are decoded;
 * anything else is skipped rather than guessed at.
 */
export function extractPdfImages(buffer: Buffer): Buffer[] {
  if (!buffer || buffer.length === 0) return [];
  const source = buffer.toString('latin1');
  const images: Buffer[] = [];

  STREAM_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = STREAM_RE.exec(source)) !== null) {
    const dictionary = precedingDictionary(source, match.index);
    if (!/\/Subtype\s*\/Image/.test(dictionary)) continue;
    const width = Number(/\/Width\s+(\d+)/.exec(dictionary)?.[1] ?? 0);
    const height = Number(/\/Height\s+(\d+)/.exec(dictionary)?.[1] ?? 0);
    if (width <= 0 || height <= 0) continue;
    // Skip tiny decorative images.
    if (width < 200 || height < 200) continue;

    const raw = Buffer.from(match[1], 'latin1');
    if (/\/DCTDecode/.test(dictionary)) {
      // The stream is a complete JPEG file.
      images.push(raw);
      continue;
    }
    if (/\/FlateDecode/.test(dictionary)) {
      const decoded = inflate(raw);
      if (decoded) images.push(decoded);
    }
  }

  return images;
}

export default extractPdfText;
