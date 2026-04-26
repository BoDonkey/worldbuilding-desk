describe('Lore and review matching', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('highlights known lore and does not review incomplete known-name prefixes', () => {
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');

    cy.get('.tiptap-editor')
      .click()
      .type('{selectall}The Ember Archive stands.{enter}The Ember Archiv stands.', {
        delay: 0
      });

    cy.contains('button', 'Save now').click();
    cy.contains('[role="status"]', 'Scene saved.').should('be.visible');

    cy.get('.tiptap-editor [data-lore-id="entity-ember-archive"]')
      .should('contain.text', 'Ember Archive');
    cy.contains('.tiptap-editor [data-consistency-id]', 'Ember Archiv')
      .should('not.exist');
    cy.contains('Commit blocked by consistency check').should('not.exist');
  });

  it('highlights manual review results in the active editor scene', () => {
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');

    cy.get('.tiptap-editor')
      .click()
      .type(
        '{selectall}Kaelor crossed the Glass Harbor before dawn.{enter}At the edge of Glass Harbor, Kaelor found the Ember Archive.',
        {delay: 0}
      );

    cy.wait(1000);
    cy.get('button[aria-label^="Open review drawer"]').click();
    cy.contains('button', 'Run project review').click();

    cy.contains('Project review found').should('be.visible');
    cy.contains('.tiptap-editor [data-consistency-id]', 'Kaelor')
      .should('be.visible');
  });

  it('keeps remaining review highlights after creating one reviewed record', () => {
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');

    cy.get('.tiptap-editor')
      .click()
      .type(
        '{selectall}Kaelor crossed the Glass Harbor before dawn.{enter}At the edge of Glass Harbor, Kaelor found the Ember Archive.',
        {delay: 0}
      );

    cy.wait(1000);
    cy.get('button[aria-label^="Open review drawer"]').click();
    cy.contains('button', 'Run project review').click();
    cy.contains('Project review found').should('be.visible');

    cy.contains('.tiptap-editor [data-consistency-id]', 'Kaelor')
      .click();
    cy.contains('button', /Add to World|Create record/).click();
    cy.contains('[role="status"]', 'Kaelor').should('be.visible');

    cy.contains('.tiptap-editor [data-consistency-id]', 'Kaelor')
      .should('not.exist');
    cy.contains('.tiptap-editor [data-lore-id]', 'Kaelor')
      .should('be.visible');
    cy.contains('.tiptap-editor [data-consistency-id]', 'Glass Harbor')
      .should('be.visible');
  });
});
