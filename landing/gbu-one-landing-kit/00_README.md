# GBU One Landing Page Kit

Everything needed to get a landing page for GBU One built in one shot by an AI (Claude, ChatGPT, Gemini, Cursor, anything that can write code).

## Fastest way (5 minutes)

1. Open `05_ASSETS_AND_CHECKLIST.md` and export the 4 things the page needs from your app (logo SVG, 4 to 6 real screenshots, avatar grid, APK link).
2. Open a new chat with your AI.
3. Paste the full contents of `06_MASTER_PROMPT.md`.
4. Attach the logo and screenshots. Send.
5. You get one `index.html` plus an `assets/` folder structure. Drop your files in, host it free on GitHub Pages, Netlify or Cloudflare Pages.

If the AI cuts the answer short, send: "Continue from where you stopped, output the rest of index.html only."

## What each file is for

| File | Use it when |
|---|---|
| `01_RESEARCH_AND_REFERENCE_ANALYSIS.md` | You want to know why the Gem page works and where it can be beaten |
| `02_BRAND_AND_DESIGN_SYSTEM.md` | You need exact colours, fonts, spacing, radii |
| `03_PAGE_STRUCTURE_AND_COPY.md` | You want to edit the words or reorder sections |
| `04_INTERACTIONS_AND_MOBILE_RULES.md` | You want to check phone behaviour, motion and accessibility |
| `05_ASSETS_AND_CHECKLIST.md` | Before you generate, and before you publish |
| `06_MASTER_PROMPT.md` | The one thing you paste into the AI |
| `07_APP_FACTS.md` | Source of truth. What the page may and may not claim |
| `08_FOLLOWUP_PROMPTS.md` | Fixing or polishing after the first build |

## Things to decide before you generate

- Distribution is an Android APK. There is no App Store or Play Store link, so the page is built around a direct APK download. Say so honestly on the page.
- Your spec lists iOS 16 to 18 as a target. If there is no iOS build yet, keep `iosAvailable = false` in the master prompt.
- Your debug APK is about 250 MB. A release build with split ABIs is much smaller and will convert far better. Fix this before launch.
- Confirm whether the app is officially endorsed by GBU. The footer disclaimer depends on it (see `07_APP_FACTS.md`).
