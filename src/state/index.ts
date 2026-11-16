/**
 * The canonical export for the domain state machines.
 *
 * - S2 Auth Machine (src/state/authMachine.ts)
 *
 * The other four machines were removed in November 2026. They were
 * specifications of lifecycles that the app implements in its own modules
 * (the class alarm in `src/features/notifications/classAlarm.ts`, the
 * notices tiers in `src/features/notices/useNoticesQuery.ts`, the
 * timetable tiers in `src/features/timetable/timetableStore.ts` and the
 * results watch in `src/features/exams/resultsWatch.ts`), and nothing in
 * the app ever imported them.
 *
 * `tests/state_machine_integration.test.ts` now refuses to let that happen
 * again: every machine in `src/state` has to be imported by production
 * code.
 */

export * from './types';
export * from './authMachine';
