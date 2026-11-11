module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup.ts'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).ts?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // tsconfig.test.json turns OFF isolatedModules, so ts-jest actually
        // type checks the files it compiles. With the root config it skipped
        // type checking, which let `npm test` report green while
        // `npm run typecheck` failed.
        tsconfig: 'tsconfig.test.json',
        diagnostics: {
          warnOnly: false,
        },
      },
    ],
  },
  // Expo SDK packages ship untranspiled ESM. Without this, importing
  // `expo-device` (and anything else that pulls it in) fails with
  // "Cannot use import statement outside a module", which made
  // `src/lib/pushNotifications.ts` impossible to test at all.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))',
  ],
};
