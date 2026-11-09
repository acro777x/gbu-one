// Mock AsyncStorage for Jest node environment
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-constants', () => ({
  expoConfig: {
    version: '1.0.0',
  },
}));

jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
    canOpenURL: jest.fn().mockResolvedValue(true),
  },
  Platform: {
    OS: 'android',
    select: jest.fn((dict: Record<string, unknown>) => dict.android || dict.default),
  },
  StyleSheet: {
    create: (styles: any) => styles,
    flatten: (styles: any) => styles,
  },
  Dimensions: {
    get: jest.fn().mockReturnValue({ width: 375, height: 812 }),
  },
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  Image: 'Image',
  Alert: {
    alert: jest.fn(),
  },
  Share: {
    share: jest.fn().mockResolvedValue({ action: 'sharedAction' }),
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
    withTiming: (toValue: any) => toValue,
    withSpring: (toValue: any) => toValue,
    withSequence: (...args: any[]) => args[0],
    withRepeat: (anim: any) => anim,
    Easing: {
      linear: (x: any) => x,
      ease: (x: any) => x,
      bezier: () => (x: any) => x,
      inOut: (f: any) => f,
    },
  };
});

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('test-notification-id'),
}));

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
  return {
    useAppTheme: () => ({
      colors: lightColors,
      isDark: false,
      themeMode: 'light',
      setThemeMode: jest.fn(),
    }),
    ThemeProvider: ({ children }: any) => children,
    ThemeContext: {
      Provider: ({ children }: any) => children,
      Consumer: ({ children }: any) => children({ colors: lightColors, isDark: false, themeMode: 'light' }),
    },
  };
});


