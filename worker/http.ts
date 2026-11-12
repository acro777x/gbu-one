/**
 * GBU One — HTTP helpers for the worker.
 *
 * docs/DATA_SOURCES.md promises three things that the worker used to ignore:
 *
 *  1. "1s delay between files" - the worker must not hammer the university.
 *  2. "exponential backoff on errors" - a transient failure must not end the
 *     run, and must not be retried in a tight loop either.
 *  3. "honour Retry-After" - when the university (or a proxy in front of it)
 *     asks us to slow down, we have to.
 *
 * This module holds the three primitives that make those promises real:
 * {@link fetchWithRetry}, {@link HostThrottle} and {@link parseRetryAfter}.
 * It has no dependency on the rest of the worker so every module can use it.
 */

/** A `fetch` implementation, so the helpers can be tested without a network. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Options of {@link fetchWithRetry}. */
export interface RetryOptions {
  /** How many attempts in total (1 = no retry). Default 3. */
  attempts?: number;
  /** The delay before the first retry; it doubles on every further attempt. */
  baseDelayMs?: number;
  /** Upper bound for a single backoff delay. Default 30s. */
  maxDelayMs?: number;
  /** Abort a single attempt after this many milliseconds. */
  timeoutMs?: number;
  /** The fetch implementation to use. Defaults to the global `fetch`. */
  fetchImpl?: FetchLike;
}

/** Statuses that are worth another attempt. */
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Reads a `Retry-After` header.
 *
 * The header holds either a number of seconds or an HTTP date. A date is
 * turned into the number of seconds that are still to wait. A value that
 * cannot be read yields `null`, so the caller falls back to its own backoff.
 */
export function parseRetryAfter(header: string | null | undefined): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (trimmed === '') return null;

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  const wait = date - Date.now();
  return wait > 0 ? wait : 0;
}

/** Waits for the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a URL with a timeout, retrying transient failures with an
 * exponential backoff.
 *
 * The timeout is per attempt, not for the whole call: a slow answer is
 * retried, a hanging socket is not.
 *
 * @param url The URL to fetch.
 * @param init The request options (headers, method, body, ...).
 * @param options Attempts, backoff and timeout.
 * @returns The last response. A response with a non-2xx status is returned
 *   as it is - only a thrown error is retried.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: RetryOptions = {},
): Promise<Response> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const doFetch =
    options.fetchImpl ?? ((target: string, request?: RequestInit) => fetch(target, request));

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const externalSignal = init.signal;
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const response = await doFetch(url, { ...init, signal: controller.signal });

      if (!RETRYABLE_STATUSES.has(response.status) || attempt === attempts) {
        return response;
      }

      const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
      const backoff = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      await sleep(retryAfter ?? backoff);
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
      if (attempt === attempts) throw err;
      const backoff = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      await sleep(backoff);
    } finally {
      clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`fetch failed: ${url}`);
}

/**
 * Keeps at least `delayMs` between two requests to the same host.
 *
 * The university serves every portal from the same few hosts, so the
 * politeness delay has to be per host, not per request.
 */
export class HostThrottle {
  private readonly lastRequestAt = new Map<string, number>();

  constructor(
    private readonly now: () => number = () => Date.now(),
  ) {}

  /**
   * Waits until the host may be contacted again.
   *
   * @param host The host name.
   * @param delayMs The minimum pause between two requests to that host.
   */
  async wait(host: string, delayMs: number): Promise<void> {
    if (delayMs <= 0) return;
    const last = this.lastRequestAt.get(host);
    if (last !== undefined) {
      const wait = delayMs - (this.now() - last);
      if (wait > 0) await sleep(wait);
    }
    this.lastRequestAt.set(host, this.now());
  }

  /** Records that the host was contacted, without waiting first. */
  mark(host: string): void {
    this.lastRequestAt.set(host, this.now());
  }
}

/**
 * The politeness throttle of the worker.
 *
 * It is shared by every module so the pause applies to the host, not to the
 * module: two different modules that talk to the same host still wait.
 */
export const politeThrottle = new HostThrottle();

/**
 * Waits before a request to `url` so the host is not hammered.
 *
 * @param url The URL that is about to be fetched.
 * @param delayMs The minimum pause between two requests to that host.
 */
export async function politeWait(url: string, delayMs: number): Promise<void> {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return;
  }
  await politeThrottle.wait(host, delayMs);
}
