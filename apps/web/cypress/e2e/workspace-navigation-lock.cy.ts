describe('Workspace navigation lock regression', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('navigates away from workspace via primary nav', () => {
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');

    cy.contains('a', 'World').click({force: true});

    cy.location('pathname').should('eq', '/world-bible');
    cy.contains('h1', 'World Bible').should('be.visible');
  });

  it('navigates away from workspace via command palette', () => {
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');

    cy.get('body').type('{ctrl}k');
    cy.get('[role="dialog"][aria-label="Command palette"]').should('be.visible');
    cy.contains('button', 'Go to World Bible').click();

    cy.location('pathname').should('eq', '/world-bible');
    cy.contains('h1', 'World Bible').should('be.visible');
  });
});
