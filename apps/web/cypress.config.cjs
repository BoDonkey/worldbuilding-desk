const {defineConfig} = require('cypress');

module.exports = defineConfig({
  allowCypressEnv: false,
  e2e: {
    // Keep test discovery explicit so new specs have a predictable location.
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    baseUrl: 'http://localhost:5173'
  },
  // Retry a failed test up to twice in `cypress run` (CI and local batch runs) so a
  // timing flake does not cost a full rerun. Retried tests still show in the run
  // output as "Attempt 2 of 3"; a test that keeps needing retries is a bug to fix.
  retries: {runMode: 2, openMode: 0},
  downloadsFolder: 'cypress/downloads',
  screenshotsFolder: 'cypress/screenshots',
  videosFolder: 'cypress/videos',
  video: false
});
