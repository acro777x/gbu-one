# Logo Brief — GBU One (FINAL)

The logo is **finalized** by the owner. Do not redesign, recolour or "improve" it. Your job is to reproduce it faithfully as clean vector assets and animate it.

## Source files (in `assets/brand/source/`)
| File | What it is | Use |
|---|---|---|
| `gbu-one-final-sheet.png` | Original approved sheet (tile with glow on the left, flat transparent version on the right) | Reference of record; never edit |
| `logo-tile-with-glow.png` | Left half: clean, approved look with glow | **Visual ground truth** for tracing and for comparing your result |
| `logo-flat-raw-transparent.png` | Right half: flat version, background removed | **Do NOT ship.** It has jagged pixel artifacts from background removal (yellow speckles around the ring, dome and "1"). Use only as a shape hint |

## What the logo is
- **Mark:** an orange ring made of two overlapping ribbon curves (a twisted ring, not a plain circle), a small orange **dome with a finial** sitting at the top inside the ring, and a bold ivory **numeral "1"** centred in the ring, overlapping the dome's base. Reads as a sun or gateway behind the dome, with the "1" at the centre.
- **Wordmark:** "GBU One", bold geometric sans: **"GBU" in ivory, "One" in orange.**
- **Tile:** rounded-square near-black tile with a soft orange glow bleeding from the ring.
- No seal, no Buddha figure, no tagline. A clear empty area is kept under the wordmark for the official seal, which is added later.

## Colours (sampled from the approved image; approximate)
| Element | Value |
|---|---|
| Ring | gradient, deep orange `#E04F14` → orange `#FC6C1E` → amber `#FC9B22` (light catches the upper right) |
| Dome | orange `#FF6A2B` family, flat |
| Numeral "1" | ivory `#EFE7DB` (use the app token `#F8F8F6` for UI text) |
| Wordmark | "GBU" ivory `#F8F8F6`, "One" orange `#FF6A2B` |
| Background | near-black `#0A0A09` / `#0B0B0C` |
| Glow | orange `#FF6A2B` at low opacity, radial, drawn **as a separate layer in code** |
Brand UI tokens stay as in `UI_SPEC.md` (accent `#FF6A2B`, ivory `#F8F8F6`, black `#0B0B0C`).

## Typography (final)
- **Wordmark and display titles:** **Poppins Bold (700)**, tight tracking (about -1%). "GBU" ivory, "One" orange. Load via `@expo-google-fonts/poppins`.
- **App UI and body text:** **Inter** (Regular, Medium, SemiBold).
- Wordmark in the app is **live text in Poppins Bold** (not an image), so the text animations (`LetterRise`, `ShimmerText`) can drive it. The raster wordmark in the source sheet is only the visual reference.

## Build the vector (agent task)
The approved art is raster. Produce clean SVGs from it:
1. Trace `logo-tile-with-glow.png` (crop the mark area; remove tile and glow) using a vectoriser (e.g. `vtracer`, `potrace`) or by hand-building geometric paths, and simplify to **a few clean closed paths**: ring ribbon A, ring ribbon B, dome (+ finial), numeral "1". Keep ring gradient as an SVG `linearGradient` (3 stops above).
2. Output `assets/brand/gbu-one-mark.svg` (square viewBox, e.g. 0 0 512 512, mark only, no glow, no tile, no text) and `logoPaths.ts` with each path's `d` and measured length for stroke-draw.
3. **Overlay check:** render the SVG at 1024px over the approved tile image at 50% opacity and compare. Edges must align within about 2% of the mark width. Save the comparison to `docs/qa/logo-overlay.png`. If tracing can't reach that, ask the owner for help (add to `OPEN_QUESTIONS.md`) and in the meantime use the **raster fallback** described in `ANIMATION_SPEC.md`.
4. Generate: `gbu-one-mark-mono.svg` (single colour, for Android themed icon), `icon-1024.png` (iOS), Android adaptive foreground (432×432, mark inside the central 66% safe zone, transparent) and background (`#0B0B0C`), `splash-mark.png`, favicon 16/32 px.

## App icon rule
The **icon is the mark only** (ring + dome + "1"), without the wordmark. The tile sheet shows "GBU One" inside the tile, which is unreadable at icon sizes; the wordmark appears on the splash, login and About screens instead.

## Usage rules
- Minimum clear space around the mark: the width of the numeral "1".
- Minimum size: 16 px mark alone; wordmark lockup no smaller than 96 px wide.
- Do not stretch, rotate, recolour, add outlines or place on busy images. On light backgrounds use the mono version in `#0B0B0C`.
- The glow is a code layer (animated), never baked into shipped icon files.

## Official seal (pending)
The official GBU seal is **not part of the logo mark**. The owner will obtain the official vector from the university. Until then, reserve the slot (`<OfficialSeal />` component rendering nothing) on the splash (below the tagline), login footer and About. **Never redraw, AI-generate, recolour or crop the seal.**
