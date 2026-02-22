import tsParser from '../rules-engine/node_modules/@typescript-eslint/parser/dist/index.js';

export default [
  {
    ignores: ['dist/**']
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {}
  }
];
