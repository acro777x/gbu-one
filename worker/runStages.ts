/**
 * GBU One — The failure contract of a worker run.
 *
 * The worker runs five stages. The old code had one `process.exitCode = 1`
 * for all of them, so a failed calendar or a failed attachment stage still
 * exited 0 and the cron showed green while the data was stale.
 *
 * The contract is now:
 *
 *  - every stage reports whether it worked,
 *  - the failing stages are collected,
 *  - the process exits with code 1 at the END of the run, so one failure
 *    does not hide the others,
 *  - the names of the failing stages are logged.
 */

/** The stages of a worker run. */
export const STAGE_NAMES = [
  'schema',
  'notices',
  'timetable',
  'calendar',
  'results',
  'attachments',
] as const;

/** The name of one stage. */
export type StageName = (typeof STAGE_NAMES)[number];

/**
 * Collects the stages that failed.
 *
 * The class is deliberately free of any dependency so it can be unit
 * tested: the worker's exit code is its only output.
 */
export class StageFailures {
  private readonly failed: StageName[] = [];

  /** Records that a stage failed. */
  record(stage: StageName, reason: string): void {
    this.failed.push(stage);
    console.error(JSON.stringify({ event: 'worker_stage_failed', stage, reason }));
  }

  /** Records that a stage worked. */
  recordOk(_stage: StageName): void {
    // Nothing to record: a stage that worked is not a failure.
  }

  /** True when the stage failed. */
  has(stage: StageName): boolean {
    return this.failed.includes(stage);
  }

  /** The names of the failing stages, in the order they failed. */
  list(): StageName[] {
    return [...this.failed];
  }

  /**
   * The exit code of the run: 1 when a stage failed, 0 otherwise.
   */
  exitCode(): number {
    return this.failed.length > 0 ? 1 : 0;
  }
}
