const {defineConfig} = require('cypress');

module.exports = defineConfig({
  e2e: {
    // Keep test discovery explicit so new specs have a predictable location.
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    baseUrl: 'http://localhost:5173'
  },
  downloadsFolder: 'cypress/downloads',
  screenshotsFolder: 'cypress/screenshots',
  videosFolder: 'cypress/videos',
  video: false
});
