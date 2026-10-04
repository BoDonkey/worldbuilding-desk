import './commands';

// The private-local AI policy verifies Ollama models against /api/tags before
// any request. CI has no Ollama, so every spec sees the seeded local model
// installed; a spec that needs another answer (cloud model, unreachable)
// registers its own intercept, which takes precedence.
beforeEach(() => {
  // No spec may depend on a real Ollama: CI has none, and a developer's local
  // Ollama would otherwise answer un-stubbed calls and hide failures. Later
  // intercepts take precedence, so specific stubs still win.
  cy.intercept({url: /^http:\/\/(localhost|127\.0\.0\.1):11434\//}, {forceNetworkError: true});
  cy.intercept('GET', 'http://localhost:11434/api/tags', {
    statusCode: 200,
    body: {models: [{name: 'llama3.1:latest', model: 'llama3.1:latest', size: 4_700_000_000}]}
  });
});
