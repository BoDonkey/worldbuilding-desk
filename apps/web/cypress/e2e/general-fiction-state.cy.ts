import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

// Slice 4.27a: a General Fiction character with no sheet carries location
// state from prose suggestion through review findings.

function seedGeneralFictionCharacter(): Cypress.Chainable<void> {
  return cy.window().then((win) => new Cypress.Promise<void>((resolve, reject) => {
    const now = Date.now();
    const request = win.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(
        ['projectSettings', 'writingDocuments', 'entityCategories', 'entities'],
        'readwrite'
      );
      const settings = tx.objectStore('projectSettings');
      const settingsRequest = settings.get('settings-cypress-project-1');
      settingsRequest.onsuccess = () => settings.put({
        ...settingsRequest.result,
        projectMode: 'general',
        featureToggles: {
          enableGameSystems: false,
          enableRuntimeModifiers: false,
          enableSettlementAndZoneSystems: false,
          enableRuleAuthoring: false
        }
      });
      const documents = tx.objectStore('writingDocuments');
      [
        ['scene-alpha', 'Alpha Scene', 'Sera entered Highmoor.'],
        ['scene-beta', 'Beta Scene', 'Sera waited at South Harbor.']
      ].forEach(([id, title, content], index) => {
        documents.put({
          id,
          projectId: 'cypress-project-1',
          title,
          content: `<p>${content}</p>`,
          createdAt: now + index,
          updatedAt: now + index
        });
      });
      documents.delete('scene-gamma');
      tx.objectStore('entityCategories').put({
        id: 'characters', projectId: 'cypress-project-1', kind: 'character',
        name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: now
      });
      tx.objectStore('entities').put({
        id: 'entity-sera', projectId: 'cypress-project-1', categoryId: 'characters',
        name: 'Sera', fields: {}, links: [], createdAt: now, updatedAt: now
      });
      tx.objectStore('entityCategories').put({
        id: 'places', projectId: 'cypress-project-1', kind: 'general',
        name: 'Places', slug: 'places', fieldSchema: [], createdAt: now
      });
      [['place-highmoor', 'Highmoor'], ['place-south-harbor', 'South Harbor']].forEach(([id, name]) => {
        tx.objectStore('entities').put({
          id, projectId: 'cypress-project-1', categoryId: 'places',
          name, fields: {}, links: [], createdAt: now, updatedAt: now
        });
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    };
  }));
}

function readStateEvents(): Cypress.Chainable<Array<{
  status: string;
  sceneId: string;
  commands: Array<{type: string; actorId: string; locationName?: string}>;
}>> {
  return cy.window().then((win) => new Cypress.Promise((resolve, reject) => {
    const request = win.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['state_mutation_events'], 'readonly');
      const eventsRequest = tx.objectStore('state_mutation_events').getAll();
      tx.oncomplete = () => {
        db.close();
        resolve(eventsRequest.result);
      };
      tx.onerror = () => reject(tx.error);
    };
  }));
}

describe('General Fiction descriptive state', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.seedSmokeProjectData();
    seedGeneralFictionCharacter();
    cy.reload();
  });

  it('suggests a move from prose, records it on accept, and flags a later contradiction', () => {
    cy.visit('/workspace');
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');
    // A manual save reviews the scene and derives suggested state changes;
    // autosave does not.
    cy.get('.tiptap-editor').click().type('{end} ', {delay: 0});
    cy.contains('button', 'Save now').click();

    cy.get('button[aria-label^="Open review drawer"]').click();
    cy.contains('Suggested state changes').should('be.visible');
    cy.contains('li', 'Move to Highmoor').within(() => {
      cy.contains('strong', 'Sera').should('be.visible');
      cy.contains('Location: unset -> Highmoor').should('be.visible');
      cy.contains('Ready').should('be.visible');
    });
    cy.contains('button', 'Accept valid (1)').click();
    cy.contains('li', 'Move to Highmoor').should('not.exist');

    readStateEvents().then((events) => {
      const accepted = events.filter((event) => event.status === 'accepted');
      expect(accepted).to.have.length(1);
      expect(accepted[0]?.sceneId).to.equal('scene-alpha');
      expect(accepted[0]?.commands).to.deep.equal([
        {type: 'location_set', actorId: 'entity-sera', locationName: 'Highmoor'}
      ]);
    });

    cy.contains('button', 'Run project review').click();
    cy.contains('Project review found').should('be.visible');
    cy.contains('Sera is described at South Harbor').should('be.visible');
    cy.contains('places them at Highmoor').should('be.visible');
  });
});
