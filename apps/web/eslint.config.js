import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // Deferred: react-hooks 7.1 reports 77 existing findings across these
      // three compiler rules. Resolve them through behavior-aware React
      // refactors rather than mechanical changes in this toolchain upgrade.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'off'
    }
  },
  {
    // Storage boundary (slice 3.23a): IndexedDB is reached only through
    // services/storage. Everything else imports that folder's index, which
    // does not export openDb. Tests may reach in to seed or inspect databases.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/services/storage/**', 'src/**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          regex: '(^|/)storage/.+',
          message: 'Import persistence from services/storage (its index), not its internal modules.'
        }]
      }],
      'no-restricted-globals': ['error', {
        name: 'indexedDB',
        message: 'Use IndexedDB only inside services/storage.'
      }],
      'no-restricted-properties': ['error',
        {object: 'window', property: 'indexedDB', message: 'Use IndexedDB only inside services/storage.'},
        {object: 'globalThis', property: 'indexedDB', message: 'Use IndexedDB only inside services/storage.'}
      ]
    }
  },
])
