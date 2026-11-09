# MASTER PROMPT (paste everything below this line into your AI, attach logo + screenshots)

---

You are the design lead and front-end developer for GBU One, a student app for Gautam Buddha University (GBU), Greater Noida. Build its marketing landing page. Output one complete `index.html` file (HTML, CSS and JS inline, no frameworks, no libraries). The page must work on a phone first.

## Goal
A student on an Android phone lands on this page, understands in five seconds what GBU One does, and downloads the APK. Secondary visitors (desktop, iPhone) get honest information.

## Reference
The Gem app landing page has a calm hero, one phone mockup, alternating feature rows and a closing download band. Keep that calm and rhythm. Do not copy its stock photos, numbered 01/02/03 labels, floating shapes, gradient bands or essay block. Make it more specific and more useful than Gem.

## Process
1. First write a design plan in under 15 lines: palette, type, layout concept, the one memorable moment. Check it against this brief and against generic AI landing pages (cream background with serif and terracotta, dark with neon accent, three identical cards, gradient decoration). Fix anything generic, say what you changed in one line.
2. Then output the full `index.html`. No placeholders for code. Placeholders only where the brief says `{{LIKE_THIS}}`, collected in a CONFIG object.

## Brand tokens (use as CSS variables)
- Backgrounds: `--bg #FAFAF8`, `--bg-alt #F5F5F0`, `--surface #FFFFFF`, `--line #EAEAEA`
- Text: `--ink #0F172A`, `--ink-2 #475569`, `--ink-3 #94A3B8` (captions only)
- Brand: `--navy #1E3A8A`, `--gold #D97706` (buttons and icons), `--gold-text #B45309` (gold as text on light), `--saffron #F59E0B` (gold on navy), `--green #059669`, `--brick #C2410C` (urgent only)
- Dark sections use `#0F172A` with `#F8FAFC` text. Never pure black.
- Navy and off-white dominate. Gold is the accent: primary button and the rank-1 crown. Do not spread every colour evenly.
- School accents: SOICT `#06B6D4`/`#1E1B4B`, SOE `#F59E0B`/`#7C2D12`, SOBT `#10B981`/`#064E3B`, SOM `#3B82F6`/`#172554`, SOLJG `#8B5CF6`/`#3B0764`, SOHSS `#EC4899`/`#831843`, SOVSAS `#0284C7`/`#0C4A6E`, Administration `#EAB308`/`#451A03`.
- Fonts: Poppins 600/700 for headings (letter-spacing -0.02em, line-height 1.1), Inter 400/500 for body (line-height 1.6). Google Fonts, `display=swap`, fallbacks `system-ui, sans-serif`.
- Type sizes with clamp: hero 40px to 72px, section heading 30px to 48px, body 16px to 18px. Body line length 60 to 70 characters. Left-align everything except the facts band and closing CTA.
- Radius: 12px small, 20px cards, 28px phone screens, full for avatars. Cards use a 1px border and no shadow. Only phones get a soft shadow.
- Logo: use the attached `assets/logo.svg`. Never draw or imitate the official university seal. In the footer leave only an HTML comment: `<!-- OfficialSeal slot: reserved for the official university vector -->`.

## Voice
Plain, specific, sentence case, like a senior who knows the campus. No exclamation marks. Banned words: seamless, empower, revolutionise, unlock, journey, elevate, cutting-edge, next-level. No ALL-CAPS labels above headings. No single highlighted word in a headline. No arrows appended to button text.

