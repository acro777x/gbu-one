/**
 * The one place that names how a student reaches the GBU One maintainers.
 *
 * The owner created the real mailbox on 2026-11-19: support@gbuone.space.
 * It replaces the old `student.gbuone@gmail.com` placeholder that had been
 * copied into the About screen, the landing page and the worker's
 * User-Agent. Every one of those now reads this constant, so a future
 * mailbox change cannot leave a stale address in the shipped app.
 */
export const SUPPORT_EMAIL = 'support@gbuone.space';

/** The polite, identifiable User-Agent the worker sends to GBU's servers. */
export const WORKER_USER_AGENT = `GBUOne-Worker/1.0 (student project; contact: ${SUPPORT_EMAIL})`;
