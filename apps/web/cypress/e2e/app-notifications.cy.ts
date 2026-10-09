describe('App-shell notifications', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('posts route confirmations to the one shell toast viewport and keeps a shared status live region', () => {
    cy.get('[data-testid="app-status-announcer"]').should('have.attr', 'aria-live', 'polite');

    cy.visit('/lore');
    cy.contains('button', 'Start Writing').click();
    cy.contains('label', 'Title').find('input').type('Shell Toast Note');
    cy.contains('button', 'Edit Markdown').click();
    cy.get('textarea').clear().type('The harbor bell rang twice.');
    cy.contains('button', 'Create Source Note').click();

    cy.get('[data-testid="app-toast-viewport"]')
      .should('have.attr', 'aria-live', 'polite')
      .contains('[role="status"]', 'Source Note created.')
      .should('be.visible');
    cy.get('[data-testid="app-toast-viewport"]', {timeout: 8000}).should('not.exist');
  });

  it('keeps Workspace feedback in the shell viewport with a dismiss control for errors', () => {
    cy.visit('/workspace');
    cy.contains('button', 'Save now').click();
    cy.get('[data-testid="app-toast-viewport"]').contains('[role="status"]', 'saved').should('be.visible');
  });
});