## Sections in order
1. **Header**: logo and "GBU One", links Features, Install, FAQ, gold Download button. On phones: logo left, Download right, no hamburger.
2. **Hero**: h1 "Know where your next class is." Sub: "Timetable, notices, exam dates and past papers for Gautam Buddha University, in one app that works without internet." Button "Download for Android". Under it: "Free. Version {{VERSION}} · {{APK_SIZE}} · No sign-up needed". Text link "See how it works". One phone mockup showing the Home screen with a "Next Up" class card whose countdown really ticks ("Starts in 24 minutes" then counting down, looping).
3. **Where things were**: three plain lines: "Room changes pinned on a department notice board", "Date sheets forwarded in five WhatsApp groups", "Last year's paper in someone's Drive, if you know who". Then: "GBU One puts all of it in your pocket, and keeps it there when the network drops."
4. **Timetable and alarms**: h2 "Your week, even in the basement." Text: offline timetable, room, faculty and type on each class, amber note "Shifted from SOICT-012 to SOICT-018", bell sets a reminder 10 minutes before class. Phone with Timetable screen.
5. **Notices**: h2 "Circulars, without the scroll." Filter by school, search any word, urgent ones pinned in red (`--brick`), PDFs readable offline. Visual: a full-width list of four sample notice rows with category tags, not a phone.
6. **Past year papers**: h2 "841+ subjects of past papers." Filter by exam type, year, school, programme. Open PDFs in the app. Upload a missing one, no account needed, earn 50 points when approved. Below it a CSS podium (gold, silver, bronze crowns, avatars) with the line "The exam cell starts at 1,000 points. Get 21 papers approved and you take the top spot."
7. **Facts band**: solid `#0F172A`, centred, four numbers: 841+ subjects, 8 schools, 19 avatars, 10 min reminder before class. No gradient.
8. **Pick your school (the memorable moment)**: h2 "Pick your school. Pick your face." Eight school chips in a scroll-snap row. Selecting one swaps the avatar on a phone Profile screen and transitions `--accent` and this section's background to the school's colours over 250ms. Profile shows a student ID like GBU-7ZZI6R with a working Copy button. Below, a grid of all 19 avatars (use `assets/avatars-grid.webp`, or draw simple inline-SVG busts if absent). This is the only decorative motion on the page.
9. **Privacy and guest mode**: h2 "No sign-up. No university password." Two short text columns: guest mode with ID like GBU-78A4B2 and automatic transfer to an account later with nothing lost; the app never asks for the university password, webmail opens in its own window. A one-line Guest → Account diagram in inline SVG.
10. **Install**: h2 "How to install". This is the only numbered list (it is a real sequence): 1 Tap Download for Android, your phone may warn about APK files, that is normal outside the Play Store. 2 Open the file and allow "Install unknown apps" for your browser. 3 Open GBU One and pick your school, semester and section. Then a checksum box "SHA-256: {{SHA256}}" with Copy button and one line on how to verify. Add version and "the app tells you when a new version is out".
11. **FAQ** using `<details>`: Is this the official GBU app? ({{OFFICIAL_ANSWER}}) Does it cost anything? (No.) Does it need internet? (Only for updates and fetching new items. Timetable, saved notices and opened papers work offline.) Is it safe? (Never asks for your university password, admin tools are not in the student app, checksum is above.) Why isn't it on the Play Store? ({{WHY_APK}}) Is there an iPhone version? ({{IOS_ANSWER}}) Found a wrong room or notice? ({{CONTACT}})
12. **Closing CTA**: solid band (navy, not gradient). "Next class in 24 minutes. Know where it is." and the download button.
13. **Footer**: logo, "Made for students of Gautam Buddha University, Greater Noida.", links Install, FAQ, Privacy, Contact, "Built by {{BUILT_BY}}", the seal comment, and a disclaimer line {{DISCLAIMER}}.

Vary section layouts: phone plus text (alternating sides), a full-width notices list, the podium, the facts band, the interactive picker, two text columns, the install steps. Do NOT make rows of three identical cards.

## Phone mockups
Draw frames in CSS (10px bezel, 28px radius, small notch, soft shadow). Fill with the attached screenshots (`assets/shot-home.webp`, `shot-timetable.webp`, `shot-notices.webp`, `shot-pyq.webp`, `shot-leaderboard.webp`, `shot-profile.webp`). If a screenshot is missing, build that screen in HTML and CSS using the app's light card style (white cards, 1px border, Poppins titles, gold and navy accents). Explicit width and height on all images, WebP, lazy-load except the hero phone.

## Behaviour
```js
const CONFIG = { apkUrl:"{{APK_URL}}", version:"{{VERSION}}", apkSize:"{{APK_SIZE}}", sha256:"{{SHA256}}", iosAvailable:false, contactEmail:"{{CONTACT}}" };
```
- All download buttons, version text and checksum read from CONFIG.
- Android user agent: show Download. iOS user agent and `iosAvailable` false: replace the button with "GBU One is Android only for now." Desktop: show Download plus "Copy link to open on your phone".
- Sticky bottom bar on phones ("GBU One" and Download, 64px, safe-area padding), hidden while the hero button is visible (IntersectionObserver).
- Copy buttons use `navigator.clipboard` with a fallback and show "Copied" for 1.5s.
- Motion: only the hero countdown and the school picker transition, plus 120ms button press feedback. No scroll animations, no parallax, no floating shapes. Respect `prefers-reduced-motion`.

## Mobile and quality
- Design at 360px first, test 360/390/768/1024/1440. No horizontal scroll ever. Wide content scrolls in its own container.
- `viewport-fit=cover`, safe-area insets, `100svh` not `100vh`, 44px minimum tap targets.
- Under 60 KB before images. Inline SVG icons. No icon or animation libraries.
- AA contrast (gold text on light is `#B45309`), visible 3px navy focus ring, skip link, one h1, real buttons and links, descriptive alt text, works at 200% zoom.
- SEO: title "GBU One – timetable, notices and past papers for GBU students", meta description under 155 chars, Open Graph and Twitter tags (`assets/og.png`), JSON-LD SoftwareApplication (Android, price 0, EducationalApplication), SVG favicon, `theme-color #0F172A`, `lang="en"`. No tracking scripts.

## Honesty rules
Claim only: 841+ subjects, 8 schools, 19 avatars, reminders 10 minutes before class, 50 points per approved paper, the 1,000-point exam cell start, offline use, guest mode, no university password. Never invent user counts, testimonials, ratings, press quotes or awards. Never claim Play Store, App Store or iPhone availability. Never say the app is official unless `{{OFFICIAL_ANSWER}}` says so.

## Final check before answering
Re-read your output against: no stock photos, no decoration without meaning, no identical-card rows, no banned words, no horizontal scroll at 360px, every claim in the honesty list. Then give the file.
