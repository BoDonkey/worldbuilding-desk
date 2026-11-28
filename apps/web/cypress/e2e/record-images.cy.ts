import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

const PROJECT_ID = 'cypress-project-1';
// 40 × 20 red and 30 × 60 blue PNGs.
const FRONT_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAAJElEQVR4nGM4oaExIIhh1OJRi0ctHrV41OJRi0ctHrV45FgMAK3qay69l+VGAAAAAElFTkSuQmCC';
const SIDE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAB4AAAA8CAIAAAD+Np3IAAAAMklEQVR4nO3MMQ0AAAgDsMlBDrKRhQoe0qR3Uz1Holar1Wq1Wq1Wq9VqtVqtVqvV3+oFUknKeY9hylAAAAAASUVORK5CYII=';

type Stored = {id: string; entityId?: string; portrait?: {imageId: string; thumbnailDataUrl: string}};

const readStore = (storeName: string): Cypress.Chainable<Stored[]> =>
  cy.window().then(
    (win) =>
      new Cypress.Promise<Stored[]>((resolve, reject) => {
        const open = win.indexedDB.open(DB_NAME, DB_VERSION);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const request = db.transaction([storeName], 'readonly').objectStore(storeName).getAll();
          request.onsuccess = () => {
            resolve(request.result as Stored[]);
            db.close();
          };
          request.onerror = () => reject(request.error);
        };
      })
  );

function seedMira(win: Window): Promise<void> {
  const now = Date.now();
  return new Promise((resolve, reject) => {
    const open = win.indexedDB.open(DB_NAME, DB_VERSION);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['entityCategories', 'entities'], 'readwrite');
      tx.objectStore('entityCategories').put({
        id: 'characters', projectId: PROJECT_ID, kind: 'character', name: 'Characters', slug: 'characters',
        fieldSchema: [{key: 'description', label: 'Description', type: 'textarea'}], createdAt: now
      });
      tx.objectStore('entities').put({
        id: 'entity-mira', projectId: PROJECT_ID, categoryId: 'characters', name: 'Mira Voss',
        fields: {description: '<p>A smith in Glass Harbor.</p>'}, links: [], createdAt: now, updatedAt: now
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}

const openMira = () => {
  cy.visit('/world-bible');
  cy.contains('h1', 'World Bible').should('be.visible');
  cy.contains('button', 'Characters').click();
  cy.contains('[class*="entityName"]', /^Mira Voss$/).parents('li').first().within(() => {
    cy.contains('button', 'Edit').click();
  });
};

describe('Record images (4.100)', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.window().then((win) => seedMira(win));
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('adds images, chooses the portrait, removes one, and keeps it through a form save', () => {
    openMira();
    cy.get('input[aria-label="Add images to Mira Voss"]').selectFile(
      [
        {contents: Cypress.Buffer.from(FRONT_PNG, 'base64'), fileName: 'mira-front.png', mimeType: 'image/png'},
        {contents: Cypress.Buffer.from(SIDE_PNG, 'base64'), fileName: 'mira-side.png', mimeType: 'image/png'},
        {contents: Cypress.Buffer.from('not an image'), fileName: 'notes.txt', mimeType: 'text/plain'}
      ],
      {force: true}
    );
    cy.contains('[role="alert"]', 'Added 2 images. notes.txt is not a PNG, JPEG, WebP, or GIF image.').should('be.visible');

    // The first image becomes the portrait.
    cy.get('ul[aria-label="Images of Mira Voss"] > li').should('have.length', 2);
    cy.contains('ul[aria-label="Images of Mira Voss"] > li', 'mira-front.png')
      .should('contain.text', '40 × 20')
      .and('contain.text', 'Portrait');
    cy.get('img[alt="Portrait of Mira Voss"]').should('be.visible')
      .and(($img) => expect(($img[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0));

    cy.contains('ul[aria-label="Images of Mira Voss"] > li', 'mira-side.png').within(() => {
      cy.contains('button', 'Use as portrait').click();
    });
    cy.contains('[role="status"]', 'mira-side.png is now the portrait.').should('be.visible');

    cy.get('button[aria-label="View mira-side.png full size"]').click();
    cy.get('[role="dialog"]').should('contain.text', 'mira-side.png').find('img').should('be.visible');
    cy.get('body').type('{esc}');
    cy.get('[role="dialog"]').should('not.exist');

    cy.contains('ul[aria-label="Images of Mira Voss"] > li', 'mira-front.png').within(() => {
      cy.contains('button', 'Remove').click();
    });
    cy.get('[role="alertdialog"], [role="dialog"]').contains('button', 'Remove image').click();
    cy.get('ul[aria-label="Images of Mira Voss"] > li').should('have.length', 1);

    // Saving the form keeps the portrait the panel set.
    cy.contains('button', 'Save Canon Changes').click();
    cy.contains('[class*="entityName"]', /^Mira Voss$/).parents('li').first()
      .find('img').should('have.attr', 'src').and('match', /^data:image\//);

    readStore('entity_images').then((images) => {
      expect(images.map((image) => image.entityId)).to.deep.equal(['entity-mira']);
      readStore('entities').then((entities) => {
        const mira = entities.find((entity) => entity.id === 'entity-mira');
        expect(mira?.portrait?.imageId).to.equal(images[0].id);
        expect(mira?.portrait?.thumbnailDataUrl).to.match(/^data:image\//);
      });
    });

    cy.reload();
    openMira();
    cy.get('ul[aria-label="Images of Mira Voss"] > li').should('have.length', 1)
      .and('contain.text', 'mira-side.png').and('contain.text', 'Portrait');
  });
});
