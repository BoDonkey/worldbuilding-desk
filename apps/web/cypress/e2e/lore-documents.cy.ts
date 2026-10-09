describe('Source Notes', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('keeps Source Notes framed as source material and supports manual document lifecycle', () => {
    cy.visit('/lore');
    cy.contains('h1', 'Source Notes').should('be.visible');
    cy.contains(
      'Keep dossiers, timelines, myths, and deep reference notes here as source material. Context links help retrieval and extraction target the right World Bible records; they do not accept canon or create relationships between those records.'
    ).should('be.visible');
    cy.contains('h2', 'Source note intake').should('be.visible');
    cy.contains('h3', 'Write Manually').should('be.visible');
    cy.contains('h3', 'Import Dossier').should('be.visible');
    cy.contains('h3', 'Review Later').should('be.visible');
    cy.contains('Save a Source Note, open it for editing, then extract candidates from the one saved version in view.').should(
      'be.visible'
    );
    cy.contains('button', 'Import File').should('have.length', 1);
    cy.contains('button', 'Extract Candidates').should('not.exist');

    cy.contains('button', 'Hide intro').should('have.attr', 'aria-expanded', 'true').click();
    cy.contains('h3', 'Write Manually').should('not.exist');
    cy.reload();
    cy.contains('button', 'Show intro').should('have.attr', 'aria-expanded', 'false');
    cy.get('button').filter(':contains("Import File")').should('have.length', 1);
    cy.contains('button', 'Show intro').click();
    cy.contains('h3', 'Write Manually').should('be.visible');

    cy.contains('button', 'Start Writing').click();
    cy.contains('label', 'Title')
      .find('input')
      .should('be.focused')
      .type('Glass Harbor Timeline');
    cy.contains('button', 'Edit Markdown').click();
    cy.get('textarea').clear().type(
      [
        'The Glass Harbor was founded after the lantern guild vanished.',
        '',
        'Timeline:',
        '- The first beacon failed at midnight.'
      ].join('\n')
    );
    cy.contains('button', 'Create Source Note').click();
    cy.contains(
      '[role="status"]',
      'Source Note created. Saved as general project source material.'
    ).should('be.visible');
    cy.contains('article', 'Glass Harbor Timeline').within(() => {
      cy.contains('0 pending').should('be.visible');
      cy.contains('0 accepted').should('be.visible');
      cy.contains('button', 'Edit').should('be.visible');
      cy.contains('button', 'Delete').should('be.visible');
    });

    cy.contains('article', 'Glass Harbor Timeline').within(() => {
      cy.contains('button', 'Delete').click();
    });
    cy.contains('[role="dialog"]', 'Delete Source Note "Glass Harbor Timeline"?')
      .should('be.visible')
      .within(() => {
        cy.contains('button', 'Delete').click();
      });
    cy.contains('[role="status"]', 'Source Note deleted.').should('be.visible');
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
    cy.contains(
      '[role="status"]',
      'Imported "mira-voss-dossier.md". Add document context links if useful, then save the Source Note.'
    ).should('be.visible');
    cy.contains('label', 'Title').find('input').should('have.value', 'mira-voss-dossier');
    cy.get('[role="textbox"][contenteditable]').should('contain.text', 'Character Sheet: Mira Voss');
    cy.contains('button', 'Create Source Note').click();
    cy.contains(
      '[role="status"]',
      'Source Note created. Saved as general project source material.'
    ).should('be.visible');

    cy.contains('article', 'mira-voss-dossier').within(() => {
      cy.contains('button', 'Edit').click();
    });
    cy.contains('button', 'Extract Candidates').click();
    cy.contains('[role="status"]', /Extracted \d+ entity proposal/).should('be.visible');
    cy.contains('article', 'mira-voss-dossier').within(() => {
      cy.contains(/\d+ pending/).should('be.visible');
      cy.contains('0 accepted').should('be.visible');
      cy.contains('button', 'Edit').click();
    });

    cy.contains('h2', 'Extraction Review').should('be.visible');
    cy.contains(
      'Source Note text is not canon by itself. These local candidates do not change the World Bible or accepted canon until you explicitly accept one; an accepted candidate can then become a World Bible record or canon fact.'
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

  it('shows imported Markdown formatted, with its tables, and edits the Markdown on request', () => {
    cy.visit('/lore');
    cy.get('input[type="file"]').selectFile(
      {
        contents: Cypress.Buffer.from(
          [
            '# Camila Garcia deTerra',
            '',
            '- **Age:** Mid-30s',
            '- *Occupation:* Harbor archivist',
            '',
            '| Trait | Value |',
            '| --- | --- |',
            '| Height | Tall |'
          ].join('\n')
        ),
        fileName: 'camila.md',
        mimeType: 'text/markdown'
      },
      {force: true}
    );

    cy.get('[role="textbox"][contenteditable]').within(() => {
      cy.contains('h1', 'Camila Garcia deTerra').should('be.visible');
      cy.contains('li strong', 'Age:').should('be.visible');
      cy.contains('th', 'Trait').should('be.visible');
      cy.contains('td', 'Tall').should('be.visible');
      cy.contains('**').should('not.exist');
    });

    cy.contains('button', 'Edit Markdown').click();
    cy.get('textarea').should('contain.value', '- **Age:** Mid-30s');
    cy.contains('button', 'Create Source Note').click();
    cy.contains('[role="status"]', 'Source Note created.').should('be.visible');

    cy.contains('article', 'camila').within(() => {
      cy.contains('button', 'Edit').click();
    });
    cy.get('[role="textbox"][contenteditable]').contains('td', 'Tall').should('be.visible');
  });

  it('writes a note in the visual editor and saves it as Markdown', () => {
    const editor = '[role="textbox"][contenteditable]';
    cy.visit('/lore');
    cy.contains('button', 'Start Writing').click();
    cy.contains('label', 'Title').find('input').type('Visual Note');

    cy.get(editor).click().type('Harbor families');
    cy.get('select[aria-label="Block style"]').select('Heading 2');
    cy.get(editor).type('{end}{enter}The ');
    cy.contains('[role="toolbar"] button', 'Bold').click();
    cy.get(editor).type('Lantern');
    cy.contains('[role="toolbar"] button', 'Bold').click();
    cy.get(editor).type(' house keeps the ledger.{enter}');
    cy.contains('[role="toolbar"] button', 'Insert table').click();
    cy.get(editor).type('Family{rightarrow}Seat');
    cy.contains('[role="toolbar"] button', 'Add row').should('be.visible');

    cy.contains('button', 'Create Source Note').click();
    cy.contains('[role="status"]', 'Source Note created.').should('be.visible');
    cy.contains('article', 'Visual Note').within(() => {
      cy.contains('button', 'Edit').click();
    });
    cy.get(editor).within(() => {
      cy.contains('h2', 'Harbor families').should('be.visible');
      cy.contains('strong', 'Lantern').should('be.visible');
      cy.contains('th', 'Family').should('be.visible');
    });
    cy.contains('button', 'Edit Markdown').click();
    cy.get('textarea')
      .should('contain.value', '## Harbor families')
      .and('contain.value', 'The **Lantern** house keeps the ledger.')
      .and('contain.value', '| Family | Seat |   |');
  });

  it('creates and opens a linked Source Note from a World Bible record', () => {
    cy.visit('/world-bible');
    cy.contains('button', 'Locations').click();
    cy.get('section[aria-label="Locations canon"]').within(() => {
      cy.contains('button', 'Create Manually').click();
    });
    cy.contains('h2', 'New Location').should('be.visible');
    cy.contains('label', 'Name').find('input').type('Crystal Vault');
    cy.contains('button', /Create (Entry|Canon Record)/).click();
    cy.contains('[role="status"]', 'Entry created.').should('be.visible');

    cy.contains('li', 'Crystal Vault').within(() => {
      cy.contains('button', 'Create linked Source Note').click();
    });
    cy.location('pathname').should('eq', '/lore');
    cy.contains('h2', 'Edit Source Note').should('be.visible');
    cy.contains('label', 'Title').find('input').should('have.value', 'Crystal Vault Dossier');
    cy.get('[role="textbox"][contenteditable]').should('contain.text', 'Crystal Vault source notes');
    cy.contains('option', 'Crystal Vault (World Bible)')
      .parent('select')
      .find('option:selected')
      .should('have.text', 'Crystal Vault (World Bible)');

    cy.visit('/world-bible');
    cy.contains('button', 'Locations').click();
    cy.contains('li', 'Crystal Vault').within(() => {
      cy.contains('Source Note:').should('be.visible');
      cy.contains('Crystal Vault Dossier').should('be.visible');
      cy.contains('button', 'Open Source Note').click();
    });
    cy.location('pathname').should('eq', '/lore');
    cy.contains('h2', 'Edit Source Note').should('be.visible');
    cy.contains('label', 'Title').find('input').should('have.value', 'Crystal Vault Dossier');
  });

  it('accepts extracted facts into canon for multiple linked World Bible records', () => {
    const createLinkedDocument = (params: {
      title: string;
      target: string;
      content: string;
    }) => {
      cy.contains('button', 'Start Writing').click();
      cy.contains('label', 'Title').find('input').clear().type(params.title);
      cy.contains('button', 'Add context link').click();
      cy.contains('option', `${params.target} (World Bible)`)
        .parent('select')
        .select(`${params.target} (World Bible)`);
      cy.contains('button', 'Edit Markdown').click();
      cy.get('textarea').clear().type(params.content);
      cy.contains('button', 'Create Source Note').click();
      cy.contains(
        '[role="status"]',
        'Source Note created. Linked to 1 canon target.'
      ).should('be.visible');
      cy.contains('article', params.title).within(() => {
        cy.contains('1 linked').should('be.visible');
      });
    };

    const extractAndAcceptFact = (params: {
      title: string;
      evidence: string;
      acceptedSummary: string;
    }) => {
      cy.contains('article', params.title).within(() => {
        cy.contains('button', 'Edit').click();
      });
      cy.contains('button', 'Extract Candidates').click();
      cy.contains('[role="status"]', /Extracted \d+ entity proposal/).should('be.visible');
      cy.contains('article', params.title).within(() => {
        cy.contains(/\d+ pending/).should('be.visible');
        cy.contains('button', 'Edit').click();
      });
      cy.contains('h2', 'Extraction Review')
        .parents('[class*="reviewCard"]')
        .within(() => {
          cy.contains('article', params.evidence).within(() => {
            cy.contains('button', 'Accept').click();
          });
        });
      cy.contains('[role="status"]', 'Fact accepted into canon.').should('be.visible');
      cy.contains('h2', 'Extraction Review')
        .parents('[class*="reviewCard"]')
        .within(() => {
          cy.contains('h3', 'Accepted Canon').parent().parent().within(() => {
            cy.contains(params.acceptedSummary).should('be.visible');
          });
        });
      cy.contains('button', 'Start Another Note').click();
      cy.contains('article', params.title).within(() => {
        cy.contains('1 accepted').should('be.visible');
      });
    };

    cy.visit('/lore');

    createLinkedDocument({
      title: 'Ember Archive Field Notes',
      target: 'Ember Archive',
      content: [
        'Background: Founded after the first beacon failed.',
        'Also known as Fire Stacks.',
        'Ember Archive is from Glass Harbor.'
      ].join('\n')
    });

    createLinkedDocument({
      title: 'Iron Sword Dossier',
      target: 'Iron Sword',
      content: [
        'Background: A ritual blade used by the first watch.',
        'Special Traits:',
        '- It is unbreakable in salt fog.'
      ].join('\n')
    });

    extractAndAcceptFact({
      title: 'Ember Archive Field Notes',
      evidence: 'Background: Founded after the first beacon failed.',
      acceptedSummary: 'Ember Archive background: Founded after the first beacon failed.'
    });

    extractAndAcceptFact({
      title: 'Iron Sword Dossier',
      evidence: 'Background: A ritual blade used by the first watch.',
      acceptedSummary: 'Iron Sword background: A ritual blade used by the first watch.'
    });
  });

  it('keeps inferred fact targets editable and accepts only the selected World Bible record', () => {
    cy.visit('/lore');
    cy.contains('button', 'Start Writing').click();
    cy.contains('label', 'Title').find('input').type('Retargeting Check');
    cy.contains('button', 'Add context link').click();
    cy.contains('option', 'Ember Archive (World Bible)')
      .parent('select')
      .select('Ember Archive (World Bible)');
    cy.contains('button', 'Edit Markdown').click();
    cy.get('textarea').type('Background: A deliberately retargeted fact.');
    cy.contains('button', 'Create Source Note').click();

    cy.contains('article', 'Retargeting Check').within(() => {
      cy.contains('button', 'Edit').click();
    });
    cy.contains('button', 'Extract Candidates').click();
    cy.contains('[role="status"]', /and \d+ fact proposal/).should('be.visible');
    cy.contains('article', 'Retargeting Check').within(() => {
      cy.contains('button', 'Edit').click();
    });

    cy.contains('article', 'Background: A deliberately retargeted fact.').within(() => {
      cy.contains('label', 'World Bible target')
        .find('select')
        .should('have.value', 'entity:entity-ember-archive')
        .select('Iron Sword');
      cy.contains('button', 'Accept').click();
    });
    cy.contains('[role="status"]', 'Fact accepted into canon.').should('be.visible');
    cy.contains('h3', 'Accepted Canon').parent().parent().within(() => {
      cy.contains('Iron Sword background: A deliberately retargeted fact.').should('be.visible');
      cy.contains('Ember Archive background: A deliberately retargeted fact.').should('not.exist');
      cy.contains('article', 'Iron Sword background: A deliberately retargeted fact.')
        .contains('button', 'Remove')
        .click();
    });
    cy.contains('[role="dialog"]', 'Remove this accepted fact from canon?').within(() => {
      cy.contains('button', 'Remove').click();
    });
    cy.contains('[role="status"]', 'Accepted fact removed.').should('be.visible');
    cy.contains('article', 'Background: A deliberately retargeted fact.').within(() => {
      cy.contains('label', 'World Bible target')
        .find('option:selected')
        .should('have.text', 'Iron Sword');
      cy.contains('button', 'Accept').should('be.enabled');
    });
  });

  it('refreshes an unresolved fact target after accepting its sibling entity', () => {
    cy.visit('/lore');
    cy.contains('button', 'Start Writing').click();
    cy.contains('label', 'Title').find('input').type('Odessa Dossier');
    cy.contains('button', 'Edit Markdown').click();
    cy.get('textarea').type(
      '# Character Dossier — Odessa Vane-Kir{enter}{enter}' +
      'Odessa Vane-Kir, the senior broker, is called Dess by those she trusts.'
    );
    cy.contains('button', 'Create Source Note').click();
    cy.contains('article', 'Odessa Dossier').within(() => {
      cy.contains('button', 'Edit').click();
    });
    cy.contains('button', 'Extract Candidates').click();
    cy.contains('[role="status"]', /Extracted 1 entity proposal and 1 fact proposal/)
      .should('be.visible');
    cy.contains('article', 'Odessa Dossier').within(() => {
      cy.contains('button', 'Edit').click();
    });

    cy.contains('article', 'Dess').within(() => {
      cy.contains('button', 'Resolve Entities First').should('be.disabled');
      cy.contains('label', 'World Bible target').find('select').should('have.value', '');
    });
    cy.contains('article', 'Odessa Vane-Kir').within(() => {
      cy.contains('button', 'Accept').click();
    });
    cy.contains('[role="status"]', '"Odessa Vane-Kir" created from lore.').should('be.visible');

    cy.contains('article', 'Dess').within(() => {
      cy.contains('label', 'World Bible target')
        .find('option:selected')
        .should('have.text', 'Odessa Vane-Kir');
      cy.contains('button', 'Accept').should('be.enabled').click();
    });
    cy.contains('[role="status"]', 'Fact accepted into canon.').should('be.visible');
    cy.contains('h3', 'Accepted Canon').parent().parent().within(() => {
      cy.contains('Odessa Vane-Kir alias: Dess').should('be.visible');
    });
  });
});
