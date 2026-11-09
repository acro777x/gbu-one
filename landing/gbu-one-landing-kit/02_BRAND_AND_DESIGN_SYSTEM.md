# Brand and design system

Taken from the app's own tokens so the page and the app look like the same product. Confirm hex values against `src/theme` in the app before launch.

## Colour

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#FAFAF8` | Page background (same as the app) |
| `--bg-alt` | `#F5F5F0` | Alternate section background |
| `--surface` | `#FFFFFF` | Cards, phone screens |
| `--line` | `#EAEAEA` | Borders |
| `--ink` | `#0F172A` | Primary text, navy band background |
| `--ink-2` | `#475569` | Secondary text |
| `--ink-3` | `#94A3B8` | Captions only, never body text (fails contrast) |
| `--navy` | `#1E3A8A` | Links, highlights, secondary buttons |
| `--gold` | `#D97706` | Brand accent: primary button, icons, rank 1 |
| `--gold-text` | `#B45309` | Gold used as TEXT on light backgrounds (passes AA) |
| `--saffron` | `#F59E0B` | Gold on dark navy backgrounds |
| `--green` | `#059669` | "Offline ready", success |
| `--brick` | `#C2410C` | Urgent notice and room-shift emphasis, used rarely |

Dark sections use `--ink` (#0F172A) with `#F8FAFC` text. Do not use pure black.

Dominant colour: navy and warm off-white. Gold is the accent, used for the main button and the rank-1 crown only. Do not spread all six colours around the page evenly.

### School accents (for the interactive school picker)

| School | Accent | Deep |
|---|---|---|
| SOICT | `#06B6D4` | `#1E1B4B` |
| SOE | `#F59E0B` | `#7C2D12` |
| SOBT | `#10B981` | `#064E3B` |
| SOM | `#3B82F6` | `#172554` |
| SOLJG | `#8B5CF6` | `#3B0764` |
| SOHSS | `#EC4899` | `#831843` |
| SOVSAS | `#0284C7` | `#0C4A6E` |
| Administration | `#EAB308` | `#451A03` |

## Type

- Headings: Poppins SemiBold (600) and Bold (700), letter-spacing `-0.02em`, line-height 1.1 to 1.15
- Body: Inter 400 and 500, line-height 1.6
- Both are the app's fonts. Load from Google Fonts with `display=swap`, only weights 400, 500, 600, 700. Provide fallbacks: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.

Scale (fluid, using clamp):

| Role | Mobile | Desktop |
|---|---|---|
| Hero headline | 40px | 72px |
| Section headline | 30px | 48px |
| Sub-headline | 20px | 26px |
| Body | 16px | 18px |
| Caption | 13px | 14px |

Line length: 60 to 70 characters for body copy. Left-aligned everywhere. Do not centre paragraphs.

## Shape and space

- Spacing unit 8px. Section padding 72px mobile, 128px desktop.
- Max content width 1120px, side padding 20px mobile, 32px desktop.
- Radius: 12px for small elements, 20px for cards, 28px for phone screens, full for avatars and pills. Do not use one radius for everything.
- Shadows: only on phones (soft, large, low opacity). Cards use a 1px `--line` border, no shadow.
- Min touch target 44 x 44px.

## Logo rules

- Use the GBU One mark exported from `src/components/brand/Logo.tsx` as SVG. Do not redraw it.
- Do NOT draw, simulate or approximate the official Gautam Buddha University seal. Leave an empty, commented slot for it in the footer.
- Clear space around the logo equals the height of the flame in the mark.
- Header: mark plus "GBU One" wordmark in Poppins 600.

## Phone mockups

- Draw the frame in CSS (rounded rectangle, 10px bezel, small notch). No stock device images.
- Screen content is real screenshots (WebP, 2x). If none are supplied, build the screens in HTML and CSS using the app's card style so they stay crisp.
- Show the app in LIGHT theme (the app default). Show dark mode only once, in the offline or study section.
