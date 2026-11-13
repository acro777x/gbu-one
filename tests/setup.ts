// ---------------------------------------------------------------------------
// Jest environment for GBU One.
//
// This file IS the test environment: every native module the app uses is
// replaced here. It used to be a thin mock surface, which meant a whole part
// of the app was untestable by construction:
//
//   * `expo-notifications` was missing 7 of the APIs the app calls, so
//     `classAlarm.ts` could not even be imported - and the missing
//     `setNotificationCategoryAsync` would have thrown inside an empty
//     `catch`, so the snooze/dismiss buttons would never have been registered
//     on the notification.
//   * `react-native` was missing 12 exports the app uses, including
//     `AccessibilityInfo` (so `useReduceMotion.ts` threw inside a useEffect)
//     and `BackHandler`.
//   * `expo-sqlite` was absent, so `src/lib/db.ts` silently became a no-op
//     and the whole offline-cache layer was untestable.
//   * `expo-device` ships ESM and could not be imported at all.
//   * `ThemeContext` was hard-wired to the light palette, so the dark theme
//     was never exercised by a single test.
//
// Every mock below is deliberately faithful to the real API surface.
// ---------------------------------------------------------------------------

// Mock AsyncStorage for Jest node environment
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.0',
    slug: 'gbu-one',
    android: { package: 'in.gbu.one' },
    extra: {
      eas: { projectId: 'test-eas-project-id' },
    },
  },
  easConfig: {
    projectId: 'test-eas-project-id',
  },
}));

jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
    canOpenURL: jest.fn().mockResolvedValue(true),
    openSettings: jest.fn().mockResolvedValue(true),
  },
  Platform: {
    OS: 'android',
    select: jest.fn((dict: Record<string, unknown>) => dict.android || dict.default),
  },
  StyleSheet: {
    create: (styles: any) => styles,
    flatten: (styles: any) => styles,
    hairlineWidth: 1,
    absoluteFill: {},
  },
  Dimensions: {
    get: jest.fn().mockReturnValue({ width: 375, height: 812 }),
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  },
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  TouchableOpacity: 'TouchableOpacity',
  TouchableWithoutFeedback: 'TouchableWithoutFeedback',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  SectionList: 'SectionList',
  Image: 'Image',
  ImageBackground: 'ImageBackground',
  Modal: 'Modal',
  StatusBar: 'StatusBar',
  TextInput: 'TextInput',
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
  Switch: 'Switch',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  SafeAreaView: 'SafeAreaView',
  PressableAndroid: 'PressableAndroid',
  Alert: {
    alert: jest.fn(),
  },
  Share: {
    share: jest.fn().mockResolvedValue({ action: 'sharedAction' }),
  },
  // The app asks the OS whether the user asked for reduced motion. The
  // default mock said "no", but the real API is a promise, so the previous
  // mock shape made `useReduceMotion.ts` throw on every render.
  AccessibilityInfo: {
    isReduceMotionEnabled: jest.fn().mockResolvedValue(false),
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    announceForAccessibility: jest.fn(),
    setAccessibilityFocus: jest.fn(),
  },
  useColorScheme: jest.fn().mockReturnValue('light'),
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  },
  BackHandler: {
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    removeEventListener: jest.fn(),
    exitApp: jest.fn(),
  },
  Animated: {
    Value: jest.fn((val) => ({
      setValue: jest.fn(),
      interpolate: jest.fn().mockReturnValue(0),
      _value: val,
    })),
    timing: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
      stop: jest.fn(),
    })),
    sequence: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
      stop: jest.fn(),
    })),
    parallel: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
      stop: jest.fn(),
    })),
    spring: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
      stop: jest.fn(),
    })),
    loop: jest.fn(() => ({
      start: jest.fn(),
      stop: jest.fn(),
    })),
    View: 'Animated.View',
    Text: 'Animated.Text',
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

jest.mock('react-native-svg', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  const createSvgComponent = (name: string) => {
    const Component = (props: any) => React.createElement(name, props, props.children);
    Component.displayName = name;
    return Component;
  };
  return {
    __esModule: true,
    default: createSvgComponent('Svg'),
    Svg: createSvgComponent('Svg'),
    Circle: createSvgComponent('Circle'),
    Ellipse: createSvgComponent('Ellipse'),
    G: createSvgComponent('G'),
    Text: createSvgComponent('Text'),
    TSpan: createSvgComponent('TSpan'),
    TextPath: createSvgComponent('TextPath'),
    Path: createSvgComponent('Path'),
    Polygon: createSvgComponent('Polygon'),
    Polyline: createSvgComponent('Polyline'),
    Line: createSvgComponent('Line'),
    Rect: createSvgComponent('Rect'),
    Use: createSvgComponent('Use'),
    Image: createSvgComponent('Image'),
    Symbol: createSvgComponent('Symbol'),
    Defs: createSvgComponent('Defs'),
    LinearGradient: createSvgComponent('LinearGradient'),
    RadialGradient: createSvgComponent('RadialGradient'),
    Stop: createSvgComponent('Stop'),
    ClipPath: createSvgComponent('ClipPath'),
    Pattern: createSvgComponent('Pattern'),
    Mask: createSvgComponent('Mask'),
  };
});

