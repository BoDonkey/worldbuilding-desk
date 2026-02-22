import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['dist/**']
  },
  {
    files: ['src/**/*.ts', 'examples/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {}
  }
];
