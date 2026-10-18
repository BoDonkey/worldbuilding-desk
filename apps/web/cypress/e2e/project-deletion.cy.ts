import {DB_NAME, DB_VERSION, PROJECT_SCOPED_STORE_NAMES, PROJECT_MIGRATION_BACKUP_STORE_NAME} from '../../src/db';

const projectId = 'cypress-project-1';
const projectName = 'Cypress Smoke Project';

function confirmDeletion() {
  cy.contains('li', projectName).within(() => cy.contains('button', /^Delete$/).click());
  cy.get('[role="dialog"]').within(() => cy.contains('button', /^Delete$/).click());
}

describe('Project deletion integrity', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.visit('/projects');
    cy.contains('strong', projectName).should('be.visible');
  });

  it('removes the project and all its main-store records through the confirmation flow', () => {
    confirmDeletion();
    cy.contains('[role="status"]', 'Project deleted.').should('be.visible');
    cy.contains('strong', projectName).should('not.exist');
    cy.reload();
    cy.contains('strong', projectName).should('not.exist');
    cy.window().then((win) => new Cypress.Promise<void>((resolve, reject) => {
      const open = win.indexedDB.open(DB_NAME, DB_VERSION);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const stores = ['projects', ...PROJECT_SCOPED_STORE_NAMES, PROJECT_MIGRATION_BACKUP_STORE_NAME];
        const tx = db.transaction(stores, 'readonly');
        for (const name of stores) {
          const request = tx.objectStore(name).getAll();
          request.onsuccess = () => {
            expect(request.result.filter((record) =>
              name === 'projects' ? record.id === projectId : record.projectId === projectId
            ), name).to.have.length(0);
          };
        }
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    }));
  });

  it('keeps the project visible when another connection blocks deletion and succeeds on retry', () => {
    let externalConnection: IDBDatabase;
    cy.window().then((win) => new Cypress.Promise<void>((resolve, reject) => {
      const request = win.indexedDB.open(`shodh-memory-${projectId}`, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('memories', {keyPath: 'id'});
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { externalConnection = request.result; resolve(); };
    }));
    confirmDeletion();
    cy.contains('[role="alert"]', 'Close other windows').should('be.visible');
    cy.contains('strong', projectName).should('be.visible');
    cy.then(() => externalConnection.close());
    confirmDeletion();
    cy.contains('[role="status"]', 'Project deleted.').should('be.visible');
    cy.contains('strong', projectName).should('not.exist');
  });
});
