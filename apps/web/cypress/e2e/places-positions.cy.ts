import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

/* Slice 4.77: positions refer to place records; unlinked names go to review. */

type StoredEvent = {
  id: string;
  commands: Array<{type: string; locationName?: string; placeId?: string}>;
};
type StoredEntity = {id: string; name: string};

const readStore = <T,>(storeName: string): Cypress.Chainable<T[]> =>
  cy.window().then(
    (win) =>
      new Cypress.Promise<T[]>((resolve, reject) => {
        const openRequest = win.indexedDB.open(DB_NAME, DB_VERSION);
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => {
          const db = openRequest.result;
          const request = db.transaction([storeName], 'readonly').objectStore(storeName).getAll();
          request.onsuccess = () => {
            resolve(request.result as T[]);
            db.close();
          };
          request.onerror = () => {
            reject(request.error);
            db.close();
          };
        };
      })
  );

const record = (projectId: string, id: string, categoryId: string, name: string, parentId?: string) => ({
  id,
  projectId,
  categoryId,
  name,
  fields: {},
  links: [],
  place: parentId ? {parentId} : undefined,
  createdAt: 10,
  updatedAt: 10
});

const move = (projectId: string, order: number, locationName: string, placeId?: string) => ({
  id: `move-${order}`,
  projectId,
  sceneId: `scene-move-${order}`,
  sceneTitle: `Scene ${order}`,
  sceneOrder: order,
  sourceType: 'manual',
  sourceRevision: 1,
  sourceHash: 'h',
  status: 'accepted',
  commands: [{type: 'location_set', actorId: 'entity-sera', locationName, placeId}],
  createdAt: order
});

const seed = (moves: (projectId: string) => unknown[]) => {
  cy.window().its('localStorage').invoke('getItem', 'activeProject').then((value) => {
    const projectId = JSON.parse(String(value)).id as string;
    // Default categories get random ids, so the seeded records need their own.
    cy.putIndexedDbRecords('entityCategories', [
      {id: 'locations', projectId, kind: 'general', name: 'Locations', slug: 'locations', fieldSchema: [], createdAt: 1},
      {id: 'cast', projectId, kind: 'character', name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: 2}
    ]);
    cy.putIndexedDbRecords('entities', [
      record(projectId, 'place-varn', 'locations', 'Varn'),
      record(projectId, 'place-gull', 'locations', 'Gilded Gull', 'place-varn'),
      record(projectId, 'entity-sera', 'cast', 'Sera')
    ]);
    // Each move belongs to a real scene; a change whose scene is gone is
    // invalidated when the project loads (slice 3.38).
    cy.putIndexedDbRecords('writingDocuments', [1, 2, 3].map((order) => ({
      id: `scene-move-${order}`,
      projectId,
      title: `Scene ${order}`,
      content: '<p></p>',
      order: 100 + order,
      createdAt: 100 + order,
      updatedAt: 100 + order
    })));
    cy.putIndexedDbRecords('state_mutation_events', moves(projectId));
  });
  cy.reload();
  cy.contains('a', 'World Bible').click();
  cy.contains('h1', 'World Bible').should('be.visible');
};

const queueItems = () => cy.get('section[aria-labelledby="place-position-queue-title"] li');

describe('Places: positions refer to place records', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
  });

  it('creates, links, and keeps unlinked position names from the review queue', () => {
    seed((projectId) => [
      move(projectId, 1, 'the old mill'),
      move(projectId, 2, 'Ashford'),
      move(projectId, 3, 'Lantern Row')
    ]);
    cy.contains('button', 'Review').click();

    cy.get('section[aria-labelledby="place-position-queue-title"]').within(() => {
      cy.contains('h2', 'Positions not linked to a place').should('be.visible');
      cy.contains('li', 'the old mill').within(() => {
        cy.contains('button', 'Create place').click();
      });
    });
    cy.contains('Created the place "the old mill"').should('be.visible');

    // The new place now appears in the other cards' place lists, so check card names.
    // `should` retries until the queue re-renders without the created name.
    queueItems().find('strong').should((names) => {
      expect([...names].map((name) => name.textContent)).to.deep.eq(['Ashford', 'Lantern Row']);
    });
    cy.get('section[aria-labelledby="place-position-queue-title"]').within(() => {
      cy.contains('li', 'Ashford').within(() => {
        cy.contains('label', 'Existing place').find('select').select('Varn');
        cy.contains('button', 'Link to place').click();
      });
    });
    cy.contains('written as "Ashford" to Varn').should('be.visible');

    cy.get('section[aria-labelledby="place-position-queue-title"]').within(() => {
      cy.contains('li', 'Lantern Row').within(() => {
        cy.contains('button', 'Keep as text').click();
      });
    });
    cy.get('section[aria-labelledby="place-position-queue-title"]').should('not.exist');

    readStore<StoredEntity>('entities').then((entities) => {
      const mill = entities.find((entity) => entity.name === 'the old mill');
      expect(mill, 'created place').to.exist;
      readStore<StoredEvent>('state_mutation_events').then((events) => {
        const placeIdOf = (id: string) => events.find((event) => event.id === id)?.commands[0].placeId;
        expect(placeIdOf('move-1')).to.eq(mill?.id);
        expect(placeIdOf('move-2')).to.eq('place-varn');
        expect(placeIdOf('move-3')).to.eq(undefined);
      });
    });
  });

  it("shows a linked position by the place's current name", () => {
    seed((projectId) => [move(projectId, 1, 'the tavern', 'place-gull')]);
    cy.contains('button', 'Characters').click();
    cy.contains('li', 'Sera').within(() => {
      cy.contains('button', /^Edit$/).click();
    });
    cy.contains('[role="tab"]', 'Continuity').click();
    cy.get('section[aria-label="Current place and items"]').within(() => {
      cy.contains('Gilded Gull').should('be.visible');
      cy.contains('the tavern').should('not.exist');
    });
  });
});
