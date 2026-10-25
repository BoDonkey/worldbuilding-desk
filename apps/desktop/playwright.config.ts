import {defineConfig} from '@playwright/test';

// Electron end-to-end tests. They drive the built (or packaged) desktop app,
// so build web and desktop first; see the e2e scripts in package.json.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 90_000,
  expect: {timeout: 15_000},
  retries: 0,
  // One app at a time: each test owns a window and a fake model server.
  workers: 1,
  reporter: 'list',
  outputDir: 'e2e-results'
});
