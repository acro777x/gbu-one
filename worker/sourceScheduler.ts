/**
 * GBU One — Per-source scheduling for the worker.
 *
 * `worker/sources.config.ts` declares an `intervalMinutes` for every source.
 * Until now nothing read it, so the 15-minute cron fetched the Hindi holiday
 * list (a scan that needs OCR) 96 times a day, and the academic calendar
 * PDF 8 times a day.
 *
 * The scheduler keeps the "last fetched at" time per source. The worker runs
 * as a short-lived process on a cron, so the state has to survive the
 * process: it lives in the `worker_runs` table, which the worker writes
 * anyway to record its runs.
 */
import { fetchLastRunAt, recordWorkerRun } from './supabaseClient';

export interface SourceFetchDecision {
  /** True when the source must not be fetched in this run. */
  skip: boolean;
  /** Why the source was skipped (for the log). */
  reason?: string;
  /** When the source was last fetched, when it is known. */
  lastFetchedAt?: Date;
}

export interface SourceScheduler {
  /** Decides whether a source may be fetched now. */
  shouldFetch(sourceKey: string, intervalMinutes: number): Promise<SourceFetchDecision>;
  /** Records that the source was fetched. */
  markFetched(sourceKey: string, itemsFound: number): Promise<void>;
}

/** A scheduler that always allows a fetch. Useful for tests and for a
 *  database that is not configured. */
export const ALWAYS_FETCH: SourceScheduler = {
  async shouldFetch(): Promise<SourceFetchDecision> {
    return { skip: false };
  },
  async markFetched(): Promise<void> {
    // nothing to record
  },
};

/**
 * The scheduler that keeps its state in `worker_runs`.
 *
 * The last successful run of the source is the moment it was last fetched.
 */
export const workerRunsScheduler: SourceScheduler = {
  async shouldFetch(sourceKey, intervalMinutes): Promise<SourceFetchDecision> {
    if (!intervalMinutes || intervalMinutes <= 0) {
      return { skip: false };
    }
    const lastFetchedAt = await fetchLastRunAt(sourceKey);
    if (!lastFetchedAt) {
      return { skip: false };
    }
    const elapsedMs = Date.now() - lastFetchedAt.getTime();
    const intervalMs = intervalMinutes * 60_000;
    if (elapsedMs < intervalMs) {
      const remainingMinutes = Math.ceil((intervalMs - elapsedMs) / 60_000);
      return {
        skip: true,
        reason: `interval not elapsed (${remainingMinutes} min left)`,
        lastFetchedAt,
      };
    }
    return { skip: false, lastFetchedAt };
  },

  async markFetched(sourceKey, itemsFound): Promise<void> {
    await recordWorkerRun(sourceKey, 'ok', itemsFound, itemsFound);
  },
};
