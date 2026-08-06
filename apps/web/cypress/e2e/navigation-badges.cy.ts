const DB_NAME = 'worldbuilding-db';
const DB_VERSION = 24;

function seedPendingMechanicsEntries(): Cypress.Chainable<void> {
  return cy.window().then(
    (win) =>
      new Cypress.Promise<void>((resolve, reject) => {
        const now = Date.now();
        const openRequest = win.indexedDB.open(DB_NAME, DB_VERSION);
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => {
          const db = openRequest.result;
          const tx = db.transaction(['compendium_entries'], 'readwrite');
          const store = tx.objectStore('compendium_entries');

          store.put({
            id: 'pending-mechanics-1',
            projectId: 'cypress-project-1',
            name: 'Unfinished Artifact',
            domain: 'artifact',
            needsCompletion: true,
            createdAt: now,
            updatedAt: now
          });
          store.put({
            id: 'pending-mechanics-2',
            projectId: 'cypress-project-1',
            name: 'Unfinished Creature',
            domain: 'beast',
            needsCompletion: true,
            createdAt: now + 1,
            updatedAt: now + 1
          });

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

describe('Navigation pending badges', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    seedPendingMechanicsEntries();
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('keeps the aggregate count visible before opening More at both breakpoints', () => {
    cy.get('nav[aria-label="Primary navigation"]')
      .contains('button', 'More')
      .should('contain.text', '2');

    cy.viewport(760, 900);
    cy.get('nav[aria-label="Mobile navigation"]')
      .find('button[aria-label="Toggle more navigation options, 2 pending mechanics items"]')
      .should('be.visible')
      .and('contain.text', '2');
  });
});
