import {DB_NAME, DB_VERSION} from '../../src/db';

function setSeededProjectToGeneralFiction(): Cypress.Chainable<void> {
  return cy.window().then(
    (win) =>
      new Cypress.Promise<void>((resolve, reject) => {
        const openRequest = win.indexedDB.open(DB_NAME, DB_VERSION);
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => {
          const db = openRequest.result;
          const tx = db.transaction(['projectSettings'], 'readwrite');
          const store = tx.objectStore('projectSettings');
          const getRequest = store.get('settings-cypress-project-1');

          getRequest.onerror = () => reject(getRequest.error);
          getRequest.onsuccess = () => {
            store.put({
              ...getRequest.result,
              projectMode: 'general',
              featureToggles: {
                enableGameSystems: false,
                enableRuntimeModifiers: false,
                enableSettlementAndZoneSystems: false,
                enableRuleAuthoring: false
              }
            });
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      })
  );
}

function putRecords<T extends {id: string}>(
  storeName: string,
  records: T[]
): Cypress.Chainable<void> {
  return cy.window().then(
    (win) =>
      new Cypress.Promise<void>((resolve, reject) => {
        const openRequest = win.indexedDB.open(DB_NAME, DB_VERSION);
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => {
          const db = openRequest.result;
          const tx = db.transaction([storeName], 'readwrite');
          const store = tx.objectStore(storeName);
          records.forEach((record) => store.put(record));
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      })
  );
}

function seedUnusedSolutionCandidate(): Cypress.Chainable<void> {
  return putRecords('characters', [
    {
      id: 'character-odessa',
      projectId: 'cypress-project-1',
      name: 'Odessa',
      fields: {},
      createdAt: 1,
      updatedAt: 1
    }
  ]).then(() =>
    putRecords('canonical_facts', [
      {
        id: 'fact-odessa-teleport',
        projectId: 'cypress-project-1',
        targetType: 'character',
        targetId: 'character-odessa',
        factType: 'ability',
        value: 'Teleportation',
        acceptedAt: 1,
        updatedAt: 1
      }
    ])
  ).then(() =>
    putRecords('writingDocuments', [
      {
        id: 'scene-odessa-1',
        projectId: 'cypress-project-1',
        title: 'Odessa Scene One',
        content: 'Odessa crept through the corridor, alert for guards.',
        order: 10,
        createdAt: 1,
        updatedAt: 1
      },
      {
        id: 'scene-odessa-2',
        projectId: 'cypress-project-1',
        title: 'Odessa Scene Two',
        content: 'Odessa paused at the locked gate, unsure how to cross.',
        order: 11,
        createdAt: 2,
        updatedAt: 2
      },
      {
        id: 'scene-odessa-3',
        projectId: 'cypress-project-1',
        title: 'Odessa Scene Three',
        content: 'Odessa waited in the shadows until the patrol passed.',
        order: 12,
        createdAt: 3,
        updatedAt: 3
      }
    ])
  );
}

describe('Corkboard route', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    setSeededProjectToGeneralFiction();
    cy.reload();
    cy.contains('h2', 'Cypress Smoke Project').should('be.visible');
  });

  it('loads for general fiction and shares cards with the workspace modal', () => {
    cy.visit('/corkboard');
    cy.contains('h1', 'Corkboard').should('be.visible');
    cy.contains('[role="status"]', 'Corkboard ready').should('be.visible');
    cy.contains('button', 'Create first card').click();

    cy.get('input[placeholder="Chapter or sequence title"]').clear().type('Moonlit Betrayal');
    cy.get('textarea[placeholder*="What changes"]').clear().type('The alliance breaks at the river crossing.');
    cy.contains('label', 'Alpha Scene').find('input[type="checkbox"]').check();
    cy.contains('label', 'Beta Scene').find('input[type="checkbox"]').check();
    cy.contains('[role="status"]', 'Corkboard saved').should('be.visible');

    cy.contains('button', 'Story Dashboard').click();
    cy.contains('h2', 'Story observations').should('be.visible');
    cy.contains('h2', 'Scene rhythm').should('be.visible');
    cy.contains('h3', 'Moonlit Betrayal').should('be.visible');
    cy.contains('Progression and co-movement').should('not.exist');
    cy.contains('h2', 'Progression continuity').should('be.visible');
    cy.contains('No unused-solution or abandoned-progression-method candidates').should('be.visible');
    cy.contains('h2', 'Writing coach').should('be.visible');
    cy.contains('button', 'Ask the coach').should('be.visible').and('not.be.disabled');
    cy.viewport(800, 900);
    cy.contains('h2', 'Story observations').should('be.visible');
    cy.contains('h2', 'Chapter rollups').should('be.visible');
    cy.contains('button', 'Alpha Scene').first().click();
    cy.location('pathname').should('eq', '/workspace');
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'Alpha content');

    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.get('button[aria-label="Open quick Corkboard"]').click();
    cy.get('[role="dialog"][aria-label="Project corkboard"]').within(() => {
      cy.get('input[value="Moonlit Betrayal"]').should('be.visible');
      cy.contains('textarea', 'The alliance breaks at the river crossing.').should('be.visible');
    });
  });

  it('shows a progression continuity candidate and persists a dismissal across reload', () => {
    seedUnusedSolutionCandidate();
    cy.reload();
    cy.visit('/corkboard');
    cy.contains('button', 'Story Dashboard').click();
    cy.contains('h2', 'Progression continuity').should('be.visible');
    cy.contains('h3', 'Possible unused solution: Odessa').should('be.visible');
    cy.contains('Teleportation').should('be.visible');

    cy.contains('article', 'Possible unused solution: Odessa')
      .contains('button', 'Dismiss')
      .click();
    cy.contains('h3', 'Possible unused solution: Odessa').should('not.exist');
    cy.contains('All 1 candidate is dismissed.').should('be.visible');

    cy.reload();
    cy.contains('button', 'Story Dashboard').click();
    cy.contains('h2', 'Progression continuity').should('be.visible');
    cy.contains('h3', 'Possible unused solution: Odessa').should('not.exist');
    cy.contains('All 1 candidate is dismissed.').should('be.visible');

    cy.contains('button', 'Restore dismissed').click();
    cy.contains('h3', 'Possible unused solution: Odessa').should('be.visible');
  });
  it('sends the writing coach its craft reference material on a local Ollama run', () => {
    cy.intercept('POST', 'http://localhost:11434/api/chat', {
      statusCode: 200,
      headers: {'content-type': 'application/x-ndjson'},
      body: [
        JSON.stringify({message: {role: 'assistant', content: 'Vary the scene lengths.'}}),
        JSON.stringify({done: true, done_reason: 'stop'})
      ].join('\n')
    }).as('localCoach');
    cy.setSeededProjectProvider('ollama');
    cy.visit('/corkboard');
    cy.contains('h1', 'Corkboard').should('be.visible');
    cy.contains('button', 'Story Dashboard').click();
    // Settings loaded and the Ollama model verified as local before asking.
    cy.contains('Runs on your local model').should('be.visible');
    cy.contains('button', 'Ask the coach').click();

    cy.wait('@localCoach').then(({request}) => {
      const [system] = request.body.messages as Array<{role: string; content: string}>;
      expect(system.role).to.equal('system');
      expect(system.content).to.contain('Relevant context from the project:');
      expect(system.content).to.contain('[Source: Craft reference material, not your canon - ');
    });
    cy.contains('Vary the scene lengths.').should('be.visible');
  });
});
