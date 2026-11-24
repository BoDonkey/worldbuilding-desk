import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

const PROJECT_ID = 'cypress-project-1';

function withDb<T>(work: (db: IDBDatabase) => Promise<T>): Cypress.Chainable<T> {
  return cy.window().then((win) => new Cypress.Promise<T>((resolve, reject) => {
    const request = win.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      work(db).then(
        (value) => {db.close(); resolve(value);},
        (error) => {db.close(); reject(error);}
      );
    };
  }));
}

const readAll = <T>(db: IDBDatabase, storeName: string): Promise<T[]> => new Promise((resolve, reject) => {
  const request = db.transaction([storeName], 'readonly').objectStore(storeName).getAll();
  request.onsuccess = () => resolve(request.result as T[]);
  request.onerror = () => reject(request.error);
});

function seedCast(db: IDBDatabase): Promise<void> {
  const now = Date.now();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['entityCategories', 'entities', 'consistency_aliases'], 'readwrite');
    tx.objectStore('entityCategories').put({
      id: 'characters', projectId: PROJECT_ID, kind: 'character', name: 'Characters', slug: 'characters',
      fieldSchema: [{key: 'description', label: 'Description', type: 'textarea'}], createdAt: now
    });
    for (const [id, name] of [['entity-mira', 'Mira Voss'], ['entity-tobin', 'Tobin Hale'], ['entity-wren', 'Wren Adair']]) {
      tx.objectStore('entities').put({
        id, projectId: PROJECT_ID, categoryId: 'characters', name,
        fields: {description: `<p>${name} description.</p>`}, links: [], createdAt: now, updatedAt: now
      });
    }
    tx.objectStore('consistency_aliases').put({
      id: 'alias-wren', projectId: PROJECT_ID, targetType: 'entity', targetId: 'entity-wren',
      alias: 'The Lamplighter', createdAt: now, updatedAt: now
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

describe('Character packages: export a chosen set (4.87)', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    withDb(seedCast);
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('exports two of three characters and imports only those two into another project', () => {
    cy.visit('/character-packages');
    cy.contains('p', 'copies characters into another project').should('contain', 'Parent project');
    cy.contains('h2', 'Choose characters to export').should('be.visible');

    // Search finds a character by alias.
    cy.contains('label', 'Search characters').find('input').type('lamplighter');
    cy.get('ul[aria-label="World Bible characters"] li').should('have.length', 1).and('contain', 'Wren Adair');
    cy.contains('label', 'Wren Adair').find('input[type="checkbox"]').check();
    cy.contains('label', 'Search characters').find('input').clear();
    cy.contains('label', 'Mira Voss').find('input[type="checkbox"]').check();
    cy.contains('[role="status"]', '2 of 3 selected').should('be.visible');

    const blobs: Blob[] = [];
    cy.window().then((win) => {
      cy.stub(win.URL, 'createObjectURL').callsFake((blob: Blob) => {
        blobs.push(blob);
        return 'blob:cypress-character-export';
      });
    });
    cy.contains('button', 'Export selected').click();
    cy.contains('2 characters exported.').should('be.visible');

    cy.wrap(null).then(() => {
      expect(blobs).to.have.length(1);
      return blobs[0]!.text();
    }).then((text) => {
      const payload = JSON.parse(text as unknown as string) as {data: {entities: {name: string}[]}};
      expect(payload.data.entities.map((entity) => entity.name).sort()).to.deep.equal(['Mira Voss', 'Wren Adair']);

      cy.visit('/projects');
      cy.contains('label', 'Project Name').find('input').type('Standalone Book');
      cy.contains('button', 'Create Project').click();
      cy.location('pathname').should('eq', '/workspace');
      cy.visit('/character-packages');
      cy.contains('h1', 'Character packages').should('be.visible');
      cy.get('input[type="file"][accept=".json,application/json"]').selectFile(
        {contents: Cypress.Buffer.from(text as unknown as string), fileName: 'cast.json', mimeType: 'application/json'},
        {force: true}
      );
      cy.contains('Imported').should('be.visible');
    });

    withDb(async (db) => {
      const projects = await readAll<{id: string; name: string}>(db, 'projects');
      const standalone = projects.find((project) => project.name === 'Standalone Book');
      expect(standalone, 'second project').to.exist;
      const entities = await readAll<{projectId: string; name: string}>(db, 'entities');
      return entities.filter((entity) => entity.projectId === standalone!.id).map((entity) => entity.name).sort();
    }).should('deep.equal', ['Mira Voss', 'Wren Adair']);
  });
});
