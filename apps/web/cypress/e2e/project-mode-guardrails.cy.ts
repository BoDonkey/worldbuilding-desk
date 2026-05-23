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

describe('Project mode guardrails', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    setSeededProjectToGeneralFiction();
    cy.reload();
    cy.contains('h2', 'Cypress Smoke Project').should('be.visible');
  });

  it('hides ruleset, sheets, and compendium surfaces for general fiction', () => {
    cy.contains('nav a', 'Ruleset').should('not.exist');
    cy.contains('nav a', 'Compendium').should('not.exist');

    cy.visit('/characters');
    cy.contains('h1', 'Characters').should('be.visible');
    cy.contains('button', 'Create Manually').should('be.visible');
    cy.contains('button', 'Create Manually').click();
    cy.contains('button', 'Sheets').should('not.exist');
    cy.contains('button', 'Export Roster + Sheets').should('not.exist');
    cy.contains('button', 'Import Roster + Sheets').should('not.exist');
    cy.contains('button', 'Open Sheet').should('not.exist');
    cy.contains('span', 'Description')
      .closest('[class*="container"]')
      .find('.tiptap-editor')
      .should('exist');
    cy.contains('span', 'Notes')
      .closest('[class*="container"]')
      .find('.tiptap-editor')
      .should('exist');
    cy.get('form textarea').should('not.exist');

    cy.visit('/ruleset');
    cy.location('pathname').should('eq', '/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
  });

  it('omits ruleset and compendium commands for general fiction', () => {
    cy.visit('/workspace');
    cy.get('body').type('{ctrl}k');
    cy.get('[role="dialog"][aria-label="Command palette"]').should('be.visible');

    cy.contains('button', 'Go to Ruleset').should('not.exist');
    cy.contains('button', 'Go to Compendium').should('not.exist');
    cy.contains('button', 'Workspace: Open Context - Ruleset').should('not.exist');
    cy.contains('button', 'Workspace: Open Context - Compendium').should('not.exist');
  });
});
