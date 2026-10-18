# Notifications

## Channels (Android) / categories (iOS)
`notices_important`, `notices_general`, `timetable_changes`, `exams`, `deadlines`, `results`. Each can be toggled in Profile → Notification preferences. Quiet hours (default 23:00–07:00) delay non-urgent pushes.

## What triggers a push
| Trigger | Who gets it | Priority |
|---|---|---|
| New notice with importance ≥ 3 matching the user's school/programme/semester (or audience `all`) | matching users | high |
| New or extended deadline on a notice the user follows | matching users | high |
| Timetable change for the user's class | users with that `class_key` | high |
| Date sheet published or revised for the user's programme | matching users | high |
| Admit card notice | matching users | high |
| New result PDF posted for the user's programme | matching users (generic "Results posted for X"; roll-number match is local) | normal |
| Deadline countdown: 3 days, 1 day, 3 hours left | local notification, no server | normal |
| Approved PYQ upload / moderation outcome | uploader | low |

General notices (importance < 3) appear in the feed with a badge, no push, unless the user opted in.

## Importance scoring (starting rules, unit-test them)
+3 deadline present; +3 fees / scholarship / admit card / date sheet / result; +2 mentions the user's school or programme; +1 posted today; −3 tender / recruitment / EOI / PhD / procurement. Clamp 0–5.

## Timetable change message format
Short, specific, actionable:
- `Data Structures moved to 11:00 tomorrow (Room 204)`
- `Monday: 2 classes changed. Tap to see.`
Group multiple changes from one detection run into a single push.

## Deduplication
- One push per `(user, notice_id)`; threads push again only when the deadline actually changes ("Deadline extended to 30 Sep").
- Collapse bursts: if >3 pushes in 10 minutes, send one summary.

## Pipeline
Worker → compute audience → select `device_tokens` by profile/prefs → send through Expo push / FCM in batches of 100 → record receipts → delete invalid tokens.
Guests: register an anonymous device token with their selected class (no personal data) so they still get class-based pushes; ask permission at the right moment.

## Local notifications (no server)
Deadline countdowns, next-class reminders (10 minutes before, optional), attendance reminders. Scheduled with expo-notifications, rescheduled whenever data refreshes.

## Permissions UX
Ask on the last onboarding slide with a plain explanation. If denied, show a small in-app banner on Home with a deep link to settings; never nag more than once per week.

## Tests
Audience matching, importance scoring, dedupe, quiet hours, diff-to-message formatting.
