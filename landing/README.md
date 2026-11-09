# GBU One — Official Landing Page

The official, responsive, light-first landing page for **GBU One** — the offline-first student companion app for Gautam Buddha University (GBU), Greater Noida.

## 📱 Overview

- **Single-page static website**: Built with semantic HTML5, modern CSS3 (custom properties, flexbox, CSS grid), and lightweight vanilla JavaScript.
- **Zero build step**: Runs directly in any browser with no dependencies or node modules required.
- **Light-First Editorial Design**: Warm cream background (`#FAFAF8`), crisp card surfaces (`#FFFFFF`), and refined typography (Poppins + Inter).
- **Interactive School Themes**: Live school chips for all 8 GBU academic schools (`SOICT`, `SOE`, `SOBT`, `SOM`, `SOLJG`, `SOHSS`, `SOVSAS`, `ADMIN`) with WCAG AAA contrast ratios.
- **19 Academic Avatars**: Interactive gallery showcasing bespoke campus personas.
- **App Feature Showcases**:
  - Timetable & Room Shift Alerts
  - Official University Circulars & Cached Notices
  - 841+ Past Year Question Papers (PYQ) & Contributor Podium
  - Examination Datesheets & Results Watchdog
  - Campus Life, Fests & Photo Memories Hub
- **Honest Platform Targeting**: Direct Android APK download with verified SHA-256 integrity hash and informational notice for iOS visitors.

---

## 🚀 Local Development & Preview

Serve the root directory with any local HTTP server:

```bash
# Using Python
python -m http.server 3333

# Or using Node
npx serve .
```

Open [http://localhost:3333](http://localhost:3333) in your browser.

---

## 📁 Repository Structure

```
.
├── index.html                  # Main landing page markup, styles, and logic
├── README.md                   # Repository guide and overview
├── assets/                     # Optimized visual assets, icons & mockups
│   ├── favicon.svg             # GBU One brand favicon
│   ├── logo.svg                # Vector brand mark
│   ├── apple-touch-icon.png    # iOS homescreen touch icon
│   ├── og.png                  # Open Graph social preview banner
│   ├── gbu-one-latest-release.apk # Production Android APK release binary
│   ├── shot-*.webp             # Real device mobile mockups (Home, Timetable, Notices, PYQ, Exams, Events, Profile)
│   └── avatar-*.webp           # 19 bespoke academic persona avatars
└── gbu-one-landing-kit/        # Brand guidelines, UI tokens & design specs
```

---

## 🌐 Deployment (GitHub Pages / Cloudflare Pages / Vercel)

This repository is ready for instant deployment on GitHub Pages:
1. Go to repository **Settings** → **Pages**.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Choose branch `main` and folder `/ (root)`.
4. Click **Save**. The website will be live in seconds.

---

## ⚖️ Disclaimer

GBU One is an independent, open-source student initiative created by scholars of Gautam Buddha University. It is not officially operated by Gautam Buddha University administration.
