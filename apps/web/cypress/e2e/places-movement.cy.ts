import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

/*
 * Slice 4.78: where everyone is at a chosen scene, a character's path, and
 * the two movement findings (a move with no route, a position that names no
 * place record).
 *
 *   Varn ── road ── Kell        Isle (nothing connects to it)
 *     Gilded Gull
 */

const PROJECT = 'cypress-project-1';

const place = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, projectId: PROJECT, categoryId: 'places', name, fields: {}, links: [],
  ...(Object.keys(extra).length > 0 ? {place: extra} : {}),
  createdAt: 10, updatedAt: 10
});

const move = (id: string, order: number, actorId: string, locationName: string, placeId?: string) => ({
  id,
  projectId: PROJECT,
  sceneId: ['scene-alpha', 'scene-beta', 'scene-gamma'][order - 1],
  sceneTitle: ['Alpha Scene', 'Beta Scene', 'Gamma Scene'][order - 1],
  sceneOrder: order,
  scenePosition: 0,
  sourceType: 'manual',
  sourceRevision: 1,
  sourceHash: 'h',
  status: 'accepted',
  commands: [{type: 'location_set', actorId, locationName, placeId}],
  createdAt: order
});

const seed = () => {
  cy.window().then((win) => new Cypress.Promise<void>((resolve, reject) => {
    const now = Date.now();
    const request = win.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(
        ['projectSettings', 'writingDocuments', 'entityCategories', 'entities', 'state_mutation_events'],
        'readwrite'
      );
      const settings = tx.objectStore('projectSettings');
      const settingsRequest = settings.get(`settings-${PROJECT}`);
      settingsRequest.onsuccess = () => settings.put({...settingsRequest.result, projectMode: 'general'});
      [
        ['scene-alpha', 'Alpha Scene', 'Sera drank at the Gilded Gull.'],
        ['scene-beta', 'Beta Scene', 'Kell was loud with traders.'],
        ['scene-gamma', 'Gamma Scene', 'The Isle was cold. Gulls cried overhead.']
      ].forEach(([id, title, content], index) => {
        tx.objectStore('writingDocuments').put({
          id, projectId: PROJECT, title, content: `<p>${content}</p>`,
          createdAt: now + index, updatedAt: now + index
        });
      });
      tx.objectStore('entityCategories').put({
        id: 'characters', projectId: PROJECT, kind: 'character', name: 'Characters',
        slug: 'characters', fieldSchema: [], createdAt: 1
      });
      tx.objectStore('entityCategories').put({
        id: 'places', projectId: PROJECT, kind: 'general', name: 'Places',
        slug: 'places', fieldSchema: [], createdAt: 2
      });
      [
        place('place-varn', 'Varn', {connections: [{id: 'road', toId: 'place-kell', kind: 'road'}]}),
        place('place-gull', 'Gilded Gull', {parentId: 'place-varn'}),
        place('place-kell', 'Kell'),
        place('place-isle', 'Isle'),
        {id: 'entity-sera', projectId: PROJECT, categoryId: 'characters', name: 'Sera', fields: {}, links: [], createdAt: 10, updatedAt: 10},
        {id: 'entity-tam', projectId: PROJECT, categoryId: 'characters', name: 'Tam', fields: {}, links: [], createdAt: 10, updatedAt: 10}
      ].forEach((record) => tx.objectStore('entities').put(record));
      [
        move('sera-1', 1, 'entity-sera', 'Gilded Gull', 'place-gull'),
        move('tam-1', 1, 'entity-tam', 'Old Barn'),
        move('sera-2', 2, 'entity-sera', 'Kell', 'place-kell'),
        move('sera-3', 3, 'entity-sera', 'Isle', 'place-isle')
      ].forEach((event) => tx.objectStore('state_mutation_events').put(event));
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    };
  }));
  cy.reload();
};

const panel = () => cy.get('section[aria-labelledby="where-is-everyone-title"]');
const byPlace = () => cy.get('ul[aria-label="Characters by place"]');

