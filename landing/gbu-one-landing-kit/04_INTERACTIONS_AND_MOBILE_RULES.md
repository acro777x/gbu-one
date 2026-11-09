# Interactions, mobile and quality rules

## Mobile first
- Design at 360px width first. Test 360, 390, 414, 768, 1024, 1440.
- No horizontal scroll at any width. Wide content (tables, school chips) scrolls inside its own `overflow-x: auto` container.
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- Respect notches: `padding-bottom: env(safe-area-inset-bottom)` on the sticky bar.
- Sticky bottom download bar on phones, hidden while the hero button is on screen (IntersectionObserver). Height 64px, button 48px.
- Tap targets 44px minimum. Chip rows are scrollable with scroll-snap.
- Use `100svh`, not `100vh`, for anything full-height.
- Phones in sections stack below text on mobile and are capped at 280px wide.

## Performance (campus networks are slow)
- One HTML file, CSS and JS inline. Target under 60 KB before images.
- Images: WebP, 2x max, `loading="lazy"` except the hero phone (`fetchpriority="high"`), explicit width and height to avoid layout shift.
- Fonts: preconnect to Google Fonts, `display=swap`, 4 weights total.
- No JS framework, no animation library, no icon library. Icons are inline SVG.
- Target Lighthouse mobile: Performance 90+, Accessibility 100, SEO 100.

## Motion (use very little)
- Hero countdown ticks every second. That is real, and it is the point.
- School picker: on selection, transition `--accent` and the avatar swap over 250ms. This is the one showpiece.
- Buttons: 120ms press feedback. Nothing else animates on scroll. No fade-ups, no parallax, no floating shapes.
- Respect `prefers-reduced-motion: reduce`: no transitions, countdown still updates.

## Interactions list
1. Hero countdown: computed from a fixed example time relative to now so it always reads "Starts in 24 minutes" and counts down, then loops.
2. Android detection: `navigator.userAgent` includes Android shows Download. iOS shows the Android-only note. Desktop shows Download plus a "send link to my phone" copy-link button.
3. School picker described in `03_PAGE_STRUCTURE_AND_COPY.md` section 8.
4. Copy buttons (student ID and SHA-256) use `navigator.clipboard` with a fallback and change label to "Copied" for 1.5 seconds.
5. Sticky download bar on phones.
6. FAQ via `<details>`.

## Config block at the top of the script
```js
const CONFIG = {
  apkUrl: "{{APK_URL}}",
  version: "{{VERSION}}",
  apkSize: "{{APK_SIZE}}",
  sha256: "{{SHA256}}",
  iosAvailable: false,
  contactEmail: "{{CONTACT}}"
};
```
All download buttons, version text and checksum read from here, so updating a release means editing one block.

## Accessibility
- Colour contrast AA minimum. Gold text on light uses `--gold-text` (#B45309).
- Visible focus ring: 3px `--navy` outline with 2px offset on all interactive elements.
- Real `<button>`, `<a>`, `<details>`. Headings in order (one h1).
- Alt text on every screenshot describing the screen, not "screenshot".
- Skip link to main content.
- Works with text zoom to 200%.

## SEO and sharing
- Title: `GBU One – timetable, notices and past papers for GBU students`
- Meta description under 155 characters.
- Open Graph and Twitter card tags with a 1200x630 image (logo plus hero phone on navy).
- JSON-LD `SoftwareApplication` (operatingSystem Android, price 0, applicationCategory EducationalApplication).
- Favicon from the logo mark (SVG plus 180px PNG). Theme colour `#0F172A`.
- `lang="en"`. Do not add any tracking scripts by default.

## Final QA checklist
- [ ] No horizontal scroll at 360px
- [ ] Download button works on Android Chrome and shows a sensible message on iOS
- [ ] Checksum matches the real APK
- [ ] Every claim is in `07_APP_FACTS.md`
- [ ] No stock photos, no invented testimonials or user counts
- [ ] No official seal drawn
- [ ] Tab through the page with keyboard only
- [ ] Reduced motion tested
