describe('Lore Documents', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('keeps Lore Documents framed as source notes and supports manual document lifecycle', () => {
    cy.visit('/lore');
    cy.contains('h1', 'Lore Documents').should('be.visible');
    cy.contains(
      'Keep dossiers, timelines, myths, and deep reference notes here as source material.'
    ).should('be.visible');
    cy.contains(
      'World Bible remains the structured canon home; extraction only creates review candidates until you accept them.'
    ).should('be.visible');
    cy.contains('h2', 'Source Document Intake').should('be.visible');
    cy.contains('h3', 'Write Manually').should('be.visible');
    cy.contains('h3', 'Import Dossier').should('be.visible');
    cy.contains('h3', 'Extract Candidates').should('be.visible');
    cy.contains('Scan the active saved document for entity and fact proposals without changing canon.').should(
      'be.visible'
    );
    cy.contains('button', 'Extract Facts').should('be.disabled');

    cy.contains('button', 'Start Writing').click();
    cy.contains('label', 'Title')
      .find('input')
      .should('be.focused')
      .type('Glass Harbor Timeline');
    cy.get('textarea').clear().type(
      [
        'The Glass Harbor was founded after the lantern guild vanished.',
        '',
        'Timeline:',
        '- The first beacon failed at midnight.'
      ].join('\n')
    );
    cy.contains('button', 'Create Lore Document').click();
    cy.contains('[role="status"]', 'Lore document created.').should('be.visible');
    cy.contains('article', 'Glass Harbor Timeline').within(() => {
      cy.contains('0 entity candidates').should('be.visible');
      cy.contains('0 fact candidates').should('be.visible');
      cy.contains('0 accepted').should('be.visible');
      cy.contains('button', 'Edit').should('be.visible');
      cy.contains('button', 'Delete').should('be.visible');
    });

    cy.window().then((win) => {
      cy.stub(win, 'confirm').returns(true);
    });
    cy.contains('article', 'Glass Harbor Timeline').within(() => {
      cy.contains('button', 'Delete').click();
    });
    cy.contains('[role="status"]', 'Lore document deleted.').should('be.visible');
    cy.contains('article', 'Glass Harbor Timeline').should('not.exist');
  });

  it('imports a dossier and extracts review candidates without writing canon automatically', () => {
    cy.visit('/lore');

    cy.contains('button', 'Import File').click();
    cy.get('input[type="file"]').selectFile(
      {
        contents: Cypress.Buffer.from(
          [
            'Character Sheet: Mira Voss',
            '',
            'Name: Mira Voss',
            'Age: 34',
            'Occupation: Cartographer',
            'Mira Voss is from Glass Harbor.',
            'Mira is a member of the Lantern Guild clan.'
          ].join('\n')
        ),
        fileName: 'mira-voss-dossier.md',
        mimeType: 'text/markdown'
      },
      {force: true}
    );
    cy.contains('[role="status"]', 'Imported "mira-voss-dossier.md". Review and save when ready.').should(
      'be.visible'
    );
    cy.contains('label', 'Title').find('input').should('have.value', 'mira-voss-dossier');
    cy.get('textarea').should('contain.value', 'Character Sheet: Mira Voss');
    cy.contains('button', 'Create Lore Document').click();
    cy.contains('[role="status"]', 'Lore document created.').should('be.visible');

    cy.contains('article', 'mira-voss-dossier').within(() => {
      cy.contains('button', 'Extract').click();
    });
    cy.contains('[role="status"]', /Extracted \d+ entity proposal/).should('be.visible');
    cy.contains('article', 'mira-voss-dossier').within(() => {
      cy.contains(/entity candidates/).should('be.visible');
      cy.contains(/fact candidates/).should('be.visible');
      cy.contains('0 accepted').should('be.visible');
      cy.contains('button', 'Edit').click();
    });

    cy.contains('h2', 'Extraction Review').should('be.visible');
    cy.contains(
      'These local proposals do not change World Bible or accepted canon until you explicitly accept one.'
    ).should('be.visible');
    cy.contains('h3', 'Entity Candidates').should('be.visible');
    cy.contains('Mira Voss').should('be.visible');
    cy.contains('Glass Harbor').should('be.visible');
    cy.contains('h3', 'Fact Candidates').should('be.visible');
    cy.contains('34').should('be.visible');
    cy.contains('Cartographer').should('be.visible');
    cy.contains('h3', 'Accepted Canon').should('be.visible');
    cy.contains('No accepted facts from this document yet.').should('be.visible');

    cy.visit('/world-bible');
    cy.contains('Mira Voss').should('not.exist');
  });
});
