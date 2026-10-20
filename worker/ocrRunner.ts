/**
 * GBU One — OCR provider runners (worker).
 *
 * Two providers, chosen by env (see worker/ocrService.ts):
 * - `tesseract` (default): the local Tesseract binary. No key, no network,
 *   works for images and for pages rasterised from a scanned PDF.
 * - `vision`: a hosted vision model, used when OCR_PROVIDER=vision and
 *   VISION_API_KEY are both set.
 *
 * Both runners are dependency-free and fail soft: when the tool or the key is
 * missing the runner returns an empty string and the pipeline skips the file
 * instead of crashing the worker.
 */
import { execFile, spawnSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export interface OcrRunInput {
  bytes: Buffer;
  fileName: string;
  kind: string;
}

export interface OcrRunnerResult {
  text: string;
  provider: 'tesseract' | 'vision';
  ok: boolean;
  reason?: string;
}

const TESSERACT_TIMEOUT_MS = 60_000;
const MAX_OCR_BYTES = 15 * 1024 * 1024;

/** True when the Tesseract binary is callable. */
export function isTesseractAvailable(): boolean {
  try {
    // `where` on Windows, `which` elsewhere. A non-zero exit just means absent.
    const finder = process.platform === 'win32' ? 'where' : 'which';
    const result = spawnSync(finder, ['tesseract'], { stdio: 'ignore' });
    return result.status === 0;
  } catch {
    return false;
  }
}

function runCommand(
  command: string,
  args: string[],
  input?: Buffer,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const child = execFile(
      command,
      args,
      { timeout: TESSERACT_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          stdout: String(stdout ?? ''),
          stderr: String(stderr ?? ''),
          code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        });
      },
    );
    if (input) {
      child.stdin?.end(input);
    }
  });
}

/**
 * Runs the local Tesseract binary on the bytes.
 * `tesseract <file> stdout` prints the recognised text to stdout.
 */
export async function runTesseract(input: OcrRunInput): Promise<OcrRunnerResult> {
  if (!input.bytes || input.bytes.length === 0) {
    return { text: '', provider: 'tesseract', ok: false, reason: 'empty-file' };
  }
  if (input.bytes.length > MAX_OCR_BYTES) {
    return { text: '', provider: 'tesseract', ok: false, reason: 'too-large' };
  }

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gbu-ocr-'));
  const file = path.join(dir, input.fileName || 'attachment.bin');
  try {
    await fs.writeFile(file, input.bytes);
    const { stdout, stderr, code } = await runCommand('tesseract', [file, 'stdout']);
    if (code !== 0) {
      return {
        text: '',
        provider: 'tesseract',
        ok: false,
        reason: stderr.trim().split('\n')[0] || 'tesseract-failed',
      };
    }
    return { text: stdout, provider: 'tesseract', ok: true };
  } catch (err) {
    return {
      text: '',
      provider: 'tesseract',
      ok: false,
      reason: err instanceof Error ? err.message : 'tesseract-unavailable',
    };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Runs a hosted vision model over the attachment.
 * The endpoint is expected to accept `{ image: <base64>, mimeType }` and to
 * answer `{ text: string }`.
 */
export async function runVision(
  input: OcrRunInput,
  options: {
    endpoint?: string;
    apiKey?: string;
    model?: string;
  } = {},
): Promise<OcrRunnerResult> {
  const apiKey = options.apiKey || process.env.VISION_API_KEY || '';
  if (!apiKey) {
    return { text: '', provider: 'vision', ok: false, reason: 'no-api-key' };
  }
  const endpoint =
    options.endpoint || process.env.VISION_API_URL || 'https://api.openai.com/v1/chat/completions';

  const mimeType = input.kind === 'pdf' ? 'application/pdf' : 'image/png';
  const body = JSON.stringify({
    model: options.model || process.env.VISION_MODEL || 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe all text in this document exactly as printed.' },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${input.bytes.toString('base64')}` },
          },
        ],
      },
    ],
  });

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });
    if (!res.ok) {
      return { text: '', provider: 'vision', ok: false, reason: `http-${res.status}` };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      text?: string;
    };
    const text =
      json.text ?? json.choices?.[0]?.message?.content ?? '';
    return { text: String(text), provider: 'vision', ok: true };
  } catch (err) {
    return {
      text: '',
      provider: 'vision',
      ok: false,
      reason: err instanceof Error ? err.message : 'vision-failed',
    };
  }
}
