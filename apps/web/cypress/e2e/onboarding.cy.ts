describe('First-run onboarding', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
  });

  it('loads the sample project from Projects, shows its scenes, and offers the getting-started guide', () => {
    cy.contains('h1', 'Projects').should('be.visible');
    cy.contains('button', 'Explore a sample project').click();

    cy.location('pathname').should('eq', '/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('The Emberglass Key (Sample)').should('be.visible');
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'The tide went out at four bells');

    cy.contains('h2', 'Getting started').should('be.visible');
    cy.contains("disagree about how long Brannic has served the Compact").should('be.visible');
  });

  it('persists a dismissal of the getting-started guide across reload', () => {
    cy.contains('button', 'Explore a sample project').click();
    cy.location('pathname').should('eq', '/workspace');
    cy.contains('h2', 'Getting started').should('be.visible');

    cy.contains('h2', 'Getting started').parent().contains('button', 'Dismiss').click();
    cy.contains('h2', 'Getting started').should('not.exist');

    cy.reload();
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('h2', 'Getting started').should('not.exist');
  });

  it('opens Source Notes and Canon Decisions from the guide without leaving the loop unexplained', () => {
    cy.contains('button', 'Explore a sample project').click();
    cy.location('pathname').should('eq', '/workspace');

    cy.contains('button', 'Source Note').click();
    cy.location('pathname').should('eq', '/lore');
    cy.contains('h1', 'Source Notes').should('be.visible');
    cy.contains('Character Dossier — Sera Kestrel').should('be.visible');
    cy.contains('Faction Notes — The Cinder Compact').should('be.visible');
  });
});
