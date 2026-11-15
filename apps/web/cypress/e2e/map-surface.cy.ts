import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

/*
 * Slice 4.80: a map's image imported, places pinned by click and by
 * keyboard, who is where at a chosen scene, a path, and export as an image.
 *
 *   Varn (Gilded Gull inside) ── Kell        Isle (not pinned)
 */

const PROJECT = 'cypress-project-1';

const place = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, projectId: PROJECT, categoryId: 'places', name, fields: {}, links: [],
  ...(Object.keys(extra).length > 0 ? {place: extra} : {}),
  createdAt: 10, updatedAt: 10
});

const move = (id: string, order: number, actorId: string, locationName: string, placeId: string) => ({
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

const withStores = <T,>(
  storeNames: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction, done: (value: T) => void) => void
): Cypress.Chainable<T> =>
  cy.window().then((win) => new Cypress.Promise<T>((resolve, reject) => {
    const request = win.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(storeNames, mode);
      let result: T;
      work(tx, (value) => { result = value; });
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    };
  }));

const seed = () => {
  withStores<void>(
    ['projectSettings', 'writingDocuments', 'entityCategories', 'entities', 'state_mutation_events', 'maps'],
    'readwrite',
    (tx) => {
      const now = Date.now();
      const settings = tx.objectStore('projectSettings');
      const settingsRequest = settings.get(`settings-${PROJECT}`);
      settingsRequest.onsuccess = () => settings.put({...settingsRequest.result, projectMode: 'general'});
      [['scene-alpha', 'Alpha Scene'], ['scene-beta', 'Beta Scene'], ['scene-gamma', 'Gamma Scene']].forEach(([id, title], index) => {
        tx.objectStore('writingDocuments').put({
          id, projectId: PROJECT, title, content: `<p>${title} text.</p>`, createdAt: now + index, updatedAt: now + index
        });
      });
      tx.objectStore('entityCategories').put({
        id: 'characters', projectId: PROJECT, kind: 'character', name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: 1
      });
      tx.objectStore('entityCategories').put({
        id: 'places', projectId: PROJECT, kind: 'general', name: 'Places', slug: 'places', fieldSchema: [], createdAt: 2
      });
      [
        place('place-varn', 'Varn', {connections: [{id: 'road', toId: 'place-kell', kind: 'road'}]}),
        place('place-gull', 'Gilded Gull', {parentId: 'place-varn'}),
        place('place-kell', 'Kell'),
        place('place-isle', 'Isle'),
        {id: 'entity-sera', projectId: PROJECT, categoryId: 'characters', name: 'Sera', fields: {}, links: [], createdAt: 10, updatedAt: 10}
      ].forEach((record) => tx.objectStore('entities').put(record));
      [
        move('sera-1', 1, 'entity-sera', 'Gilded Gull', 'place-gull'),
        move('sera-2', 2, 'entity-sera', 'Kell', 'place-kell'),
        move('sera-3', 3, 'entity-sera', 'Isle', 'place-isle')
      ].forEach((event) => tx.objectStore('state_mutation_events').put(event));
      tx.objectStore('maps').put({
        id: 'map-region', projectId: PROJECT, name: 'Region', distanceUnit: 'miles', scale: 0.5, createdAt: 1, updatedAt: 1
      });
    }
  );
  cy.reload();
};

type StoredPlace = {id: string; place?: {placements?: Array<{mapId: string; x: number; y: number}>}};
const placementOf = (placeId: string) =>
  withStores<StoredPlace | undefined>(['entities'], 'readonly', (tx, done) => {
    const request = tx.objectStore('entities').get(placeId);
    request.onsuccess = () => done(request.result as StoredPlace | undefined);
  }).then((record) => record?.place?.placements?.find((placement) => placement.mapId === 'map-region'));

/** A 400 × 200 PNG drawn in the browser. */
const mapPng = (): Cypress.Chainable<Cypress.Buffer> =>
  cy.window().then((win) => {
    const canvas = win.document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'rgb(200, 220, 190)';
    context.fillRect(0, 0, 400, 200);
    return Cypress.Buffer.from(canvas.toDataURL('image/png').split(',')[1], 'base64');
  });

const surface = () => cy.get('section[aria-labelledby="map-surface-title"]');
const stage = () => surface().find('img[alt="Region map"]').parent();

const openRegion = () => {
  cy.contains('a', 'World Bible').click();
  cy.contains('h1', 'World Bible').should('be.visible');
  cy.contains('button', 'Places').click();
  cy.get('section[aria-labelledby="maps-panel-title"]').contains('li', 'Region').contains('button', 'Open').click();
  surface().contains('h3', 'Region').should('be.visible');
};

