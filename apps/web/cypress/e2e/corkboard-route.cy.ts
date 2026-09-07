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
    cy.contains('h2', 'Writing coach').should('be.visible');
    cy.contains('button', 'Ask the coach').should('be.visible').and('not.be.disabled');
    cy.viewport(800, 900);
    cy.contains('h2', 'Story observations').should('be.visible');
    cy.contains('h2', 'Chapter rollups').should('be.visible');
    cy.contains('button', 'Alpha Scene').first().click();
    cy.location('pathname').should('eq', '/workspace');
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'Alpha content');

    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('button', /^Corkboard$/).first().click();
    cy.get('[role="dialog"][aria-label="Project corkboard"]').within(() => {
      cy.get('input[value="Moonlit Betrayal"]').should('be.visible');
      cy.contains('textarea', 'The alliance breaks at the river crossing.').should('be.visible');
    });
  });
});