jest.mock('react-native-reanimated', () => {
  return {
    __esModule: true,
    default: {
      View: 'View',
      Text: 'Text',
      createAnimatedComponent: (c: any) => c,
    },
    useSharedValue: (init: any) => ({ value: init }),
    useAnimatedStyle: (cb: any) => cb(),
    useDerivedValue: (cb: any) => ({ value: cb() }),
    useAnimatedRef: () => ({ current: null }),
    useAnimatedReaction: jest.fn(),
    withTiming: (toValue: any) => toValue,
    withSpring: (toValue: any) => toValue,
    withSequence: (...args: any[]) => args[0],
    withRepeat: (anim: any) => anim,
    withDelay: (_delay: number, anim: any) => anim,
    runOnJS: (fn: any) => fn,
    cancelAnimation: jest.fn(),
    interpolate: (v: any) => v,
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    Easing: {
      linear: (x: any) => x,
      ease: (x: any) => x,
      bezier: (x: any) => x,
      inOut: (f: any) => f,
    },
  };
});

// The real module surface. The previous mock was missing seven APIs the app
// calls, which made `classAlarm.ts` untestable and hid the fact that the
// notification action categories would never be registered.
jest.mock('expo-notifications', () => ({
  AndroidImportance: { MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4, MAX: 5 },
  AndroidNotificationVisibility: {
    VISIBILITY_SECRET: -1,
    VISIBILITY_PRIVATE: 0,
    VISIBILITY_PUBLIC: 1,
  },
  AndroidNotificationPriority: {
    PRIORITY_MIN: -2,
    PRIORITY_LOW: -1,
    PRIORITY_DEFAULT: 0,
    PRIORITY_HIGH: 1,
    PRIORITY_MAX: 2,
  },
  SchedulableTriggerInputTypes: {
    DATE: 'date',
    TIME_INTERVAL: 'timeInterval',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
  },
  NotificationBehavior: { ALERT: 'alert', SILENT: 'silent' },
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: jest.fn().mockResolvedValue(undefined),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('test-notification-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  getPresentedNotificationsAsync: jest.fn().mockResolvedValue([]),
  addNotificationReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  setBadgeCountAsync: jest.fn().mockResolvedValue(undefined),
}));

// `expo-device` ships ESM and could not be imported under the old Jest
// config, which made `src/lib/pushNotifications.ts` untestable.
jest.mock('expo-device', () => ({
  isDevice: true,
  deviceName: 'Test Device',
  deviceId: 'test-device-id',
  osName: 'Android',
  osVersion: '14',
  modelName: 'Test Model',
}));

// An in-memory SQLite so `src/lib/db.ts` - the whole offline-cache layer -
// is actually exercised instead of silently returning [].
jest.mock('expo-sqlite', () => {
  type Row = Record<string, unknown>;
  const tables = new Map<string, Row[]>();

  /**
   * Applies a simple WHERE clause to the rows.
   *
   * The fake used to ignore the WHERE clause entirely, so `getFirstSync`
   * returned the first row of the table no matter what was asked for. That
   * made the timetable cache untestable: a lookup for semester session 40
   * returned the row for session 39.
   *
   * Supported: `col = ?`, `col = 'literal'`, `col = "literal"` and
   * `col IN (?, ?, ...)`.
   */
  const filterByWhere = (
    rows: Row[],
    sql: string,
    params: unknown[] = [],
  ): Row[] => {
    const where = sql.match(/\bWHERE\b([\s\S]*?)(?:\bORDER\b|\bLIMIT\b|;|$)/i);
    if (!where) return rows;
    const condition = where[1].trim();

    const inMatch = condition.match(/(\w+)\s+IN\s*\(([^)]*)\)/i);
    if (inMatch) {
      const column = inMatch[1];
      const placeholders = inMatch[2].split(',').map((v) => v.trim());
      const wanted = placeholders.map((placeholder) =>
        placeholder === '?'
          ? String(params.shift() ?? '')
          : placeholder.replace(/^['"]|['"]$/g, ''),
      );
      return rows.filter((r) => wanted.includes(String(r[column])));
    }

    // A WHERE clause may chain several conditions with AND, e.g.
    //   WHERE class_key = ? AND session_id = ?
    const eqMatches = [
      ...condition.matchAll(/(\w+)\s*=\s*(\?|'(?:[^']*)'|"(?:[^"]*)")/gi),
    ];
    if (eqMatches.length > 0) {
      const remaining = [...params];
      const conditions = eqMatches.map((m) => {
        const column = m[1];
        const raw = m[2];
        const value =
          raw === '?'
            ? String(remaining.shift() ?? '')
            : raw.replace(/^['"]|['"]$/g, '');
        return { column, value };
      });
      return rows.filter((r) =>
        conditions.every((c) => String(r[c.column]) === c.value),
      );
    }

    return rows;
  };

  const db = {
    _tables: tables,
    execSync: (sql: string) => {
      const m = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
      if (m) {
        const name = m[1];
        if (!tables.has(name)) tables.set(name, []);
      }
    },
    runSync: (sql: string, params: unknown[] = []) => {
      const create = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
      if (create) {
        const name = create[1];
        if (!tables.has(name)) tables.set(name, []);
        return { lastInsertRowId: 0, changes: 0 };
      }
      const insert = sql.match(/INSERT INTO (\w+)/i);
      if (insert) {
        const name = insert[1];
        const rows = tables.get(name) ?? [];
        // The parameters are the values of the INSERT, in order. The fake
        // used to drop the first one (`params.slice(1)`), so every cached
        // row in every test held the WRONG column values.
        const values = params;
        const cols = (sql.match(/\(([^)]*)\)\s*VALUES/i)?.[1] ?? '')
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);
        const row: Row = {};
        cols.forEach((c, i) => {
          row[c] = values[i];
        });

        const conflict = sql.match(/ON CONFLICT\(([^)]+)\)\s+DO UPDATE/i);
        const conflictCols = conflict
          ? conflict[1].split(',').map((c) => c.trim())
          : [];
        if (conflictCols.length) {
          const idx = rows.findIndex((r) =>
            conflictCols.every((c) => String(r[c]) === String(row[c])),
          );
          if (idx >= 0) {
            // The UPDATE list names the columns that change. The fake used
            // to update only the CONFLICT columns, so a row's changed
            // fields were never applied.
            const updateList = sql.match(/DO\s+UPDATE\s+SET\s+([\s\S]*?)(?:;|$)/i)?.[1] ?? '';
            const updated = { ...rows[idx] };
            const assignments = updateList.match(/(\w+)\s*=\s*excluded\.(\w+)/gi) ?? [];
            for (const assignment of assignments) {
              const [, target, source] = assignment.match(
                /(\w+)\s*=\s*excluded\.(\w+)/i,
              ) as RegExpMatchArray;
              updated[target] = row[source];
            }
            rows[idx] = updated;
            tables.set(name, rows);
            return { lastInsertRowId: idx, changes: 1 };
          }
        }

        rows.push(row);
        tables.set(name, rows);
        return { lastInsertRowId: rows.length, changes: 1 };
      }
      const del = sql.match(/DELETE FROM (\w+)/i);
      if (del) {
        const name = del[1];
        const rows = tables.get(name) ?? [];

        // The cache prunes with
        //   DELETE FROM t WHERE <key> NOT IN (SELECT <key> FROM t ORDER BY <col> DESC LIMIT ?)
        // The fake used to delete EVERY row for any DELETE, so the prune
        // emptied the whole cache - which means the notices cache and the
        // question-paper cache were never actually exercised by a test.
        const prune = sql.match(
          /NOT\s+IN\s*\(\s*SELECT\s+(\w+)\s+FROM\s+(\w+)(?:\s+ORDER\s+BY\s+(\w+)\s+DESC)?\s+LIMIT\s+(\d+|\?)\s*\)/i,
        );
        if (prune) {
          const [, keyColumn, sourceTable, orderColumn, limitText] = prune;
          const limit = limitText === '?' ? (params[params.length - 1] as number) : Number(limitText);
          const source = tables.get(sourceTable) ?? [];
          const ordered = orderColumn
            ? [...source].sort(
                (a, b) => Number(b[orderColumn] ?? 0) - Number(a[orderColumn] ?? 0),
              )
            : source;
          const keep = new Set(
            ordered.slice(0, Math.max(0, Number(limit) || 0)).map((r) => String(r[keyColumn])),
          );
          const kept = rows.filter((r) => keep.has(String(r[keyColumn])));
          tables.set(name, kept);
          return { changes: rows.length - kept.length };
        }

        // A plain DELETE FROM t WHERE ... removes the matching rows.
        const where = sql.match(/WHERE\s+(.+?)(?:;|$)/i);
        if (where) {
          const condition = where[1];
          const eq = condition.match(/(\w+)\s*=\s*(\?|'(?:[^']*)'|"(?:[^"]*)")/i);
          if (eq) {
            const column = eq[1];
            const value =
              eq[2] === '?'
                ? String(params[params.length - 1] ?? '')
                : eq[2].replace(/^['"]|['"]$/g, '');
            const kept = rows.filter((r) => String(r[column]) !== value);
            tables.set(name, kept);
            return { changes: rows.length - kept.length };
          }
        }

        tables.set(name, rows.filter(() => true));
        return { changes: rows.length };
      }
      return { changes: 0 };
    },
    getAllSync: <T,>(sql: string, params: unknown[] = []): T[] => {
      const m = sql.match(/FROM (\w+)/i);
      const rows = m ? tables.get(m[1]) ?? [] : [];
      return filterByWhere(rows, sql, params) as unknown as T[];
    },
    getFirstSync: <T,>(sql: string, params: unknown[] = []): T | null => {
      const all = db.getAllSync<T>(sql, params);
      return all.length ? all[0] : null;
    },
    closeSync: jest.fn(),
  };

  return { openDatabaseSync: jest.fn(() => db), __esModule: true };
});

// MMKV is a native module; without it `src/lib/storage.ts` silently fell
// back to AsyncStorage and its sync path lost every read.
jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: class MMKV {
      getString(key: string) {
        return store.get(key);
      }
      set(key: string, value: string) {
        store.set(key, value);
      }
      delete(key: string) {
        store.delete(key);
      }
      clearAll() {
        store.clear();
      }
      getAllKeys() {
        return Array.from(store.keys());
      }
    },
  };
});

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true, assets: null }),
}));

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(() => ({
      json: jest.fn().mockResolvedValue({}),
      text: jest.fn().mockResolvedValue(''),
      blob: jest.fn().mockResolvedValue(new Blob()),
      resp: { status: 200, headers: {} },
      path: jest.fn().mockResolvedValue('file:///test/out'),
    })),
    config: jest.fn(() => ({
      path: jest.fn().mockResolvedValue('file:///test/out'),
      fetch: jest.fn().mockResolvedValue({ status: 200, resp: { status: 200, headers: {} } }),
    })),
    fs: {
      dirs: { DocumentDir: 'file:///test/', CacheDir: 'file:///cache/' },
      exists: jest.fn().mockResolvedValue(false),
      unlink: jest.fn().mockResolvedValue(undefined),
      cp: jest.fn().mockResolvedValue(undefined),
      stat: jest.fn().mockResolvedValue({ size: 0 }),
    },
  },
}));

