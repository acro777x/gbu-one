# GBU One — Repaired UI Source

This folder is a repaired source overlay for the GBU One Expo app. It is not a standalone Expo project because the supplied archive did not contain package metadata or a lockfile.

The repair makes the app light-first, replaces hard-coded dark surfaces, improves shared card and floating navigation styling, fixes the root status bar and splash lifecycle, removes a false timetable-change flag, and replaces the broken SVG path-stroking logo animation with a safe whole-mark animation.

Copy the contents into the real Expo project, keeping its existing `package.json`, `app.json` or `app.config.*`, Babel configuration, lockfile, and native setup. Then run the project's normal typecheck, lint, and Expo checks.

Read `docs/FULL_UI_AUDIT.md` for the diagnosis and `docs/MASTER_REPAIR_PROMPT.md` for the application order and acceptance criteria.
