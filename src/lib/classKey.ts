/**
 * Canonical class key ("section") form shared by the app and the worker.
 *
 * The university publishes section codes such as `BCS-II B`; both sides must
 * agree on one representation so a device registered by the app is matched by
 * the worker's timetable push targeting.
 */
export function normaliseClassKey(raw?: string | null): string {
  return (raw || '').trim().toUpperCase();
}

/** True when the value can be used as a class key for push targeting. */
export function isValidClassKey(raw?: string | null): boolean {
  return normaliseClassKey(raw).length > 0;
}
