describe('Help (5.8)', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
  });

  it('opens from More, finds a topic, and goes to its screen', () => {
    cy.visit('/workspace');
    cy.get('nav[aria-label="Primary navigation"]').contains('button', 'More').click();
    cy.contains('[role="menuitem"]', 'Help').click();
    cy.contains('h1', 'Help').should('be.visible');

    cy.get('input[type="search"]').type('sagabackup');
    cy.contains('h2', 'Backups and exports').should('be.visible');
    cy.contains('h2', 'Setting up AI').should('not.exist');

    cy.contains('section', 'Backups and exports').contains('a', 'Open Projects').click();
    cy.location('pathname').should('eq', '/projects');
  });

  it('opens from the command palette', () => {
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.get('body').type('{ctrl}k');
    cy.focused().type('Go to Help{enter}');
    cy.contains('h1', 'Help').should('be.visible');
  });
});
