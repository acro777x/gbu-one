/**
 * The UI rules the project holds itself to.
 *
 * These are the checks that a code review cannot make reliably by eye:
 *
 *  1. Every animated component takes its motion setting from the OS, so a
 *     student who asked the system for less motion gets less motion.
 *  2. The prototype screens say out loud that their numbers are a sample.
 *  3. The developer screens do not exist in a release build.
 *  4. The touch targets the student has to hit are 44pt or more.
 *
 * The checks read the source, because the project has no renderer in its
 * test environment (see jest.config.js: the environment is plain node). A
 * source check is still a real guard: it fails the build the moment the
 * rule is broken.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import * as notificationPreferences from '../src/features/notifications/notificationPreferences';

const ROOT = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

/** The animated components that have to honour the OS motion setting. */
const ANIMATED_COMPONENTS = [
  'src/components/motion/CountUp.tsx',
  'src/components/motion/WordReveal.tsx',
  'src/components/motion/ScrambleText.tsx',
  'src/components/motion/ShimmerText.tsx',
  'src/components/motion/LetterRise.tsx',
  'src/components/motion/TypeWriter.tsx',
  'src/components/motion/FadeSlideIn.tsx',
];

describe('the animated components', () => {
  it.each(ANIMATED_COMPONENTS)('%s reads the OS motion setting', (file) => {
    const text = source(file);
    expect(text).toContain('useReduceMotion');
    // The prop always wins; the OS setting is only the default.
    expect(text).toContain('reduceMotion ?? systemReduce');
  });

  it.each(ANIMATED_COMPONENTS)(
    '%s does not hard-default the motion to on',
    (file) => {
      const text = source(file);
      expect(text).not.toMatch(/reduceMotion\s*=\s*false/);
    },
  );

  it('the word reveal, which every empty state uses, honours the setting', () => {
    const emptyState = source('src/components/ui/EmptyState.tsx');
    expect(emptyState).toContain('WordReveal');
    expect(source('src/components/motion/WordReveal.tsx')).toContain(
      'useReduceMotion',
    );
  });
});

describe('the prototype screens', () => {
  const PROTOTYPES = [
    'app/goal.tsx',
    'app/boost.tsx',
    'app/teamwork-preview.tsx',
  ];

  it.each(PROTOTYPES)('%s carries the sample-data banner', (file) => {
    const text = source(file);
    expect(text).toContain('PREVIEW MODE • SAMPLE DATA');
  });

  it.each(PROTOTYPES)('%s announces the banner to a screen reader', (file) => {
    const text = source(file);
    expect(text).toContain('accessibilityRole="alert"');
    expect(text).toContain('accessibilityLiveRegion');
  });

  it('never promises the student a hall ticket', () => {
    const text = source('app/boost.tsx');
    expect(text).not.toContain('Guaranteed Exam Hall Ticket Clearance');
    expect(text).toContain('On track for the 75% requirement');
  });

  it('says that the figures are not the university record', () => {
    expect(source('app/goal.tsx')).toContain('not your university record');
    expect(source('app/boost.tsx')).toContain('not your university record');
  });
});

describe('the developer screens', () => {
  const DEV_SCREENS = ['app/dev/motion.tsx', 'app/dev/alarm-test.tsx'];

  it.each(DEV_SCREENS)('%s is inert outside a development build', (file) => {
    const text = source(file);
    expect(text).toContain('__DEV__');
    expect(text).toMatch(/if \(!__DEV__\) return null;/);
  });

  it.each(DEV_SCREENS)('%s explains why it is guarded', (file) => {
    const text = source(file);
    expect(text).toContain('WHY THIS SCREEN IS GUARDED');
  });
});

describe('the touch targets', () => {
  it('the alarm cancel chip is at least 44pt tall', () => {
    const text = source('src/components/notifications/AlarmStateRow.tsx');
    expect(text).toMatch(/cancel:\s*\{[^}]*minHeight:\s*44/);
  });

  it('the alarm screen buttons are at least 44pt', () => {
    const text = source('app/alarms.tsx');
    expect(text).toMatch(/backBtn:\s*\{[^}]*width:\s*44/);
    expect(text).toMatch(/iconBtn:\s*\{[^}]*width:\s*44/);
    expect(text).toMatch(/deleteBtn:\s*\{[^}]*width:\s*44/);
  });

  it('the home screen links are at least 44pt tall', () => {
    const text = source('app/(tabs)/index.tsx');
    expect(text).toMatch(/seeAllBtn:\s*\{[^}]*minHeight:\s*44/);
  });
});

describe('the alarm prompt', () => {
  it('tells a screen reader that the alarm rang', () => {
    const text = source('src/components/notifications/AlarmRungPrompt.tsx');
    expect(text).toContain('announceForAccessibility');
    expect(text).toContain('accessibilityLiveRegion="assertive"');
  });

  it('uses the shared lead-time wording, so "1 minutes" cannot happen', () => {
    const text = source('src/components/notifications/AlarmRungPrompt.tsx');
    expect(text).toContain('formatLeadTimeVerbose');
    expect(text).not.toMatch(/minutes before it starts/);
  });

  it('does not let a stray tap on the backdrop dismiss the alarm', () => {
    const text = source('src/components/notifications/AlarmRungPrompt.tsx');
    expect(text).toContain('dismissOnBackdropPress={false}');
    expect(text).toContain('closeLabel="Dismiss the class alarm"');
  });
});

