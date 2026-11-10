import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

/* Slice 4.76: a location names one parent place and stores connections. */

type StoredEntity = {
  id: string;
  name: string;
  place?: {
    parentId?: string;
    connections?: Array<{toId: string; kind: string; oneWay?: boolean; distance?: {words?: string}; travelTimes?: Array<{mode: string; words?: string}>}>;
  };
};

const readEntities = (): Cypress.Chainable<StoredEntity[]> =>
  cy.window().then(
    (win) =>
      new Cypress.Promise<StoredEntity[]>((resolve, reject) => {
        const openRequest = win.indexedDB.open(DB_NAME, DB_VERSION);
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => {
          const db = openRequest.result;
          const request = db.transaction(['entities'], 'readonly').objectStore('entities').getAll();
          request.onsuccess = () => {
            resolve(request.result as StoredEntity[]);
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

const openLocation = (name: string) => {
  cy.contains('button', 'Locations').click();
  cy.contains('li', name).within(() => {
    cy.contains('button', /^Edit$/).click();
  });
  cy.contains('h2', 'Edit Location').should('be.visible');
  cy.contains('label', 'Name').find('input').should('have.value', name);
};

describe('Places: containment and connections', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.window().its('localStorage').invoke('getItem', 'activeProject').then((value) => {
      const projectId = JSON.parse(String(value)).id as string;
      // Default categories get random ids, so the seeded records need their own.
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
  });

  it('sets a parent and a connection, shows them from both ends, and refuses a cycle', () => {
    openLocation('Ember Archive');
    cy.get('section[aria-label="Place"]').within(() => {
      cy.contains('label', 'Inside').parent().find('select').select('Varn');
      cy.contains('button', 'Add connection').click();
      cy.get('[role="group"][aria-label="Connection 1"]').within(() => {
        cy.contains('label', 'To').find('select').select('Ford');
        cy.contains('label', 'Kind').find('input').clear().type('river');
        cy.get('input[aria-label="Distance in your words"]').type('two days downstream');
        cy.contains('button', 'Add travel time').click();
        cy.get('input[aria-label="Travel mode 1"]').type('by boat');
        cy.get('input[aria-label="Travel time 1 amount"]').type('2');
        cy.get('input[aria-label="Travel time 1 unit"]').type('days');
      });
    });
    cy.contains('button', 'Save Changes').click();
    cy.contains('[role="status"]', 'Entry updated.').should('be.visible');

    readEntities().then((entities) => {
      const archive = entities.find((entity) => entity.name === 'Ember Archive');
      expect(archive?.place?.parentId).to.eq('place-varn');
      expect(archive?.place?.connections).to.have.length(1);
      expect(archive?.place?.connections?.[0]).to.deep.include({toId: 'place-ford', kind: 'river'});
      expect(archive?.place?.connections?.[0].distance).to.deep.eq({words: 'two days downstream'});
      expect(archive?.place?.connections?.[0].travelTimes).to.deep.eq([{mode: 'by boat', amount: 2, unit: 'days'}]);
    });

    // The other end lists the connection and links back to the record that stores it.
    openLocation('Ford');
    cy.get('section[aria-label="Place"]').within(() => {
      cy.contains('li', 'river to Ember Archive — two days downstream; by boat: 2 days').within(() => {
        cy.contains('button', 'Edit on Ember Archive').should('be.visible');
      });
    });
    cy.contains('button', 'Cancel').click();

    // The parent lists what is inside it, and cannot be put inside its own child.
    openLocation('Varn');
    cy.get('section[aria-label="Place"]').within(() => {
      cy.contains('strong', 'Places inside').parent().contains('button', 'Ember Archive').should('be.visible');
      cy.contains('label', 'Inside').parent().find('select option').then((options) => {
        const labels = [...options].map((option) => option.textContent);
        expect(labels).to.include('Ford');
        expect(labels).not.to.include('Ember Archive');
      });
      cy.contains('strong', 'Places inside').parent().contains('button', 'Ember Archive').click();
    });
    cy.contains('label', 'Name').find('input').should('have.value', 'Ember Archive');
    cy.get('section[aria-label="Place"]').within(() => {
      cy.contains('label', 'Inside').parent().find('select').should('have.value', 'place-varn');
      cy.get('[role="group"][aria-label="Connection 1"]').within(() => {
        cy.contains('label', 'Kind').find('input').should('have.value', 'river');
      });
    });
  });

  it('removes a parent and a connection', () => {
    cy.window().its('localStorage').invoke('getItem', 'activeProject').then((value) => {
      const projectId = JSON.parse(String(value)).id as string;
      cy.putIndexedDbRecords('entities', [{
        ...place('place-mill', 'Mill', 12),
        projectId,
        place: {parentId: 'place-varn', connections: [{id: 'conn-1', toId: 'place-ford', kind: 'road'}]}
      }]);
    });
    cy.reload();
    cy.contains('h1', 'World Bible').should('be.visible');
    openLocation('Mill');
    cy.get('section[aria-label="Place"]').within(() => {
      cy.contains('label', 'Inside').parent().find('select').should('have.value', 'place-varn').select('Not inside another place');
      cy.get('[role="group"][aria-label="Connection 1"]').within(() => {
        cy.contains('button', 'Remove connection').click();
      });
      cy.get('[role="group"][aria-label="Connection 1"]').should('not.exist');
    });
    cy.contains('button', 'Save Changes').click();
    cy.contains('[role="status"]', 'Entry updated.').should('be.visible');
    readEntities().then((entities) => {
      expect(entities.find((entity) => entity.name === 'Mill')?.place).to.eq(undefined);
    });
  });
});