describe('Places: where is everyone and movement checks', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    seed();
  });

  it('shows who is where at a chosen scene and a character path', () => {
    cy.contains('a', 'World Bible').click();
    cy.contains('h1', 'World Bible').should('be.visible');
    cy.contains('button', 'Places').click();

    panel().within(() => {
      cy.contains('h2', 'Where is everyone').should('be.visible');
      byPlace().contains('li', 'Isle').should('contain', 'Sera');
      byPlace().contains('li', 'Old Barn').should('contain', 'Tam').and('contain', 'No place record');

      cy.contains('label', 'At the end of').find('select').select('1. Alpha Scene');
      byPlace().contains('li', 'Gilded Gull').should('contain', 'in Varn').and('contain', 'Sera');
      byPlace().contains('li', 'Isle').should('not.exist');

      cy.get('ol[aria-label="Sera\'s path"] li').then((stops) => {
        expect([...stops].map((stop) => stop.querySelector('strong')?.textContent))
          .to.deep.eq(['Gilded Gull', 'Kell', 'Isle']);
      });
      cy.contains('label', 'From scene').find('select').select('2. Beta Scene');
      cy.get('ol[aria-label="Sera\'s path"] li').should('have.length', 2);

      cy.contains('label', 'Character').find('select').select('Tam');
      cy.contains('label', 'From scene').find('select').select('1. Alpha Scene');
      cy.get('ol[aria-label="Tam\'s path"]').within(() => {
        cy.contains('li', 'Old Barn').contains('button', '1. Alpha Scene').click();
      });
    });
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');
  });

  it('follows the scene list when scenes move and are deleted (slice 3.38)', () => {
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('button', 'Scenes').click();

    // Gamma (Sera to the Isle) moves ahead of Beta (Sera to Kell).
    cy.get('button[aria-label="Move Gamma Scene earlier"]').click();
    cy.contains('[role="status"]', 'Scene order updated.').should('exist');

    // Alpha holds two accepted moves; deleting it invalidates them.
    cy.contains('li', 'Alpha Scene').contains('button', 'Delete').click();
    cy.contains('[role="dialog"]', 'Delete "Alpha Scene"?')
      .should('contain', 'It holds 2 accepted state changes')
      .within(() => cy.contains('button', 'Delete').click());
    cy.contains('[role="status"]', 'Scene deleted.').should('exist');

    cy.contains('a', 'World Bible').click();
    cy.contains('h1', 'World Bible').should('be.visible');
    cy.contains('button', 'Places').click();
    panel().within(() => {
      cy.contains('label', 'At the end of').find('select').select('1. Gamma Scene');
      byPlace().contains('li', 'Isle').should('contain', 'Sera');
      byPlace().contains('li', 'Gilded Gull').should('not.exist');
      byPlace().contains('li', 'Old Barn').should('not.exist');

      cy.contains('label', 'At the end of').find('select').select('2. Beta Scene');
      byPlace().contains('li', 'Kell').should('contain', 'Sera');

      cy.get('ol[aria-label="Sera\'s path"] li').then((stops) => {
        expect([...stops].map((stop) => stop.querySelector('strong')?.textContent))
          .to.deep.eq(['Isle', 'Kell']);
      });
    });
  });

  it('flags a move with no route and a position with no place record', () => {
    cy.visit('/workspace');
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');
    cy.get('button[aria-label^="Open review drawer"]').click();
    cy.contains('button', 'Run project review').click();
    cy.contains('Project review found').should('be.visible');

    // Varn to Kell follows the road; Kell to Isle has no route and no travel cue.
    cy.contains('li', 'Move with no route')
      .should('contain', 'Sera moves from Kell to Isle')
      .and('contain', 'Gamma Scene');
    cy.contains('moves from Gilded Gull to Kell').should('not.exist');

    cy.contains('li', 'Unknown place')
      .should('contain', 'position "Old Barn" names no place record')
      .within(() => cy.contains('button', 'Link or create place').click());
    cy.contains('h1', 'World Bible').should('be.visible');
    cy.get('section[aria-labelledby="place-position-queue-title"]')
      .contains('li', 'Old Barn')
      .should('be.visible');
  });
});
