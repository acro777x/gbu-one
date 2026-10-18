# UI Spec — GBU One

Source of truth for visuals. Reference images are in `docs/design-refs/`:
- `adverse-casino.png` — dark frosted-glass cards, squircle avatars, floating bar
- `n99-beauty.png` — warm palette, bottom sheet, removable chips, selection toast
- `signal-bloom.png` — hero carousel, Continue-Watching cards, floating pill bottom bar
- Nuvio mobile (cloned to `../ref/nuvio-mobile`, read-only, GPL-3.0: look and behavior only, no code copying)

## Principles
Dark-first, cinematic, content-forward. Large rounded surfaces, soft blur, generous spacing, one accent colour. Every screen has a hero or a clear primary card.

## Design tokens (starting values; tune against the references)
| Token | Value |
|---|---|
| bg | `#0B0B0C` |
| surface | `#161618` |
| surface-glass | `rgba(255,255,255,0.08)` + blur 24 |
| border-glass | `rgba(255,255,255,0.12)` |
| text-primary | `#F5F5F4` |
| text-secondary | `#A8A29E` |
| accent / brand orange | `#FF6A2B` (logo, LIVE pill, key actions); logo ring gradient `#E04F14 → #FC6C1E → #FC9B22` |
| ivory | `#F8F8F6` (numeral "1", "GBU" in the wordmark, primary text on dark) |
| accent-warm (sheets, highlights) | `#D9CFC3` cream, `#2A1F18` brown (from N99) |
| success / warning / danger | `#3DD68C` / `#F5B83D` / `#FF5C5C` |
| radius | card 24, chip 999, avatar squircle 18, sheet 32 |
| spacing | 4 / 8 / 12 / 16 / 24 / 32 |
| type (final) | **Poppins Bold** for the wordmark, splash, hero and screen titles (28/32); **Inter** for everything else: section headers 20/24 semibold, body 15/22, caption 12/16 |

Respect dynamic text sizes and AA contrast.

## Bottom bar (match `signal-bloom.png` and Nuvio's feel)
- Floating pill, 16pt from bottom and sides, height ~64, radius 32, translucent glass (blur + tint), subtle border.
- 5 tabs: **Home, Timetable, Notices, PYQ, Profile**. Profile shows the user's avatar instead of an icon (guest: generic avatar).
- Active tab: darker capsule behind icon + label. Inactive: icon + small label, secondary colour.
- Tab switch animation: capsule slides between tabs (spring), icon scales slightly. Haptic tick on press.
- Reactive glow: faint accent glow under the active tab.
- Content scrolls under the bar; add bottom safe padding so nothing is hidden.
- Tablet / wide landscape: floating pill moves to top, centered.

## Screens

### Home
1. Header: logo/wordmark left, bell with unread dot, avatar right.
2. **Hero carousel** (full-bleed, like Signal Bloom): pinned/important notices and exam alerts. Large title, meta line (`Exam · Fees · 2 days left`), white pill button "View details", pill-style dot indicator (active dot elongated). Auto-advance 6s, pause on touch.
3. **Next class** card (like Continue Watching): subject, room, time, `1h 2m left` badge top-right, progress bar at bottom. If no class: "No more classes today".
4. **Timetable changed** banner when applicable (accent border).
5. **Deadlines** horizontal row with countdown chips.
6. **Trending PYQs** row (like Popular).
7. **Exam countdown** card.

### Timetable
Day selector (horizontal chips, today highlighted), vertical list of class cards (time rail on left, subject, faculty, room). Toggle: Day / Week / Compact. Changed items carry a "Changed" chip with old vs new. Pull to refresh; shows "Last updated" and offline state.

### Notices
Search field, removable filter chips (N99 style): category, school, semester, "For me". Cards: category chip, title (OCR/AI-cleaned), source, date, importance dot, deadline countdown if any. Extended-deadline threads collapse into one card with "Updated 3 times". Tap opens a bottom sheet (white/cream, N99 style) with summary, original image/PDF viewer, share, set reminder.

### PYQ
Step flow in a bottom sheet: School → Programme code → Semester → Subject, plus a search box that skips the steps. Results as 2-column grid cards (N99 inspo grid) with year, exam type (Mid/End/Back), upload status. Multi-select with a floating toast pill ("Added 3 papers") and bulk download. Upload button opens a form; uploads are marked "Pending review".

### Exam hub
Date sheet for my programme, revision badges, admit-card reminder, result finder status card ("Searching result PDFs for roll no. …").

### Calendar
Month view with academic calendar events and holidays; deadlines overlay.

### Attendance (inside Profile or Home shortcut)
Per-subject ring with percentage, +present / +absent buttons, local only.

### Auth / onboarding / profile
See `SCREENS_AUTH.md`.

## Components to build first
`GlassCard`, `Chip` (selectable, removable), `PillButton` (white and dark variants), `FloatingTabBar`, `HeroCarousel`, `NextClassCard`, `NoticeCard`, `BottomSheet`, `Toast`, `Avatar` (squircle), `EmptyState`, `Skeleton`.

## States
Every list: skeleton loading, empty (friendly copy + illustration), error (retry), offline (banner, cached data).

## QA loop
After each screen, screenshot it next to the reference image, list differences (radius, blur, spacing, type, capsule), fix, and save to `docs/qa/<screen>-<date>.png`.

## Brand (final)
Logo and typography are final; see `docs/LOGO_BRIEF.md`. The wordmark is live Poppins Bold text ("GBU" ivory, "One" orange). The official university seal slot (`<OfficialSeal />`) is reserved on splash, login footer and About and renders nothing until the owner supplies the official vector file. Never redraw the seal.
