import {DB_NAME, DB_VERSION} from '../../src/db';

function putRecords<T extends {id: string}>(storeName: string, records: T[]): Cypress.Chainable<void> {
  return cy.window().then((win) => new Cypress.Promise<void>((resolve, reject) => {
    const request = win.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction([storeName], 'readwrite');
      records.forEach((record) => tx.objectStore(storeName).put(record));
      tx.oncomplete = () => {db.close(); resolve();};
      tx.onerror = () => {db.close(); reject(tx.error);};
      tx.onabort = () => {db.close(); reject(tx.error);};
    };
  }));
}

describe('Workspace Corkboard scene links', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('links the current scene, caps chips, and restores the same links on the route', () => {
    putRecords('writingDocuments', [{
      id: 'scene-delta', projectId: 'cypress-project-1', title: 'Delta Scene',
      content: '<p>Delta content</p>', order: 3, createdAt: 4, updatedAt: 4
    }]);
    cy.visit('/workspace');
    cy.contains('label', 'Title').find('input').should('have.value', 'Delta Scene');
    cy.contains('button', /^Corkboard$/).first().click();
    cy.get('[role="dialog"][aria-label="Project corkboard"]').within(() => {
      cy.contains('button', 'New Card').click();
      cy.get('input[placeholder="Chapter or sequence title"]').last().type('Linked Chapter');
      cy.get('input[value="Linked Chapter"]').closest('section').within(() => {
        cy.contains('button', 'Link current scene').click();
        cy.contains('summary', 'Manage links').click();
        cy.contains('label', 'Alpha Scene').find('input').check();
        cy.contains('label', 'Beta Scene').find('input').check();
        cy.contains('label', 'Gamma Scene').find('input').check();
        cy.get('[aria-label="Linked scenes"]').within(() => {
          cy.contains('Delta Scene').should('be.visible');
          cy.contains('Alpha Scene').should('be.visible');
          cy.contains('Beta Scene').should('be.visible');
          cy.contains('+1 more').should('be.visible');
        });
        cy.viewport(780, 900);
        cy.contains('button', 'Unlink current scene').should('be.visible');
      });
      cy.window().then((win) => {
        expect(win.document.documentElement.scrollWidth).to.be.at.most(win.innerWidth);
      });
      cy.viewport(1400, 1000);
      cy.contains('Corkboard saved').should('be.visible');
    });
    cy.contains('[role="status"]', 'Linked Delta Scene to Linked Chapter.').should('be.visible');

    cy.reload();
    cy.contains('button', /^Corkboard$/).first().click();
    cy.get('[role="dialog"][aria-label="Project corkboard"]').within(() => {
      cy.get('input[value="Linked Chapter"]').closest('section').within(() => {
        cy.get('[aria-label="Linked scenes"]').should('contain.text', '+1 more');
      });
    });

    cy.visit('/corkboard');
    cy.get('input[value="Linked Chapter"]').should('be.visible');
    cy.get('[aria-label="Draft scenes for Linked Chapter"]').within(() => {
      cy.contains('label', 'Delta Scene').find('input').should('be.checked');
      cy.get('button[aria-label="Open scene Delta Scene"]').click();
    });
    cy.location('pathname').should('eq', '/workspace');
    cy.contains('label', 'Title').find('input').should('have.value', 'Delta Scene');
  });

  it('keeps stale scene links explicit and never deletes scenes with a card', () => {
    putRecords('corkboard_chapter_cards', [{
      id: 'linked-card', projectId: 'cypress-project-1', title: 'Stale Link Chapter',
      summary: '', status: 'planned', order: 0, sceneIds: ['scene-alpha', 'scene-beta'],
      plotPoints: [], createdAt: 1, updatedAt: 1
    }]);
    cy.visit('/workspace');
    cy.contains('button', /^Scenes$/).first().click();
    cy.contains('li', 'Alpha Scene').within(() => cy.contains('button', 'Delete').click());
    cy.get('[role="dialog"]').contains('button', 'Delete').click();
    cy.contains('[role="status"]', 'Scene deleted.').should('be.visible');

    cy.contains('button', /Corkboard/).first().click();
    cy.get('[role="dialog"][aria-label="Project corkboard"]').within(() => {
      cy.get('input[value="Stale Link Chapter"]').closest('section').within(() => {
        cy.contains('Scene no longer exists').should('be.visible');
        cy.contains('button', 'Remove link').click();
      });
      cy.contains('Corkboard saved').should('be.visible');
      cy.contains('button', 'Done').click();
    });

    cy.visit('/corkboard');
    cy.contains('button', 'Story Dashboard').click();
    cy.contains('h3', 'Stale Link Chapter').should('be.visible');
    cy.contains('saved link point to missing scenes').should('not.exist');
    cy.contains('button', 'Planning').click();
    cy.contains('button', 'Delete').click();
    cy.get('[role="dialog"]').contains('button', 'Delete').click();
    cy.contains('Stale Link Chapter').should('not.exist');

    cy.visit('/workspace');
    cy.contains('label', 'Title').find('input').should('have.value', 'Beta Scene');
  });
});
