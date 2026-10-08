import {DB_NAME, DB_VERSION} from '../../src/db';

type StoredCategory = {
  id: string;
  name: string;
  fieldSchema: Array<{key: string; label: string}>;
};
type StoredEntity = {name: string; fields: Record<string, string>};

const readStore = <T,>(storeName: string): Cypress.Chainable<T[]> =>
  cy.window().then(
    (win) =>
      new Cypress.Promise<T[]>((resolve, reject) => {
        const openRequest = win.indexedDB.open(DB_NAME, DB_VERSION);
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => {
          const db = openRequest.result;
          const request = db.transaction([storeName], 'readonly').objectStore(storeName).getAll();
          request.onsuccess = () => {
            resolve(request.result as T[]);
            db.close();
          };
          request.onerror = () => {
            reject(request.error);
            db.close();
          };
        };
      })
  );

const markdownFile = (fileName: string, text: string) => ({
  contents: Cypress.Buffer.from(text),
  fileName,
  mimeType: 'text/markdown'
});

const importDocuments = (files: ReturnType<typeof markdownFile>[]) => {
  cy.get('input[type="file"][accept*=".docx"]').first().selectFile(files, {force: true});
  cy.contains('h2', 'Import Preview').should('be.visible');
};

const destinationFor = (fileName: string, heading: string) =>
  cy.contains('li', fileName).find(`select[aria-label="Destination for ${heading}"]`);

