# Page structure and copy

Voice: a senior who knows the campus. Plain, short, specific. Sentence case. No exclamation marks, no buzzwords. Say what the app does, not how great it is.

Good: "Room changed? You'll see it before you reach the building."
Bad: "Seamlessly empower your academic journey."

## Order of sections

### 1. Header
Logo + "GBU One". Links: Features, Install, FAQ. Right side: "Download" button (gold). On phones: logo left, Download right, no hamburger.

### 2. Hero
Headline: **Know where your next class is.**
Sub: Timetable, notices, exam dates and past papers for Gautam Buddha University, in one app that works without internet.
Primary button: **Download for Android**
Small line under it: Free. Version {{VERSION}} · {{APK_SIZE}} · No sign-up needed
Secondary text link: See how it works (scrolls to section 4)
Right side (desktop) or below (phone): one phone showing the Home screen with the "Next Up" card and a live countdown that really ticks ("Starts in 24 minutes").
On iPhone/iPad visitors: replace the button with "GBU One is Android only for now." plus a link to the FAQ answer.

### 3. Where things were (problem, short)
Plain background. Left: a list in the students' own words, struck through one by one only when scrolled into view (single motion moment is the school picker, so this stays static: show the list, no animation).
- Room changes pinned on a department notice board
- Date sheets forwarded in five WhatsApp groups
- Last year's paper in someone's Drive, if you know who
Right or below: "GBU One puts all of it in your pocket, and keeps it there when the network drops."

### 4. Timetable and alarms
Headline: **Your week, even in the basement.**
Text: Open the app in a lab with no signal and your full timetable is still there. Each class shows the room, faculty and type. If a room changes you get an amber note, like "Shifted from SOICT-012 to SOICT-018". Tap the bell and the app reminds you 10 minutes before class.
Visual: phone with the Timetable screen showing a shifted-room badge.

### 5. Notices
Headline: **Circulars, without the scroll.**
Text: Filter by your school. Search any word in a circular. Urgent ones stay pinned at the top in red. Download a PDF once and read it offline.
Visual: a full-width list (not a phone) of 4 realistic notice rows with category tags and one pinned urgent row. Use plausible sample text, mark as "sample" in alt text only.

### 6. Past year papers
Headline: **841+ subjects of past papers.**
Text: Filter by exam type, year, school and programme. Open the PDF inside the app. Missing one? Upload it, no account needed. Once an admin approves it you earn 50 points.
Sub-block, leaderboard: "The exam cell starts at 1,000 points. Get 21 papers approved and you take the top spot." Show the podium (gold, silver, bronze crowns) as a simple CSS graphic using avatars.

### 7. Facts band (solid navy, not gradient)
Four plain numbers with plain labels: 841+ subjects · 8 schools · 19 avatars · 10 min alarm before class. Nothing invented.

### 8. Pick your school (the memorable moment)
Headline: **Pick your school. Pick your face.**
Text: 19 avatars across all 8 schools. Tap a school and see how your profile looks.
Interaction: row of 8 school chips. Selecting one swaps the avatar in a phone Profile screen and recolours the phone and the section background to that school's accent (see tokens). Includes the student ID like GBU-7ZZI6R, with a Copy button that really copies.
Under it: small grid of all 19 avatars (from `avatars_grid.png` or inline SVG).

### 9. Privacy and guest mode
Headline: **No sign-up. No university password.**
Text: Use the full app as a guest. The app gives you an ID like GBU-78A4B2 and keeps your uploads and points against it. Create an account later and everything moves across, nothing is lost. GBU One never asks for your university password. Webmail opens in its own window.
Layout: two short columns, text only, with a small diagram of Guest → Account (arrow, one line).

### 10. Install (this is the only numbered section, it is a real sequence)
Headline: **How to install**
1. Tap Download for Android. Your phone may warn you about APK files. That is normal outside the Play Store.
2. Open the file and allow "Install unknown apps" for your browser when asked.
3. Open GBU One, pick your school, semester and section.
Below: Checksum box: "SHA-256: {{SHA256}}" with Copy button and one line explaining how to verify. Version and last updated date. "The app tells you when a new version is out."

### 11. FAQ (native details/summary, no JS)
- Is this the official GBU app? {{OFFICIAL_ANSWER}}
- Does it cost anything? No.
- Does it need internet? Only to fetch updates. Timetable, saved notices and papers you opened work offline.
- Is it safe? It never asks for your university password. Admin tools are not in the student app. The APK checksum is above.
- Why isn't it on the Play Store? {{WHY_APK}}
- Is there an iPhone version? {{IOS_ANSWER}}
- I found a wrong room or notice. Who do I tell? {{CONTACT}}

### 12. Closing CTA
Plain solid band. One line: "Next class in 24 minutes. Know where it is." Button: Download for Android.

### 13. Footer
Logo, "GBU One", short line: Made for students of Gautam Buddha University, Greater Noida. Links: Install, FAQ, Privacy, Contact. Built by {{BUILT_BY}}. `<!-- OfficialSeal slot: reserved for the official university vector supplied by administration. Do not draw. -->` Disclaimer line from `07_APP_FACTS.md`.

## Wireframes

Desktop hero:
```
[logo GBU One]  Features Install FAQ                     [Download]
------------------------------------------------------------------
 Know where your next            ┌──────────┐
 class is.                       │ phone    │
 Timetable, notices ...          │ Next Up  │
 [Download for Android]          │ 24 min   │
 Free · v1.0.0 · No sign-up      └──────────┘
```

Phone hero (360px):
```
[logo]                    [Download]
Know where your next class is.
Timetable, notices, exam dates...
[ Download for Android ]
Free · v1.0.0 · No sign-up
      ┌────────────┐
      │ phone      │
      └────────────┘
```
Sticky bottom bar on phones after the hero scrolls away: "GBU One · Download".

## Alignment
Everything left-aligned. Feature rows alternate phone side (left, right, left). Facts band and closing CTA are the only centred blocks.
