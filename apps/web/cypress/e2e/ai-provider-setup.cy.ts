describe('AI provider setup UX', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.visit('/settings');
    cy.ensureSettingsSectionOpen('AI Settings');
  });

  it('shows only the selected provider\'s key field and states the on-device / hosted data-flow disclosure', () => {
    cy.contains('label', 'Provider').parent().find('select').select('Ollama (Local)');
    cy.contains('No story text ever leaves your computer').should('be.visible');
    cy.contains('label', 'Anthropic API Key').should('not.exist');
    cy.contains('label', 'OpenAI API Key').should('not.exist');
    cy.contains('label', 'Gemini API Key').should('not.exist');

    cy.contains('label', 'Provider').parent().find('select').select('Anthropic (Claude)');
    cy.contains(/is sent to Anthropic.*servers/).should('be.visible');
    cy.contains('label', 'Anthropic API Key').should('be.visible');
    cy.contains('label', 'OpenAI API Key').should('not.exist');
    cy.contains('label', 'Gemini API Key').should('not.exist');
  });

  it('reports a missing key without making a network call', () => {
    cy.contains('label', 'Provider').parent().find('select').select('Anthropic (Claude)');
    cy.contains('button', 'Test connection').click();
    cy.contains('strong', 'Anthropic API key is missing.').should('be.visible');
  });

  it('reports success after a real (stubbed) test call', () => {
    cy.contains('label', 'Provider').parent().find('select').select('Anthropic (Claude)');
    cy.contains('label', 'Anthropic API Key').parent().find('input').type('sk-ant-test-key');

    cy.window().then((win) => {
      cy.stub(win, 'fetch').callsFake((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('api.anthropic.com')) {
          return Promise.resolve(
            new win.Response(
              JSON.stringify({
                content: [{text: 'OK'}],
                usage: {input_tokens: 5, output_tokens: 1}
              }),
              {status: 200, headers: {'Content-Type': 'application/json'}}
            )
          );
        }
        return Promise.reject(new Error(`Unexpected fetch in test: ${url}`));
      });
    });

    cy.contains('button', 'Test connection').click();
    cy.contains('strong', 'Anthropic connection succeeded.').should('be.visible');
  });

  it('reports a rejected key in plain language', () => {
    cy.contains('label', 'Provider').parent().find('select').select('Anthropic (Claude)');
    cy.contains('label', 'Anthropic API Key').parent().find('input').type('sk-ant-bad-key');

    cy.window().then((win) => {
      cy.stub(win, 'fetch').resolves(
        new win.Response('{}', {status: 401, statusText: 'Unauthorized'})
      );
    });

    cy.contains('button', 'Test connection').click();
    cy.contains('strong', /rejected the key/).should('be.visible');
  });

  it('links the not-configured assistant notice to Settings', () => {
    cy.visit('/workspace');
    cy.contains('button', 'Context').click();
    cy.contains('button', /^AI$/).click();
    cy.contains('Anthropic API key is missing').should('be.visible');
    cy.contains('a', 'Open Settings').click();
    cy.location('pathname').should('eq', '/settings');
  });

  it('keeps the Lore Inspector guardrail controls collapsed behind Show advanced settings', () => {
    cy.contains('label', 'Who checks your draft').should('not.exist');
    cy.contains('button', 'Show advanced settings').click();
    cy.contains('label', 'Who checks your draft').should('be.visible');
    cy.contains('label', 'How much story context to send').should('be.visible');
    cy.contains('label', 'Cheaper model for routine checks (optional)').should('be.visible');
    cy.contains('button', 'Hide advanced settings').click();
    cy.contains('label', 'Who checks your draft').should('not.exist');
  });
});