describe('World Bible document import destinations', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('h2', 'Cypress Smoke Project').should('be.visible');
    cy.contains('a', 'World Bible').click();
    cy.contains('h1', 'World Bible').should('be.visible');
  });

  it('lets an open draft reuse a new field planned by another import in the batch', () => {
    cy.contains('[aria-label="World Bible categories"] button', /^Locations$/).click();
    importDocuments([
      markdownFile(
        'harbor.md',
        '# Location Sheet: Harbor\n\n## Tides\nHigh twice daily.\n\n## Climate\nFoggy.'
      ),
      markdownFile('ridge.md', '## Overview\nA bare ridge.\n\n## Weather\nWindy and cold.')
    ]);

    destinationFor('harbor.md', 'Climate')
      .find('option:selected')
      .should('have.text', 'Climate');
    destinationFor('harbor.md', 'Tides')
      .should('have.value', 'keep')
      .select('New field: Tides');
    destinationFor('ridge.md', 'Weather').select('New field: Tides');
    cy.contains('li', 'ridge.md').should(
      'contain.text',
      'Adds a Tides field to Locations and fills it here.'
    );

    cy.contains('li', 'harbor.md').contains('button', 'Import and open').click();
    cy.contains('[role="status"]', 'Imported 1 new entry').should('be.visible');

    // The field now exists, so the open draft points at it instead of planning it.
    destinationFor('ridge.md', 'Weather').find('option:selected').should('have.text', 'Tides');
    cy.contains('li', 'ridge.md').should('contain.text', 'Goes into the Tides field.');
    cy.contains('li', 'ridge.md').contains('button', 'Import and open').click();
    cy.contains('[role="status"]', 'Imported 1 new entry').should('be.visible');

    readStore<StoredCategory>('entityCategories').then((categories) => {
      const locations = categories.find((category) => category.name === 'Locations');
      expect(
        locations?.fieldSchema.filter((field) => field.label === 'Tides')
      ).to.have.length(1);
    });
    readStore<StoredEntity>('entities').then((entities) => {
      const harbor = entities.find((entity) => entity.name === 'Harbor');
      const ridge = entities.find((entity) => entity.name === 'ridge');
      expect(harbor?.fields.tides).to.contain('High twice daily.');
      expect(harbor?.fields.climate).to.contain('Foggy.');
      expect(ridge?.fields.tides).to.contain('Windy and cold.');
      expect(ridge?.fields.description).to.contain('A bare ridge.');
      expect(ridge?.fields.description).not.to.contain('Windy and cold.');
    });
  });

  it('shows a field created by an import on a new, unsaved character', () => {
    cy.contains('[aria-label="World Bible categories"] button', /^Characters$/).click();
    importDocuments([
      markdownFile('mira.md', '# Character Sheet: Mira Holt\n\n## Education\nTaught at home.')
    ]);
    destinationFor('mira.md', 'Education').select('New field: Education');
    cy.contains('li', 'mira.md').contains('button', 'Import and open').click();
    cy.contains('[role="status"]', 'Imported 1 new entry').should('be.visible');

    cy.reload();
    cy.contains('[aria-label="World Bible categories"] button', /^Characters$/).click();
    cy.contains('button', 'Create Manually').click();
    cy.contains('h2', 'New Character Canon').should('be.visible');
    cy.contains('form span', /^Education$/).should('be.visible');
  });

  it('shows what a three-document batch has saved and brings the opened record into view', () => {
    cy.contains('[aria-label="World Bible categories"] button', /^Locations$/).click();
    importDocuments([
      markdownFile('alder.md', 'Alder is a mill town.'),
      markdownFile('birch.md', 'Birch is a ford.'),
      markdownFile('cedar.md', 'Cedar is a watchtower.')
    ]);

    cy.contains('Nothing is saved to the project until a draft is imported.').should('be.visible');
    cy.get('[aria-label="Import status"]').should('contain.text', '3 drafts waiting · 0 imported');
    cy.contains('li', 'alder.md').contains('button', 'Import and open').click();

    cy.get('[aria-label="Import status"]').should('contain.text', '2 drafts waiting · 1 imported');
    cy.get('li[aria-label="alder.md: imported"]').within(() => {
      cy.contains('Imported').should('be.visible');
      cy.contains('button', 'Open alder').should('be.visible');
    });
    cy.contains('h2', /^Edit Location$/).should(($heading) => {
      const {top, bottom} = $heading[0].getBoundingClientRect();
      expect(top).to.be.at.least(0);
      expect(bottom).to.be.at.most(Cypress.config('viewportHeight'));
    });

    cy.contains('button', 'Import selected (2)').click();
    cy.get('[aria-label="Import status"]').should('contain.text', '0 drafts waiting · 3 imported');
    readStore<StoredEntity>('entities').then((entities) => {
      const names = entities.map((entity) => entity.name);
      expect(names).to.include.members(['alder', 'birch', 'cedar']);
    });
    cy.get('li[aria-label="birch.md: imported"]').contains('button', 'Open birch').click();
    cy.contains('label', 'Name').find('input').should('have.value', 'birch');

    cy.contains('section', 'Import Preview').contains('button', /^Close$/).click();
    cy.contains('h2', 'Import Preview').should('not.exist');
  });

  it('asks before discarding drafts that were never imported', () => {
    cy.contains('[aria-label="World Bible categories"] button', /^Locations$/).click();
    importDocuments([markdownFile('dune.md', 'Dune is a salt flat.')]);

    cy.contains('button', 'Discard drafts').click();
    cy.contains('[role="dialog"]', 'Discard drafts that are not imported?').within(() => {
      cy.contains('button', 'Discard').click();
    });
    cy.contains('h2', 'Import Preview').should('not.exist');
    readStore<StoredEntity>('entities').then((entities) => {
      expect(entities.map((entity) => entity.name)).not.to.include('dune');
    });
  });
});

describe('Manage Categories dialog', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('a', 'World Bible').click();
    cy.contains('h1', 'World Bible').should('be.visible');
  });

  it('opens as a modal, keeps focus inside, and closes on Escape', () => {
    cy.contains('button', 'Manage Categories').click();
    cy.get('[role="dialog"][aria-modal="true"]')
      .should('be.visible')
      .and('contain.text', 'Manage Categories');
    cy.focused().closest('[role="dialog"]').should('exist');

    cy.contains('[role="dialog"] li', 'Characters').contains('button', 'Edit Fields').click();
    cy.get('[role="dialog"]').should('contain.text', 'Edit Characters fields');
    cy.get('body').type('{esc}');
    cy.get('[role="dialog"]').should('contain.text', 'Manage Categories');
    cy.get('body').type('{esc}');
    cy.get('[role="dialog"]').should('not.exist');
    cy.focused().should('have.text', 'Manage Categories');
  });
});

