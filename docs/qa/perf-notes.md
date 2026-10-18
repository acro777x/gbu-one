# Performance and Animation Quality Notes — GBU One

## Target Environment
- **Device Profile**: Android 14 / Emulator-5554 / Low-to-Mid range ARM64 device
- **Target Frame Rate**: 60 fps continuous UI thread performance
- **Cold Start Budget**: ≤ 2.3 seconds to first interactive screen

## Architecture & Worklet Profiling
1. **Zero JS-Thread Animation Loops**:
   - All animated interpolations (`markScale`, `ribbonAProgress`, `ribbonBProgress`, `glowOpacity`, `domeTranslateY`, `numeralScale`, `ringRotation`) run entirely as native worklets on the UI thread via `react-native-reanimated` 3.
   - No React state recalculations occur per frame during vector draws, breathing loops, or carousel transitions.

2. **Logo Stroke-Draw & Vector Optimization**:
   - Vector paths simplified from source raster to 4 clean closed paths (`ribbonA`, `ribbonB`, `domeFinial`, `numeralOne`).
   - `strokeDasharray` and `strokeDashoffset` props driven via `useAnimatedProps` without full SVG DOM re-renders.
   - Glow layer computed as a decoupled hardware-accelerated layer (`elevation: 15`, `shadowOpacity: 0.8`), eliminating heavy canvas blur operations on low-end chipsets.

3. **Cold Start & Splash Handoff**:
   - Native splash screen (`expo-splash-screen`) maintained until Google Fonts (`Poppins-Bold`, `Inter`) and local SQLite/MMKV hydration complete.
   - Handoff from native splash to JS splash is seamless (zero visual flash or layout shift).
   - Splash choreography total duration capped at 2.25s, with immediate tap-to-skip enabling bypass for power users.
   - Returning user / warm-start branch reduces to a ≤ 700ms mark fade or skips directly to cached Home.

4. **Offline First UI Responsiveness**:
   - Home, Timetable, and Notices render immediately from local cache upon mounting.
   - Background re-fetch happens via TanStack Query without blocking touch events or navigation.
