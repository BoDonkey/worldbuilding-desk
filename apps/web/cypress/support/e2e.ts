import './commands';

// The private-local AI policy verifies Ollama models against /api/tags before
// any request. CI has no Ollama, so every spec sees the seeded local model
// installed; a spec that needs another answer (cloud model, unreachable)
// registers its own intercept, which takes precedence.
beforeEach(() => {
  cy.intercept('GET', 'http://localhost:11434/api/tags', {
    statusCode: 200,
    body: {models: [{name: 'llama3.1:latest', model: 'llama3.1:latest', size: 4_700_000_000}]}
  });
});