// The theme mock keeps the LIGHT palette as the default (every existing test
// depends on that) but the dark palette is now reachable, so the dark theme
// is no longer untestable.
jest.mock('../src/lib/ThemeContext', () => {
  const lightColors = {
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F5F9',
    surfaceMuted: '#E2E8F0',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    accent: '#06B6D4',
    accentSoft: '#06B6D420',
    onAccent: '#FFFFFF',
    avatarBg: '#E2E8F0',
    borderGlass: 'rgba(255,255,255,0.1)',
    borderStrong: '#CBD5E1',
    divider: '#E2E8F0',
    danger: '#EF4444',
  };
  const darkColors = {
    ...lightColors,
    bg: '#0B0B0C',
    surface: '#17171A',
    surfaceAlt: '#1F1F23',
    surfaceMuted: '#26262B',
    textPrimary: '#F4F4F5',
    textSecondary: '#A1A1AA',
    textTertiary: '#71717A',
    accentSoft: '#06B6D440',
    borderGlass: 'rgba(255,255,255,0.12)',
    borderStrong: '#3F3F46',
    divider: '#26262B',
  };
  const state = { isDark: false };
  return {
    __esModule: true,
    __setDark: (v: boolean) => {
      state.isDark = v;
    },
    useAppTheme: () => ({
      colors: state.isDark ? darkColors : lightColors,
      isDark: state.isDark,
      themeMode: state.isDark ? 'dark' : 'light',
      setThemeMode: jest.fn(),
    }),
    ThemeProvider: ({ children }: any) => children,
    ThemeContext: {
      Provider: ({ children }: any) => children,
      Consumer: ({ children }: any) =>
        children({
          colors: state.isDark ? darkColors : lightColors,
          isDark: state.isDark,
          themeMode: state.isDark ? 'dark' : 'light',
        }),
    },
  };
});
