import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

/* Slice 4.79: maps with their own unit and scale, places put on maps by number, and distance with its source. */

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

const place = (id: string, name: string, createdAt: number) => ({
  id,
  projectId: 'cypress-smoke-project',
  categoryId: 'locations',
  name,
  fields: {},
  links: [],
  createdAt,
  updatedAt: createdAt
});

const mapsPanel = () => cy.get('section[aria-labelledby="maps-panel-title"]');

const openLocation = (name: string) => {
  cy.contains('li', name).within(() => {
    cy.contains('button', /^Edit$/).click();
  });
  cy.contains('h2', 'Edit Location').should('be.visible');
  cy.contains('label', 'Name').find('input').should('have.value', name);
};

const createMap = (fields: {name: string; unit: string; scale: string; sitsOn?: string; x?: string; y?: string}) => {
  mapsPanel().contains('button', 'New map').click();
  cy.get('form[aria-label="New map"]').within(() => {
    cy.contains('label', 'Name').find('input').type(fields.name);
    cy.contains('label', 'Distance unit').find('input').clear().type(fields.unit);
    cy.contains('label', 'One map unit is').find('input').clear().type(fields.scale);
    if (fields.sitsOn) {
      cy.contains('label', 'Sits on').find('select').select(fields.sitsOn);
      cy.contains('label', /^X/).find('input').type(fields.x ?? '0');
      cy.contains('label', /^Y/).find('input').type(fields.y ?? '0');
    }
    cy.contains('button', 'Save map').click();
  });
  cy.contains(`Saved ${fields.name}.`).should('be.visible');
};

const putOnMap = (mapName: string, x: string, y: string) => {
  cy.get('section[aria-label="Place"]').within(() => {
    cy.contains('button', 'Put on a map').click();
    cy.get('[role="group"][aria-label^="Placement"]').last().within(() => {
      cy.contains('label', 'Map').find('select').select(mapName);
      cy.contains('label', /^X/).find('input').type(x);
      cy.contains('label', /^Y/).find('input').type(y);
    });
  });
};

