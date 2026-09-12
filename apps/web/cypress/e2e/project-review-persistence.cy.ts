describe('Persisted, incremental project review', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
    cy.visit('/workspace');
  });

  it('restores the last project review after a reload and marks items whose scene changed', () => {
    cy.get('.tiptap-editor')
      .click()
      .type('{selectall}Kaelor crossed the Glass Harbor before dawn.{enter}At the edge of Glass Harbor, Kaelor found the Ember Archive.', {delay: 0});
    cy.wait(1000);
    cy.get('button[aria-label^="Open review drawer"]').click();
    cy.contains('button', 'Run project review').click();
    cy.contains('Project review found').should('be.visible');
    cy.contains('Last run:').should('be.visible');
    cy.contains('Scene changed since review').should('not.exist');

    cy.reload();
    cy.visit('/workspace');
    cy.get('button[aria-label^="Open review drawer"]').click();
    cy.contains('Last run:').should('be.visible');
    cy.contains('li', 'Kaelor').should('exist');
    cy.contains('Scene changed since review').should('not.exist');

    cy.get('.tiptap-editor').click().type('{end} The tide turned.', {delay: 0});
    cy.wait(1000);
    cy.contains('Scene changed since review').should('exist');
    cy.contains(/from scenes changed since/).should('be.visible');

    cy.contains('button', 'Run project review').click();
    cy.contains('Project review found').should('be.visible');
    cy.contains('Scene changed since review').should('not.exist');
  });
});
