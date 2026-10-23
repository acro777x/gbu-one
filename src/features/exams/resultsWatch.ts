/**
 * GBU One - "has my result been published?"
 *
 * The examination portal publishes one public result sheet per school
 * (`https://exams.gbu.ac.in/uploads/results/<code>.pdf`). The file keeps its
 * URL and is overwritten each session, so the only reliable signal that a new
 * result has landed is the sheet's own revision: its `Last-Modified` header and
 * its size. This module is that comparison, and nothing else - no network, no
 * native modules - so it can be unit tested in Node
 * (tests/results_watch.test.ts).
 *
 * The personal result and the admit card stay behind the portal's own login,
 * which asks for a roll number, a password and a captcha. GBU One never asks
 * for those and never stores them; it watches the public sheet instead and
 * hands the student over to the portal (docs/DATA_SOURCES.md,
 * docs/OPEN_QUESTIONS.md #22).
 */

/** Where the last seen revision of each sheet is kept. */
export const RESULTS_WATCH_STORAGE_KEY = '@gbu_one_results_watch';

/** What one published sheet looks like from the outside. */
export interface SheetFingerprint {
  code: string;
  /** The school the sheet belongs to, e.g. SOICT. */
  school: string;
  url: string;
  /** The portal's `Last-Modified` header, when it sends one. */
  lastModified: string | null;
  /** The sheet's size in bytes, when it is known. */
  bytes: number | null;
}

/** The revision of one sheet, as last stored on the phone. */
export interface SheetRevision {
  lastModified: string | null;
  bytes: number | null;
}

/** Every revision the phone has seen, keyed by sheet code. */
export type ResultsWatchState = Record<string, SheetRevision>;

/** A sheet whose revision moved, or that appeared where none was before. */
export interface SheetChange {
  code: string;
  school: string;
  url: string;
  /** `revised` when the same sheet was republished, `published` when it appeared. */
  status: 'revised' | 'published';
}

/** The revision a fingerprint carries. */
export function revisionOf(fingerprint: SheetFingerprint): SheetRevision {
  return {
    lastModified: fingerprint.lastModified ?? null,
    bytes: typeof fingerprint.bytes === 'number' && Number.isFinite(fingerprint.bytes)
      ? fingerprint.bytes
      : null,
  };
}

/**
 * Whether two revisions are the same. Two unknowns are *not* the same: a sheet
 * the portal answers with a 404 or a redirect has no revision, and that must
 * never be read as "the result changed".
 */
export function isKnownRevision(revision: SheetRevision | undefined): boolean {
  return Boolean(revision && (revision.lastModified || typeof revision.bytes === 'number'));
}

/** True when the revision is known and identical to the stored one. */
export function sameRevision(
  previous: SheetRevision | undefined,
  current: SheetRevision,
): boolean {
  if (!isKnownRevision(previous) || !isKnownRevision(current)) return true;
  if (previous?.lastModified && current.lastModified) {
    return previous.lastModified === current.lastModified && previous.bytes === current.bytes;
  }
  return previous?.bytes === current.bytes;
}

/**
 * The sheets whose revision moved since the last look. The first sight of a
 * sheet is not news (the phone simply had no baseline), but a sheet that
 * appears inside an already-known set is.
 */
export function detectSheetChanges(
  state: ResultsWatchState,
  current: SheetFingerprint[],
): SheetChange[] {
  const changes: SheetChange[] = [];
  const hasBaseline = Object.keys(state).length > 0;
  for (const fingerprint of current) {
    const revision = revisionOf(fingerprint);
    if (!isKnownRevision(revision)) continue;

    const previous = state[fingerprint.code];
    if (!previous) {
      if (hasBaseline) {
        changes.push({
          code: fingerprint.code,
          school: fingerprint.school,
          url: fingerprint.url,
          status: 'published',
        });
      }
      continue;
    }

    if (!sameRevision(previous, revision)) {
      changes.push({
        code: fingerprint.code,
        school: fingerprint.school,
        url: fingerprint.url,
        status: 'revised',
      });
    }
  }
  return changes;
}

/** The state to store after a check. */
export function nextWatchState(
  state: ResultsWatchState,
  current: SheetFingerprint[],
): ResultsWatchState {
  const next: ResultsWatchState = { ...state };
  for (const fingerprint of current) {
    const revision = revisionOf(fingerprint);
    if (isKnownRevision(revision)) next[fingerprint.code] = revision;
  }
  return next;
}

/** The notification title for a changed sheet. */
export function resultAlertTitle(change: SheetChange): string {
  return `${change.school} results published`;
}

/** The notification body for a changed sheet. */
export function resultAlertBody(change: SheetChange): string {
  return change.status === 'published'
    ? `The examination portal added a new result sheet for ${change.school}. Tap to read it.`
    : `The examination portal re-published the ${change.school} result sheet - usually a revised or re-checked result. Tap to read it.`;
}

/** Reads the stored revisions, ignoring anything malformed. */
export function parseWatchState(raw: string | null): ResultsWatchState {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  const state: ResultsWatchState = {};
  for (const [code, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const entry = value as Partial<SheetRevision>;
    state[code] = {
      lastModified: typeof entry.lastModified === 'string' ? entry.lastModified : null,
      bytes: typeof entry.bytes === 'number' && Number.isFinite(entry.bytes) ? entry.bytes : null,
    };
  }
  return state;
}