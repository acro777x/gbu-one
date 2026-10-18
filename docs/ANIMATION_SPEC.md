# Animation Spec — GBU One

The logo is **final** (see `docs/LOGO_BRIEF.md`). Build the vector assets from the approved images, then the animation system on top of them.

## Libraries
- `react-native-reanimated` 3 (worklets, UI thread, 60fps) — primary
- `react-native-svg` — logo stroke-draw and masks
- `@shopify/react-native-skia` — optional, for glow/blur/gradient shimmer if Reanimated alone can't hit quality or perf
- `expo-haptics` — light taps at key moments
- `lottie-react-native` — ONLY if the owner later supplies a Lottie file; do not hand-roll Lottie
- `expo-splash-screen` — native splash handoff

## Logo assets (final logo, see `docs/LOGO_BRIEF.md`)
The logo is finalized. Source images are in `assets/brand/source/`. Follow `LOGO_BRIEF.md` to build:
```
assets/brand/gbu-one-mark.svg         mark only (ring ribbon A, ring ribbon B, dome+finial, numeral "1"), no glow, no tile, no text
assets/brand/gbu-one-mark-mono.svg    single colour
assets/brand/icon-1024.png            app icon (mark only)
src/components/brand/logoPaths.ts     each path's d + measured length
```
- `LogoMark.tsx` renders the traced SVG; `AnimatedLogo.tsx` drives it with props (`progress`, `glow`, `ringRotation`).
- The wordmark is **live text in Poppins Bold**: "GBU" ivory `#F8F8F6`, "One" orange `#FF6A2B`.
- The glow is a **separate radial layer** (orange `#FF6A2B`, low opacity) drawn in code, so it can pulse. Never use a baked-in glow.
- **Raster fallback** (only if the traced SVG can't pass the overlay check): animate the approved raster mark with a circular reveal mask for the ring, a rise-and-fade for the dome, scale for the "1", plus the code glow. Record the reason in `OPEN_QUESTIONS.md`.

## Logo-specific motion (final mark)
Order of reveal, with the same timings as the splash table below:
1. **Ring:** ribbon A and ribbon B stroke-draw in opposite directions around the centre (staggered 120 ms), ending as the twisted ring; the ring gradient fades from deep orange to amber as it completes. A soft glow ramps up around it.
2. **Dome:** the dome and finial rise from the bottom of the ring (translateY 14 px → 0, scale 0.9 → 1) with a spring, finial last; a tiny sparkle on the finial tip (single frame flash, no flicker).
3. **Numeral "1":** scales in from the centre (0.85 → 1, spring.snappy) and fills ivory, with a light haptic as it lands.
4. **Settle:** a single soft ripple (ring outline expanding and fading, 600 ms) and the glow settles to a gentle breathing loop.
5. **Wordmark and tagline** follow as in the splash table.
- **Loading state:** the ring slowly rotates (one revolution about 6 s, ribbons counter-rotating slightly) while the "1" breathes; the glow pulses with it. Use the ring as the app's progress/spinner motif (pull-to-refresh, bootstrap).

## Motion tokens (`src/lib/motion.ts`)
| Token | Value |
|---|---|
| duration.xs / sm / md / lg / xl | 120 / 200 / 320 / 600 / 1000 ms |
| easing.out | cubic-bezier(0.22, 1, 0.36, 1) |
| easing.inOut | cubic-bezier(0.65, 0, 0.35, 1) |
| spring.soft | damping 18, stiffness 180, mass 1 |
| spring.snappy | damping 20, stiffness 320 |
| stagger.letter / word | 28 / 70 ms |

## 1. Splash and logo animation
Cold start, total about 2.2s. Native splash shows the same background colour and a static logo frame, then hands off to JS with no visible jump (hold the native splash until fonts, cache and the animation's first frame are ready).

| Time | What happens |
|---|---|
| 0–250 ms | Background `#0B0B0C` steady. Faint radial accent glow fades in behind centre (opacity 0 → 0.35). |
| 250–1100 ms | **Logo draw:** mark paths stroke-draw (strokeDashoffset to 0, staggered per path, easing.out), then fill fades in and the mark does a spring scale 0.92 → 1. Light haptic when the fill lands. |
| 1000–1500 ms | **Wordmark "GBU One"** appears under the mark with per-letter rise + blur-to-sharp mask reveal (stagger.letter). A light shimmer sweep passes once across the wordmark. |
| 1500–2000 ms | **Tagline typewriter:** "Everything GBU. One app." with a blinking caret, then the caret fades. |
| 2000–2300 ms | **Handoff:** mark and wordmark shrink and move toward the Home header position (shared-element feel) while the splash fades into the app; Home content staggers in from below (60 ms stagger, 20px rise + fade). |

Rules:
- Warm start / returning within 1 hour: short version (mark scale-in + fade, ≤ 700 ms) or skip.
- Never delay Home if data is ready; animation is capped at 2.3s total. Offer tap-to-skip.
- Reduce Motion: replace with a 250 ms crossfade of the static logo.

## 2. Loading screen and loading states
**App bootstrap (only when no cache exists yet, e.g. first launch):**
- Centre: logo mark with a "breathing" loop (scale 1 → 1.04, glow opacity 0.25 ↔ 0.5, 1.6s, easing.inOut).
- Below: a thin 2px progress line with a moving shimmer (indeterminate), accent colour.
- Status text cycles every 1.4s with a crossfade + small vertical slide: "Checking notices…", "Syncing your timetable…", "Finding your PYQs…", "Almost there…". Use `WordReveal` for each.
- If cache exists: skip this screen entirely and render Home from cache (offline-first).

**In-app loading:**
- Lists: skeletons with a diagonal shimmer sweep (1.2s loop).
- Pull-to-refresh: custom indicator where the logo mark rotates/pulses with pull distance and plays a small "stroke-fill" when refresh completes.
- Buttons: pill morphs (width shrink, radius stays) into a small spinner, then to a check on success.
- Image/hero: blur-up from a low-res placeholder (blurhash), 300 ms crossfade.

## 3. Text-writing animations (reusable components in `src/components/motion/`)
| Component | Effect | Use |
|---|---|---|
| `TypeWriter` | Characters type in with a blinking caret, optional delete/retype loop for rotating phrases | Splash tagline, login hero text, search placeholder |
| `WordReveal` | Words fade + rise 12px + blur 8 → 0, staggered | Onboarding headlines, empty states, loading status text, notice summary |
| `LetterRise` | Letters rise from a mask line with stagger | Logo wordmark, hero carousel titles, screen titles on first open |
| `ShimmerText` | Light gradient sweep across text (masked) | "New", "Live now", wordmark highlight, premium accents |
| `CountUp` | Numbers roll/count to value | Countdowns, attendance %, trending download counts |
| `ScrambleText` | Characters decode from random glyphs to final text | Use sparingly: onboarding slide 1 headline, "Result found" moment |

Common props: `text`, `delay`, `duration`, `stagger`, `once` (play only first time), `onDone`, `reduceMotion` (auto from OS). All run on the UI thread via worklets; no re-render per frame.

Where used (minimum):
- Onboarding: each slide headline `WordReveal`, subtext fades 200 ms later; slide 1 may use `ScrambleText` on the key word.
- Login: title `LetterRise`, subtitle `TypeWriter` on first open only.
- Home: hero carousel title `LetterRise` on slide change; next-class countdown `CountUp`.
- Empty states and error states: `WordReveal`.

## 4. Screen and component motion
- Floating bottom bar: capsule slides between tabs with spring.snappy; icon scale 1 → 1.12 → 1; haptic tick; glow follows the capsule.
- Screen transitions: shared fade-through with 12px vertical shift, 280 ms; no heavy slide animations.
- Cards: press scale 0.98 with 120 ms; list items stagger in on first load (40 ms stagger, cap at 8 items).
- Bottom sheets: spring open with backdrop blur ramp; drag-to-dismiss with velocity.
- Hero carousel: parallax image (0.2×), pill-dot indicator width animates 8 → 28.
- Toast pill ("Added 3 papers"): slides up with spring, auto-dismiss after 2.5s.

## Performance and quality
- Everything on the UI thread (worklets). No JS-thread animation loops.
- Target 60fps on a mid-range Android (test on a real low-end device or throttled emulator); animations must not drop frames while data loads.
- Total added bundle for animation code: keep modest; lazy-load Skia only if used.
- Cold start to first interactive screen must not regress because of the splash (animation is parallel with hydration, capped at 2.3s).

## Accessibility
- Respect OS "Reduce Motion": swap motion for short fades; typewriter/scramble show the final text immediately.
- Screen readers get the full final text instantly (`accessibilityLabel` = complete string); never read partial characters.
- No flashing above 3 times per second.
- Haptics only on key moments; honour system haptic settings.

## Acceptance checklist
- [ ] Splash plays as specified with the final traced mark; overlay check against the approved image passes (`docs/qa/logo-overlay.png`)
- [ ] Native splash → JS splash handoff has no flash or jump (Android and iOS)
- [ ] Bootstrap loading screen with cycling text, skipped when cache exists
- [ ] All six text components built, previewed on a hidden `/dev/motion` playground screen with sliders for speed
- [ ] Reduce Motion path verified
- [ ] Screen recordings of splash, loading, onboarding and tab bar saved in `docs/qa/` and compared to the feel of `signal-bloom.png` and Nuvio
- [ ] Frame-rate check noted in `docs/qa/perf-notes.md`
