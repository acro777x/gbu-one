# Nuvio Mobile & Design Reference Notes

## Visual Analysis of Reference Materials
- **`signal-bloom.png`**:
  - Floating capsule bottom bar detached from screen edges with 16pt margin and 32pt pill corner radius.
  - Dark translucent frosted glass background (`rgba(22, 22, 24, 0.75)` / `rgba(255, 255, 255, 0.08)`) with 24pt backdrop blur and subtle border highlight (`rgba(255, 255, 255, 0.12)`).
  - Selected tab indicator: subtle glowing capsule behind active icon + label with warm accent glow underneath.
  - Full-bleed hero carousel at top with gradient mask and elongated pill page indicators (8px inactive -> 28px active).
- **`adverse-casino.png`**:
  - Dark frosted glass card hierarchy with 24pt corner radius.
  - Squircle avatars (18pt squircle curvature).
  - Clean typographic hierarchy with high contrast ivory `#F8F8F6` primary text and muted secondary `#A8A29E`.
- **`n99-beauty.png`**:
  - Warm cream/ivory bottom sheets with 32pt top corner radius.
  - Removable filter chips (999pt pill radius) with active state highlights.
  - Selection toast pill floating above navigation bar ("Added X items").

## Key Learnings from Nuvio Navigation Architecture
1. **Floating Pill Layout**:
   - The bar floats above the content with explicit safe area bottom inset + vertical offset.
   - Content scrolls freely underneath the bar; screen containers require `contentContainerStyle` padding bottom (approx. 96-104pt) so bottom items are never obscured.
2. **Tab Capsule Animation**:
   - Instead of static per-tab toggling, an active pill indicator smoothly translates across tabs using spring physics (`spring.snappy`: stiffness ~320, damping ~20).
   - Icons scale slightly (1.0 -> 1.12 -> 1.0) on selection accompanied by a light haptic tick.
3. **Reactive Glow**:
   - A soft radial orange accent glow (`#FF6A2B` at 0.15-0.25 opacity) sits behind the active tab capsule, moving smoothly with the capsule.
4. **Clean Profile Avatar Slot**:
   - The 5th tab ("Profile") renders the user's avatar squircle directly within the tab item rather than a generic icon, providing a personal touch.
