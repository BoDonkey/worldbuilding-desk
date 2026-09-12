describe('Trust-dogfood fixture loader (dev only)', () => {
  it('seeds the runbook project with scenes, Source Notes, and a linked ruleset but no canon', () => {
    cy.viewport(1400, 1000);
    cy.visit('/projects');
    cy.get('[data-testid="dogfood-tools"]').should('be.visible');
    cy.contains('button', 'Load trust-dogfood fixture').click();

    cy.location('pathname').should('eq', '/workspace');
    cy.contains('Trust-dogfood fixture loaded').should('be.visible');
    cy.contains('Chapter One — The Salt Door').should('exist');

    cy.visit('/lore');
    cy.contains('Character Dossier — Sera Kestrel').should('exist');
    cy.contains('Working Notes — Book Two Brainstorm').should('exist');

    cy.visit('/world-bible');
    cy.contains('Sera Kestrel').should('not.exist');
  });
});