describe('Maps, placements, and distance', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.window().its('localStorage').invoke('getItem', 'activeProject').then((value) => {
      const projectId = JSON.parse(String(value)).id as string;
      cy.putIndexedDbRecords('entityCategories', [{
        id: 'locations',
        projectId,
        kind: 'general',
        name: 'Locations',
        slug: 'locations',
        fieldSchema: [{key: 'description', label: 'Description', type: 'textarea'}],
        createdAt: 1
      }]);
      cy.putIndexedDbRecords('entities', [
        {...place('place-varn', 'Varn', 10), projectId},
        {...place('place-ford', 'Ford', 11), projectId}
      ]);
    });
    cy.reload();
    cy.contains('a', 'World Bible').click();
    cy.contains('h1', 'World Bible').should('be.visible');
    cy.contains('button', 'Locations').click();
  });

  it('creates nested maps, places records on them, and measures with the source shown', () => {
    createMap({name: 'Region', unit: 'leagues', scale: '0.5'});
    createMap({name: 'Varn city', unit: 'feet', scale: '1', sitsOn: 'Region', x: '60', y: '80'});
    mapsPanel().within(() => {
      cy.contains('li', 'Varn city').should('contain.text', '1 map unit = 1 feet · on Region at (60, 80)');
    });

    // A map cannot sit on a map that sits on it.
    mapsPanel().contains('li', 'Region').contains('button', 'Edit').click();
    cy.get('form[aria-label="Edit map Region"]').within(() => {
      cy.contains('label', 'Sits on').find('select option').then((options) => {
        expect([...options].map((option) => option.textContent)).not.to.include('Varn city');
      });
      cy.contains('button', 'Cancel').click();
    });

    openLocation('Ford');
    putOnMap('Region', '0', '0');
    cy.contains('button', 'Save Changes').click();
    cy.contains('[role="status"]', 'Entry updated.').should('be.visible');

    openLocation('Ember Archive');
    putOnMap('Varn city', '5', '5');
    cy.get('section[aria-label="Place"]').within(() => {
      cy.contains('label', 'Distance to').find('select').select('Ford');
      // The archive is on the city map, which sits at (60, 80) on Region: 100 map units × 0.5.
      cy.get('ul[aria-label="Distance to Ford"]').should('contain.text', 'about 50 leagues — straight line on Region');
    });
    cy.contains('button', 'Save Changes').click();
    cy.contains('[role="status"]', 'Entry updated.').should('be.visible');

    readStore<{name: string; parentPlacement?: {mapId: string; x: number; y: number}}>('maps').then((maps) => {
      const region = maps.find((map) => map.name === 'Region');
      const city = maps.find((map) => map.name === 'Varn city');
      expect(city?.parentPlacement).to.deep.eq({mapId: region?.id, x: 60, y: 80});
    });
    readStore<{name: string; place?: {placements?: Array<{mapId: string; x: number; y: number}>}}>('entities').then((entities) => {
      const archive = entities.find((entity) => entity.name === 'Ember Archive');
      expect(archive?.place?.placements).to.have.length(1);
      expect(archive?.place?.placements?.[0]).to.deep.include({x: 5, y: 5});
    });
  });

  it('measures a place with no map point from the place it is inside', () => {
    cy.window().its('localStorage').invoke('getItem', 'activeProject').then((value) => {
      const projectId = JSON.parse(String(value)).id as string;
      cy.putIndexedDbRecords('maps', [{
        id: 'map-region', projectId, name: 'Region', distanceUnit: 'miles', scale: 1, createdAt: 1, updatedAt: 1
      }]);
      cy.putIndexedDbRecords('entities', [
        {...place('place-varn', 'Varn', 10), projectId, place: {placements: [{mapId: 'map-region', x: 0, y: 0}]}},
        {...place('place-ford', 'Ford', 11), projectId, place: {placements: [{mapId: 'map-region', x: 6, y: 8}]}},
        {...place('place-mill', 'Mill', 12), projectId, place: {parentId: 'place-varn'}}
      ]);
    });
    cy.reload();
    cy.contains('h1', 'World Bible').should('be.visible');
    cy.contains('button', 'Locations').click();

    openLocation('Mill');
    cy.get('section[aria-label="Place"]').within(() => {
      cy.contains('No point of its own yet: distances use the point of Varn').should('be.visible');
      cy.contains('label', 'Distance to').find('select').select('Ford');
      cy.get('ul[aria-label="Distance to Ford"]')
        .should('contain.text', "about 10 miles — straight line on Region (using Varn's point)");
    });
  });

  it('prefers an authored connection and keeps unit conversions', () => {
    mapsPanel().contains('button', 'Edit conversions').click();
    mapsPanel().within(() => {
      cy.get('[role="group"][aria-label="Conversion 1"]').within(() => {
        cy.get('input[aria-label="From unit"]').type('league');
        cy.get('input[aria-label="Factor"]').clear().type('3');
        cy.get('input[aria-label="To unit"]').type('miles');
      });
      cy.contains('button', 'Save conversions').click();
      cy.contains('li', '1 league = 3 miles').should('be.visible');
    });

    openLocation('Varn');
    cy.get('section[aria-label="Place"]').within(() => {
      cy.contains('button', 'Add connection').click();
      cy.get('[role="group"][aria-label="Connection 1"]').within(() => {
        cy.contains('label', 'To').find('select').select('Ford');
        cy.get('input[aria-label="Distance amount"]').type('4');
        cy.get('input[aria-label="Distance unit"]').type('miles');
      });
      cy.contains('label', 'Distance to').find('select').select('Ford');
      cy.get('ul[aria-label="Distance to Ford"]').should('contain.text', '4 miles — authored on the road');
    });
  });
});
