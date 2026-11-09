# Assets and checklist

## Export from the app before generating

| Asset | How to get it | File name |
|---|---|---|
| GBU One logo mark (SVG) | Render `src/components/brand/Logo.tsx` to SVG. Square, transparent background. | `assets/logo.svg` |
| Real screenshots, 6 of them | Run the app on a phone in light theme. Capture: Home with Next Up, Timetable with a shifted room, Notices with an urgent pin, PYQ list, Leaderboard podium, Profile. Remove personal data. | `assets/shot-home.webp`, `shot-timetable.webp`, `shot-notices.webp`, `shot-pyq.webp`, `shot-leaderboard.webp`, `shot-profile.webp` |
| Avatar grid | `python tools/render_avatars_to_png.py` produces `avatars_grid.png` and 512px PNGs for all 19. Convert to WebP. | `assets/avatars-grid.webp`, `assets/avatar-<id>.webp` |
| APK link | GitHub Releases URL for the release APK | goes in `CONFIG.apkUrl` |
| SHA-256 of the APK | `sha256sum gbu-one.apk` (Linux/Mac) or `certutil -hashfile gbu-one.apk SHA256` (Windows) | goes in `CONFIG.sha256` |
| OG image 1200x630 | Navy background, logo, hero phone | `assets/og.png` |

Screenshot tips: 1080x2340 or similar, crop out the status bar, export WebP at about 80% quality, keep each under 120 KB.

If you have no screenshots yet, tell the AI "build the phone screens in HTML and CSS" and it will, using the app's card style. Replace with real screenshots later.

## Fill these placeholders

`{{VERSION}}` `{{APK_SIZE}}` `{{APK_URL}}` `{{SHA256}}` `{{CONTACT}}` `{{BUILT_BY}}` `{{OFFICIAL_ANSWER}}` `{{WHY_APK}}` `{{IOS_ANSWER}}`

## Before publishing

- [ ] Replace the 250 MB debug APK with a release build (split by ABI). Large downloads on campus data kill conversion.
- [ ] Sign the release APK and keep the keystore private. Never put keys or `.env` values on the page.
- [ ] Host free: GitHub Pages, Netlify or Cloudflare Pages. Add a custom domain later.
- [ ] Open the page on a real Android phone over mobile data.
- [ ] Share the link in one student group and ask what confused them.

## Suggested folder layout
```
site/
  index.html
  assets/
    logo.svg
    og.png
    shot-*.webp
    avatars-grid.webp
    favicon.svg
```
