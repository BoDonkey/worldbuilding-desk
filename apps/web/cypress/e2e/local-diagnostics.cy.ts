describe('Local-only diagnostics', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.visit('/settings');
    cy.ensureSettingsSectionOpen('Diagnostics');
  });

  it('starts empty and explains that nothing is sent automatically', () => {
    cy.contains('No errors recorded on this computer.').should('be.visible');
    cy.contains(/Nothing is sent anywhere unless you copy it/).should('be.visible');
    cy.contains('button', 'Clear log').should('be.disabled');
  });

  it('records a described error, shows a redacted report, and clears it', () => {
    cy.window().then((win) => {
      win.localStorage.setItem(
        'worldbuilding-desk:diagnostics',
        JSON.stringify([
          {
            id: 'seeded',
            at: Date.now(),
            context: 'assistant reply',
            failureClass: 'auth',
            name: 'Error',
            message: 'OpenAI API error: Unauthorized',
            stack: ''
          }
        ])
      );
    });
    cy.reload();
    cy.ensureSettingsSectionOpen('Diagnostics');

    cy.contains('Provider key').should('be.visible');
    cy.contains('OpenAI API error: Unauthorized').should('be.visible');
    cy.contains('button', 'Show report').click();
    cy.get('[aria-label="Diagnostic report"]')
      .should('contain.text', 'SagaSpine diagnostic report')
      .and('contain.text', 'Where: assistant reply')
      .and('contain.text', 'API keys, and file paths are not included');
    cy.contains('button', 'Hide report').click();
    cy.get('[aria-label="Diagnostic report"]').should('not.exist');

    cy.contains('button', 'Clear log').click();
    cy.contains('Diagnostic log cleared.').should('be.visible');
    cy.contains('No errors recorded on this computer.').should('be.visible');
  });
});
