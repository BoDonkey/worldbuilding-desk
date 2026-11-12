import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

// Slices 4.27a–b: a General Fiction character with no sheet carries place
// and item state from prose, the selection menu, and the scene drawer
// through review findings and the World Bible Continuity overview.

const DEFAULT_SCENES: Array<[string, string, string]> = [
  ['scene-alpha', 'Alpha Scene', 'Sera entered Highmoor.'],
  ['scene-beta', 'Beta Scene', 'Sera waited at South Harbor.']
];

function seedGeneralFictionCharacter(
  scenes: Array<[string, string, string]> = DEFAULT_SCENES
): Cypress.Chainable<void> {
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
      scenes.forEach(([id, title, content], index) => {
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
  });

  it('suggests a move from prose, records it on accept, and flags a later contradiction', () => {
    seedGeneralFictionCharacter();
    cy.reload();
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
        // "Highmoor" names exactly one place record, so the move links to it (4.77).
        {type: 'location_set', actorId: 'entity-sera', locationName: 'Highmoor', placeId: 'place-highmoor'}
      ]);
    });

    cy.contains('button', 'Run project review').click();
    cy.contains('Project review found').should('be.visible');
    cy.contains('Sera is described at South Harbor').should('be.visible');
    cy.contains('places them at Highmoor').should('be.visible');
  });

  it('records a picked-up item and a move, then shows both in the Continuity overview', () => {
    // Wide enough that the open context drawer leaves the change dialog clear.
    cy.viewport(1440, 900);
    seedGeneralFictionCharacter([
      ['scene-alpha', 'Alpha Scene', 'Sera picked up the brass key.'],
      ['scene-beta', 'Beta Scene', 'The tide turned.']
    ]);
    cy.reload();
    cy.visit('/workspace');
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');

    // The selection menu's item capture works for a character with no sheet.
    cy.get('.ProseMirror').click().type('{selectall}');
    cy.get('.ProseMirror').trigger('contextmenu');
    cy.contains('button', 'Record item/state').click();
    cy.get('[role="dialog"][aria-label="Add selected item to inventory"]').within(() => {
      cy.get('input').filter('[value="brass key"]').should('exist');
      cy.contains('label', 'Character').find('select').should('have.value', 'entity-sera');
      cy.contains('button', 'Add at selection').click();
    });
    cy.contains("Added brass key to Sera's inventory.").should('be.visible');

    // The scene drawer records a move for her; only place and item changes apply.
    cy.get('.ProseMirror').click().type('{end}', {delay: 0});
    cy.contains('button', 'Context').click();
    cy.contains('button', /^Scene$/).click();
    cy.contains('button', 'Ending').click();
    cy.contains('article', 'Sera').within(() => {
      cy.contains('summary', 'Place and items at this moment').click();
      cy.contains('brass key').should('be.visible');
      cy.contains('button', 'Record change here').click();
    });
    cy.get('[role="dialog"][aria-label="Record positioned state change"]').within(() => {
      cy.contains('label', 'Type').find('select option').then((options) => {
        const labels = [...options].map((option) => option.textContent ?? '');
        expect(labels).to.include('Set location');
        expect(labels.some((label) => /stat|resource/i.test(label))).to.eq(false);
      });
      cy.contains('label', 'Location').find('input').type('Highmoor');
      cy.contains('button', 'Confirm scene change').click();
    });
    cy.contains(/Recorded .* at cursor position/).should('be.visible');

    readStateEvents().then((events) => {
      const commands = events
        .filter((event) => event.status === 'accepted')
        .flatMap((event) => event.commands);
      // IndexedDB returns events in random-id order, so compare as a set.
      const recorded = commands
        .map((command) => [command.type, command.actorId])
        .sort(([a], [b]) => a.localeCompare(b));
      expect(recorded).to.deep.equal([
        ['inventory_add', 'entity-sera'],
        ['location_set', 'entity-sera']
      ]);
    });

    // Her World Bible record shows where she is now and what she holds.
    cy.contains('article', 'Sera').contains('button', 'Sera').click();
    cy.location('pathname').should('eq', '/world-bible');
    cy.contains('[role="tab"]', 'Continuity').click();
    cy.get('section[aria-label="Current place and items"]').within(() => {
      cy.contains('Highmoor').should('be.visible');
      cy.contains('brass key').should('be.visible');
    });
  });
});
