module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  env: {
    node: true,
    jest: true,
  },
  overrides: [
    {
      // The release-signing test drives a CommonJS Expo config plugin.
      files: ['tests/release_signing.test.ts'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    {
      // Expo config plugins are CommonJS by contract.
      files: ['plugins/**/*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        'no-regex-spaces': 'off',
      },
    },
  ],
  ignorePatterns: [
    'android/**', 'ios/**', 'dist/**', 'node_modules/**', '.expo/**',
    'checklist_extracted/**', 'docs/**',
    'research/**',      // one-off scraping research, not app code
    'scripts/**',       // one-off maintenance/analysis utilities
    '_*.js',            // root-level one-off probes (kept out of git by .gitignore)
    'ref/**',
  ],
};
