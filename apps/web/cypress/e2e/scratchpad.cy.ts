describe('Workspace scratchpad', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('autosaves project scratchpad notes and restores them after reload', () => {
    const note = 'Loose note: Ember Archive needs a better entrance scene.';

    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('button', /^Scratchpad$/).first().click();

    cy.get('textarea[aria-label="Project scratchpad"]').clear().type(note);
    cy.contains('[role="status"]', 'Scratchpad saved').should('be.visible');

    cy.reload();
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('button', /^Scratchpad$/).first().click();
    cy.get('textarea[aria-label="Project scratchpad"]').should('have.value', note);
  });
});
