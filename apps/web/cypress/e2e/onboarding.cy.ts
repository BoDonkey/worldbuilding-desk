describe('First-run onboarding', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    // Start every test from an empty database: Cypress clears storage between tests but
    // not IndexedDB. Deleting before the app's scripts run queues the app's open behind it.
    cy.visit('/', {
      onBeforeLoad(win) {
        win.indexedDB.deleteDatabase('worldbuilding-db');
      }
    });
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

    // A first-run offer: gone once the sample exists.
    cy.contains('a, button', 'Projects').first().click();
    cy.contains('h2', 'Existing Projects').should('be.visible');
    cy.contains('The Emberglass Key (Sample)').should('be.visible');
    cy.contains('button', 'Explore a sample project').should('not.exist');
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

  it('opens World Canvas and Source Notes from the guide without leaving the loop unexplained', () => {
    cy.contains('button', 'Explore a sample project').click();
    cy.location('pathname').should('eq', '/workspace');

    cy.contains('button', 'World Canvas').click();
    cy.location('pathname').should('eq', '/world-canvas');
    cy.contains('h1', 'World Canvas').should('be.visible');
    cy.contains('start here with only a seed of an idea', {matchCase: false}).should('be.visible');

    cy.visit('/workspace');
    cy.contains('button', 'Source Note').click();
    cy.location('pathname').should('eq', '/lore');
    cy.contains('h1', 'Source Notes').should('be.visible');
    cy.contains('Character Dossier — Sera Kestrel').should('be.visible');
    cy.contains('Faction Notes — The Cinder Compact').should('be.visible');
  });
});
