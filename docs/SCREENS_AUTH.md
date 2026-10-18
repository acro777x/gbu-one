# Screens — Auth, Onboarding, Profile

## Security rule (non-negotiable)
**Never collect, transmit to our backend, log, or store a student's university password** (GBU Samarth / portal / mygbu). Our own account is separate from university credentials.

## Flow
Splash → Onboarding (3 slides) → Login screen → Class setup → Home.
Guest users skip login and still get class setup (stored locally).

## 1. Splash
Wordmark, subtle glow, 1s max. Routes to onboarding on first launch, otherwise Home.

## 2. Onboarding (3 slides, hero style like Signal Bloom)
1. "Every GBU notice, sorted for you" (notices)
2. "Your timetable, always current" (timetable + change alerts)
3. "PYQs and exam dates in one place"
Pill-dot indicator, "Skip", "Next", last slide "Get started". Ask for notification permission on the last slide with a clear explanation, not on launch.

## 3. Login screen
Fields:
- **Roll number** (enrollment number; validate format loosely, trim, uppercase)
- **Password** (our app password, show/hide toggle)
Buttons: **Log in** (primary pill), **Create account**, **Continue as guest** (secondary, prominent).
- Create account: roll number, name, email (college or personal), app password (min 8), optional phone. Email verification via Supabase (code or link). No university password asked.
- Forgot password: email reset.
- Guest mode: banner "Guest mode — some features are limited". When a guest taps a feature needing identity (PYQ upload, cross-device sync, personalised push, result finder), show a friendly bottom sheet: "Create a free account to use this" with Create account / Not now. Never an error dialog.
- Errors: inline, human ("That roll number or password doesn't match").
- Rate limiting and lockout handled by Supabase; show a clear message.

### University credential features (future, owner will decide)
If a feature later needs a university login, it must authenticate directly against the university endpoint from the device, keep the token only in secure storage (expo-secure-store), never send it to Supabase or the worker, and be clearly consented. Document in `OPEN_QUESTIONS.md` before building.

## 4. Class setup (required for personalisation, also for guests)
Step sheet (N99-style bottom sheet with chips):
1. School (SoICT, SoE, SoM, SoBT, SoHSS, SoVSAS, SoLJG, SoBSC)
2. Programme and programme code (e.g. B.Tech CSE Cyber Security)
3. Semester / year
4. Section or batch (if the timetable API has it)
5. (Optional) elective subjects
Stored locally; synced to the profile if logged in. Changeable anytime from Profile.

## 5. Profile
- Header: squircle avatar (upload or initials), name, roll number, programme chip, semester chip.
- Card: My class (edit), notification preferences, language (English; Hindi later), theme (dark default, system option).
- Notification preferences: toggles for Notices (by category), Timetable changes, Exam/date sheet, Deadlines, Results; quiet hours.
- Saved items: saved notices, downloaded PYQs.
- Attendance tracker entry.
- Account: edit profile, change password, log out, delete account (hard delete of server data), export my data.
- About: version, data sources, disclaimer: "Official GBU student app (subject to university approval before release). Notices link to original university sources."
- Guest profile: shows "Guest", CTA card to create an account.

## Data kept per user (server, logged-in only)
`profiles(id, roll_no, name, email, school, programme_code, semester, section, avatar_url, created_at)`, `device_tokens`, `notification_prefs`, `saved_notices`, `pyq_uploads`. No university password, ever.

## Acceptance
- Guest can reach Home with a class selected without any network call to Supabase.
- Login works offline-aware (clear message if offline).
- Passwords never appear in logs or analytics.
- All form fields have labels, 44pt targets, keyboard navigation, and error text readable by screen readers.
