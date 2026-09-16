describe('Portable project data', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('h2', 'Cypress Smoke Project').should('be.visible');
    cy.contains('a', 'World Bible').click();
    cy.contains('h1', 'World Bible').should('be.visible');
  });

  it('reviews a Markdown folder and keeps Source Notes separate from incomplete World Bible drafts', () => {
    cy.get('section[aria-label="Portable data"] input[type="file"]').selectFile(
      [
        {
          contents: Cypress.Buffer.from(
            '---\ntype: "source-note"\ntitle: "Imported Rumors"\n---\n# Imported Rumors\n\nA rumor about [[Ember Archive]].'
          ),
          fileName: 'rumors.md',
          mimeType: 'text/markdown'
        },
        {
          contents: Cypress.Buffer.from(
            '---\ntype: "world-bible-record"\ntitle: "Vault City"\ncategory: "Locations"\n---\n# Vault City\n\nA city built beneath glass.'
          ),
          fileName: 'vault-city.md',
          mimeType: 'text/markdown'
        }
      ],
      {force: true}
    );

    cy.contains('li', 'rumors.md').within(() => {
      cy.contains('label', 'Import as').find('select').should('have.value', 'source-note');
    });
    cy.contains('li', 'vault-city.md').within(() => {
      cy.contains('label', 'Import as').find('select').should('have.value', 'world-bible');
    });
    cy.contains('button', 'Import Selected').click();
    cy.contains('Imported 1 Source Note and 1 World Bible draft.').should('be.visible');

    cy.contains('button', 'Review').click();
    cy.contains('Vault City').should('be.visible');
    cy.contains('Needs completion').should('be.visible');

    cy.contains('a', 'Source Notes').click();
    cy.contains('h1', 'Source Notes').should('be.visible');
    cy.contains('h3', 'Imported Rumors').should('be.visible');
  });
});