describe('Map surface: image, pins, scene view, export', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    seed();
  });

  it('imports an image within the size limit, pins places by click and keyboard, and exports', () => {
    openRegion();

    // Too large: refused with the limit named, nothing saved.
    surface().find('input[type="file"]').selectFile(
      {contents: Cypress.Buffer.alloc(11 * 1024 * 1024), fileName: 'huge.png', mimeType: 'image/png'},
      {force: true}
    );
    surface().should('contain.text', 'Map images can be up to 10.0 MB');
    surface().find('img').should('not.exist');

    mapPng().then((png) => {
      surface().find('input[type="file"]').selectFile({contents: png, fileName: 'region.png', mimeType: 'image/png'}, {force: true});
    });
    cy.contains('Imported the image of Region.').should('be.visible');
    surface().should('contain.text', 'One pixel is 0.5 miles.');
    surface().find('img[alt="Region map"]').should(($img) => {
      expect(($img[0] as HTMLImageElement).naturalWidth).to.eq(400);
    });

    // Click: Varn at a quarter across, halfway down (100, 100 in image pixels).
    surface().contains('label', 'Pin a place').find('select').select('Varn');
    surface().should('contain.text', 'Click the map to put Varn there.');
    stage().then(($stage) => {
      cy.wrap($stage).click($stage.width()! * 0.25, $stage.height()! * 0.5);
    });
    cy.contains('Pinned Varn.').should('be.visible');
    placementOf('place-varn').then((placement) => {
      expect(placement?.x).to.be.closeTo(100, 2);
      expect(placement?.y).to.be.closeTo(100, 2);
    });

    // Keyboard: Kell at the centre, then right by 1% and by 5% of the shorter side, Enter saves.
    surface().contains('label', 'Pin a place').find('select').select('Kell');
    surface().contains('button', 'Pin at centre').click();
    cy.contains('Pinned Kell.').should('be.visible');
    cy.focused().should('have.attr', 'aria-label').and('match', /^Kell at \(200, 100\)/);
    cy.focused().type('{rightArrow}{shift}{rightArrow}');
    cy.focused().should('have.attr', 'aria-label').and('match', /^Kell at \(212, 100\)/);
    cy.focused().type('{enter}');
    cy.contains('Moved Kell.').should('be.visible');
    placementOf('place-kell').should('deep.equal', {mapId: 'map-region', x: 212, y: 100});

    // Escape puts a moved pin back without saving.
    cy.focused().type('{downArrow}{esc}');
    cy.focused().should('have.attr', 'aria-label').and('match', /^Kell at \(212, 100\)/);

    // Scene switch: Sera is at the Gilded Gull (shown at Varn) after scene 1, at Kell after 2, off the map after 3.
    surface().contains('label', 'Who is where at the end of').find('select').select('1. Alpha Scene');
    surface().find('ul[aria-label="Characters on this map"]').should('contain.text', 'Varn: Sera (in Gilded Gull)');
    surface().find('button[aria-label^="Varn at"]').should('have.attr', 'aria-label').and('contain', '1 here');
    surface().contains('label', 'Who is where at the end of').find('select').select('2. Beta Scene');
    surface().find('ul[aria-label="Characters on this map"]').should('contain.text', 'Kell: Sera');
    surface().contains('label', 'Who is where at the end of').find('select').select('The latest scene');
    surface().find('ul[aria-label="Characters on this map"]').should('contain.text', 'Not on this map: Sera (Isle)');

    surface().contains('label', 'Show the path of').find('select').select('Sera');
    surface().find('svg polyline').should('have.attr', 'points', '100,100 212,100');

    surface().contains('button', 'Export image').click();
    cy.contains('Exported Region as an image.').should('be.visible');
    cy.readFile('cypress/downloads/region-map.png', 'binary', {timeout: 10000}).should((contents: string) => {
      expect(contents.slice(1, 4)).to.eq('PNG');
    });
  });

  it('removes the image and keeps the pins as numbers', () => {
    withStores<void>(['maps', 'entities'], 'readwrite', (tx) => {
      tx.objectStore('maps').put({
        id: 'map-region', projectId: PROJECT, name: 'Region', distanceUnit: 'miles', scale: 0.5, createdAt: 1, updatedAt: 1,
        image: {dataUrl: 'data:image/png;base64,iVBORw0KGgo=', mimeType: 'image/png', width: 400, height: 200, byteLength: 8}
      });
      tx.objectStore('entities').put(place('place-isle', 'Isle', {placements: [{mapId: 'map-region', x: 900, y: 10}]}));
    });
    cy.reload();
    openRegion();

    // A point entered by number outside the image is listed, and can be moved onto it.
    surface().contains('section', 'Outside the image').should('contain.text', 'Isle (900, 10)');

    surface().contains('button', 'Remove image').click();
    cy.contains('[role="dialog"]', 'Remove the image of Region?').contains('button', 'Remove image').click();
    cy.contains('Removed the image of Region.').should('be.visible');
    surface().should('contain.text', 'No image yet.');
    withStores<{image?: unknown} | undefined>(['maps'], 'readonly', (tx, done) => {
      const request = tx.objectStore('maps').get('map-region');
      request.onsuccess = () => done(request.result);
    }).then((map) => expect(map).not.to.have.property('image'));
    placementOf('place-isle').should('deep.equal', {mapId: 'map-region', x: 900, y: 10});
  });

  it('draws a square grid over the image (4.81)', () => {
    mapPng().then((png) => {
      withStores<void>(['maps'], 'readwrite', (tx) => {
        tx.objectStore('maps').put({
          id: 'map-region', projectId: PROJECT, name: 'Region', distanceUnit: 'squares', scale: 0.05,
          grid: {kind: 'square', cellSize: 20}, createdAt: 1, updatedAt: 1,
          image: {dataUrl: `data:image/png;base64,${png.toString('base64')}`, mimeType: 'image/png', width: 400, height: 200, byteLength: png.length}
        });
      });
    });
    cy.reload();
    openRegion();
    surface().should('contain.text', 'Square grid, 20 pixels per cell. Distances are counted in squares.');
    surface().find('svg[data-grid="square"] pattern').should('have.attr', 'width', '20');
    surface().contains('button', 'Export image').click();
    cy.contains('Exported Region as an image.').should('be.visible');
  });
});

