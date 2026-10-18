# Project Brief — GBU One

## Why
GBU students currently juggle many places for basic information:
- Notices on `test.gbu.ac.in/page/notices` (flat list, no filters, many are scanned JPG/PDF images with titles like `Scan_20260918.jpg`) and separately on `exams.gbu.ac.in`, `gbu.samarth.edu.in` (student portal) and `hostels.gbu.ac.in`.
- Deadlines get extended repeatedly (e.g. Monsoon 2026-27 fee deadline extended three times), so students miss the final date.
- Date sheets are revised after release.
- Results are one large PDF per programme; students hunt for their roll number.
- The timetable is on a separate system (`mygbu.in` outside campus) and the existing app is outdated and unmaintained.
- No official PYQ repository exists.

## Goal
One fast, good-looking app that tells a student exactly what matters to *their* class, and pushes a notification when it changes.

## Users
GBU students (all schools), Android first, iOS second. Guest mode during development.

## Features (v1 scope — all approved)
1. **Smart notice feed** — aggregate sources, OCR scanned notices, auto-tag (Exam / Fees / Scholarship / Hostel / Admission / Events / Other), filter by school and semester, thread extended deadlines, importance flag, push only relevant notices.
2. **Timetable** — choose school, programme, semester, section/class; fetch via the owner's API; snapshot + diff; notify only on changes to the student's class; offline cache; compact (minimal) view.
3. **Next class card** — on Home: subject, room, start time, "1h 2m left" countdown with progress bar.
4. **Exam hub** — date sheet filtered to programme, revision alerts, admit-card reminders, mid/end-sem countdown.
5. **Result finder** — on-device search of result PDFs for the student's roll number; alert when found.
6. **PYQ** — pick school → programme code → semester → subject, or type subject to search; crowdsourced uploads with moderation; Trending row.
7. **Deadline tracker** — fees, repeat/back paper forms, scholarships; countdowns; local reminders.
8. **Academic calendar + holidays** — from the official PDFs/pages, shown as calendar.
9. **Manual attendance tracker** — optional, per subject, local only.

Plus: login, onboarding, profile (see `SCREENS_AUTH.md`).

## Non-goals (v1)
Chat, payments, anything requiring storing university passwords, replacing the official student portal.

## Success looks like
A student opens the app, sees next class, any change to their timetable, and the 3 notices that matter to them, within 2 seconds, offline included.

## Tone
Clean, premium, dark-first. Friendly short copy. English UI (Hindi later).