describe('the notification permission', () => {
  it('tells a blocked permission apart from a refused one', () => {
    const { resolvePermissionState } = notificationPreferences;

    // Never asked.
    expect(
      resolvePermissionState({ granted: false, canAskAgain: true, status: 'undetermined' }, false),
    ).toBe('unknown');
    // Asked and refused, but the OS will ask again.
    expect(
      resolvePermissionState({ granted: false, canAskAgain: true, status: 'denied' }, true),
    ).toBe('denied');
    // Refused for good: only the settings can fix it.
    expect(
      resolvePermissionState({ granted: false, canAskAgain: false, status: 'denied' }, true),
    ).toBe('blocked');
    // Granted.
    expect(resolvePermissionState({ granted: true, canAskAgain: true }, true)).toBe(
      'granted',
    );
  });

  it('opens the settings when the permission is blocked', () => {
    const text = source('app/alarms.tsx');
    expect(text).toContain('openAlarmSettings');
    expect(text).toContain('Open settings');
  });

  it('never claims an alarm rang when the permission was refused', () => {
    const text = source('app/alarms.tsx');
    // The request returns whether the permission is now on, and both test
    // handlers stop when it is not.
    expect(text).toMatch(/const handleRequestPermission = useCallback\(async \(\): Promise<boolean>/);
    expect(text).toMatch(/const granted = await handleRequestPermission\(\);\s*\n\s*\/\/ Nothing can ring without the permission: say so, and stop\.\s*\n\s*if \(!granted\) return;/);
    expect(text).not.toContain('Alarm ringing now!');
  });
});

describe('the exact alarm permission', () => {
  it('is checked and offered a way out', () => {
    const alarms = source('app/alarms.tsx');
    expect(alarms).toContain('getExactAlarmCapability');
    expect(alarms).toContain('exactAlarmSettingsHint');

    const lifecycle = source('src/features/notifications/useClassAlarmLifecycle.ts');
    expect(lifecycle).toContain('getExactAlarmCapability');
  });

  it('is surfaced in the shell, with a settings shortcut', () => {
    const layout = source('app/_layout.tsx');
    expect(layout).toContain("alarmLifecycle.exactAlarm === 'denied'");
    expect(layout).toContain('openAlarmSettings');
  });
});

describe('an alarm that was never answered', () => {
  it('is told to the student instead of being passed over', () => {
    const layout = source('app/_layout.tsx');
    expect(layout).toContain('alarmLifecycle.missedAlarms');
    expect(layout).toContain('acknowledgeMissed');
  });

  it('is kept in the lifecycle as its own state', () => {
    const lifecycle = source('src/features/notifications/useClassAlarmLifecycle.ts');
    expect(lifecycle).toContain('missedAlarms');
    expect(lifecycle).toContain("state === 'missed'");
  });
});

describe('the navigation shell', () => {
  it('mounts the navigator straight away, so a deep link resolves', () => {
    const layout = source('app/_layout.tsx');
    // The stack must not be behind a "return null until the fonts load".
    expect(layout).not.toMatch(/if \(!fontsLoaded && !fontError\) \{\s*\n\s*return null;/);
    expect(layout).toContain('<Stack');
    expect(layout).toContain('splashOverlay');
  });

  it('closes the splash through one path only', () => {
    const layout = source('app/_layout.tsx');
    expect(layout).toContain('closeSplash');
    // The splash is taken off the screen in exactly one place, so the
    // failsafe timer and the splash's own animation cannot take two
    // different routes to the same end.
    expect(layout.match(/setSplashFinished\(true\)/g)?.length ?? 0).toBe(0);
    expect(layout.match(/runOnJS\(setSplashFinished\)\(true\)/g)?.length ?? 0).toBe(1);
  });

  it('does not hide the custom tab bar twice', () => {
    const layout = source('app/(tabs)/_layout.tsx');
    expect(layout).not.toContain("tabBarStyle: { display: 'none' }");
  });

  it('subscribes to the stores with selectors', () => {
    const layout = source('app/(tabs)/_layout.tsx');
    expect(layout).toContain('useAuthStore((state) => state.user)');
    expect(layout).toContain('useSheetStore((state) => state.isSheetOpen)');
    expect(layout).not.toMatch(/useAuthStore\(\)/);
  });
});

describe('the home screen', () => {
  it('only ticks while the app is in the foreground', () => {
    const home = source('app/(tabs)/index.tsx');
    expect(home).toContain('AppState.addEventListener');
    expect(home).not.toContain('scrollEventThrottle');
    expect(home).not.toContain('removeClippedSubviews');
  });

  it('memoises the notice lists it hands to the carousel', () => {
    const home = source('app/(tabs)/index.tsx');
    expect(home).toContain('const heroSlides = useMemo(');
    expect(home).toContain('const topNotices = useMemo(');
  });
});
