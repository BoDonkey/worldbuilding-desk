const DB_NAME = 'worldbuilding-db';
const DB_VERSION = 24;

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
    cy.contains('[role="status"]', 'Corkboard saved').should('be.visible');

    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('button', /^Corkboard$/).first().click();
    cy.get('[role="dialog"][aria-label="Project corkboard"]').within(() => {
      cy.get('input[value="Moonlit Betrayal"]').should('be.visible');
      cy.contains('textarea', 'The alliance breaks at the river crossing.').should('be.visible');
    });
  });
});
