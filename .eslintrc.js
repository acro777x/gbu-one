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
  ignorePatterns: [
    'android/**', 'ios/**', 'dist/**', 'node_modules/**', '.expo/**',
    'checklist_extracted/**', 'docs/**',
    'research/**',      // one-off scraping research, not app code
    'scripts/**',       // one-off maintenance/analysis utilities
    'ref/**',
  ],
};
