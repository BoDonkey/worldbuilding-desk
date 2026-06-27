const DB_NAME = 'worldbuilding-db';
const DB_VERSION = 24;

function setSeededProjectToGeneralFiction(): Cypress.Chainable<void> {
  return cy.window().then(
    (win) =>
      new Cypress.Promise<void>((resolve, reject) => {
        const openRequest = win.indexedDB.open(DB_NAME, DB_VERSION);
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => {
          const db = openRequest.result;
          const tx = db.transaction(['projectSettings'], 'readwrite');
          const store = tx.objectStore('projectSettings');
          const getRequest = store.get('settings-cypress-project-1');

          getRequest.onerror = () => reject(getRequest.error);
          getRequest.onsuccess = () => {
            store.put({
              ...getRequest.result,
              projectMode: 'general',
              featureToggles: {
                enableGameSystems: false,
                enableRuntimeModifiers: false,
                enableSettlementAndZoneSystems: false,
                enableRuleAuthoring: false
              }
            });
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      })
  );
}

function seedWorldBibleCharacterWithToolsProfile(params: {
  entityId: string;
  characterId: string;
  name: string;
  alias?: string;
}): Cypress.Chainable<void> {
  return cy.window().then(
    (win) =>
      new Cypress.Promise<void>((resolve, reject) => {
        const now = Date.now();
        const openRequest = win.indexedDB.open(DB_NAME, DB_VERSION);
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => {
          const db = openRequest.result;
          const stores = ['entityCategories', 'entities', 'characters', 'consistency_aliases'];
          const tx = db.transaction(stores, 'readwrite');
          tx.objectStore('entityCategories').put({
            id: 'characters',
            projectId: 'cypress-project-1',
            name: 'Characters',
            slug: 'characters',
            fieldSchema: [
              {key: 'description', label: 'Description', type: 'textarea', required: true},
              {key: 'age', label: 'Age', type: 'text'},
              {key: 'role', label: 'Role', type: 'text'},
              {key: 'notes', label: 'Notes', type: 'textarea'}
            ],
            createdAt: now
          });
          tx.objectStore('entities').put({
            id: params.entityId,
            projectId: 'cypress-project-1',
            categoryId: 'characters',
            name: params.name,
            fields: {description: '<p>Seeded canon character.</p>'},
            needsCompletion: false,
            links: [],
            createdAt: now,
            updatedAt: now
          });
          tx.objectStore('characters').put({
            id: params.characterId,
            projectId: 'cypress-project-1',
            name: params.name,
            description: 'Seeded tools profile.',
            fields: {},
            createdAt: now,
            updatedAt: now
          });
          if (params.alias) {
            tx.objectStore('consistency_aliases').put({
              id: `alias-${params.entityId}`,
              projectId: 'cypress-project-1',
              targetId: params.entityId,
              targetType: 'entity',
              entityId: params.entityId,
              alias: params.alias,
              createdAt: now,
              updatedAt: now
            });
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      })
  );
}

describe('Lore and review matching', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    setSeededProjectToGeneralFiction();
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('highlights known lore and does not review incomplete known-name prefixes', () => {
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');

    cy.get('.tiptap-editor')
      .click()
      .type('{selectall}The Ember Archive stands.{enter}The Ember Archiv stands.', {
        delay: 0
      });

    cy.contains('button', 'Save now').click();
    cy.contains('[role="status"]', 'Scene saved.').should('be.visible');

    cy.get('.tiptap-editor [data-lore-id="entity-ember-archive"]')
      .should('contain.text', 'Ember Archive');
    cy.contains('.tiptap-editor [data-consistency-id]', 'Ember Archiv')
      .should('not.exist');
    cy.contains('Commit blocked by consistency check').should('not.exist');
  });

  it('highlights manual review results in the active editor scene', () => {
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');

    cy.get('.tiptap-editor')
      .click()
      .type(
        '{selectall}Kaelor crossed the Glass Harbor before dawn.{enter}At the edge of Glass Harbor, Kaelor found the Ember Archive.',
        {delay: 0}
      );

    cy.wait(1000);
    cy.get('button[aria-label^="Open review drawer"]').click();
    cy.contains('button', 'Run project review').click();

    cy.contains('Project review found').should('be.visible');
    cy.contains('.tiptap-editor [data-consistency-id]', 'Kaelor')
      .should('be.visible');
  });

  it('keeps remaining review candidates after creating one reviewed record', () => {
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');

    cy.get('.tiptap-editor')
      .click()
      .type(
        '{selectall}Kaelor crossed the Glass Harbor before dawn.{enter}At the edge of Glass Harbor, Kaelor found the Ember Archive.',
        {delay: 0}
      );

    cy.wait(1000);
    cy.get('button[aria-label^="Open review drawer"]').click();
    cy.contains('button', 'Run project review').click();
    cy.contains('Project review found').should('be.visible');

    cy.contains('.tiptap-editor [data-consistency-id]', 'Kaelor')
      .click();
    cy.contains('button', /Add Character|Add to World|Create record/).click();
    cy.contains('[role="status"]', 'Kaelor').should('be.visible');

    cy.contains('.tiptap-editor [data-consistency-id]', 'Kaelor')
      .should('not.exist');
    cy.contains('.tiptap-editor [data-lore-id]', 'Kaelor')
      .should('be.visible');
    cy.contains('.tiptap-editor [data-consistency-id]', 'Glass Harbor')
      .should('not.exist');
    cy.get('button[aria-label^="Open review drawer"]')
      .should('contain.text', '1 review later');
    cy.contains('li', 'Glass Harbor').within(() => {
      cy.contains('Review later').should('be.visible');
    });
  });

  it('keeps idle review as later-review badge state without inline underline noise', () => {
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');

    cy.get('.tiptap-editor')
      .click()
      .type('{selectall}Kael hated the dungeon.{enter}All he wanted was a muffin.', {
        delay: 0
      });

    cy.wait(3200);

    cy.contains('.tiptap-editor [data-consistency-id]', 'Kael').should('not.exist');
    cy.get('button[aria-label^="Open review drawer"]')
      .should('contain.text', '1 review later');
    cy.get('.unknownPanel').should('not.exist');

    cy.get('button[aria-label^="Open review drawer"]').click();
    cy.contains('Review issues').should('be.visible');
    cy.contains('Review later').should('be.visible');
    cy.contains('button', 'Alpha Scene').should('be.visible');
  });

  it('opens passive review context from the drawer without requiring manual selection', () => {
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');

    cy.get('.tiptap-editor')
      .click()
      .type('{selectall}Kael hated the dungeon.{enter}All he wanted was a muffin.', {
        delay: 0
      });

    cy.wait(3200);

    cy.contains('.tiptap-editor [data-consistency-id]', 'Kael').should('not.exist');
    cy.get('button[aria-label^="Open review drawer"]').click();
    cy.contains('Review issues').should('be.visible');

    cy.contains('li', 'Kael').within(() => {
      cy.contains('button', 'Show context').click();
    });

    cy.contains('.tiptap-editor .review-focus-flash', 'Kael').should('be.visible');
    cy.contains('li', 'Kael').within(() => {
      cy.contains('button', 'Add to World').should('be.visible');
      cy.contains('button', 'Ignore').should('be.visible');
      cy.contains('button', 'Always ignore').should('be.visible');
      cy.contains('label', 'Name').find('input').should('have.value', 'Kael');
    });
  });

  it('adds imported scene review candidates while the review drawer stays open', () => {
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');

    cy.get('.tiptap-editor')
      .click()
      .type('{selectall}Kael hated the dungeon.{enter}All he wanted was a muffin.', {
        delay: 0
      });

    cy.wait(3200);
    cy.get('button[aria-label^="Open review drawer"]').click();
    cy.contains('Review issues').should('be.visible');
    cy.contains('li', 'Kael').should('be.visible');

    cy.get('input[type="file"]').selectFile(
      {
        contents: Cypress.Buffer.from(
          'Kaelor crossed the Glass Harbor before dawn. Kaelor checked the seal.'
        ),
        fileName: 'second-scene.txt',
        mimeType: 'text/plain',
        lastModified: Date.now()
      },
      {force: true}
    );

    cy.contains('[role="status"]', 'Imported 1 document(s).').should('be.visible');
    cy.contains('Cypress Smoke Project · second-scene').should('be.visible');
    cy.contains('li', 'Kael').should('be.visible');
    cy.contains('li', 'Kaelor').should('be.visible');
    cy.contains('li', 'second-scene').should('be.visible');

    cy.contains('[class*="consistencyItemTitle"]', /^Kaelor$/)
      .parents('li')
      .first()
      .within(() => {
      cy.contains('button', 'second-scene').click();
    });
    cy.contains('.tiptap-editor .review-focus-flash', 'Kaelor').should('be.visible');
    cy.get('[class*="consistencyList"]').first().find('li').first()
      .should('contain.text', 'Kaelor');

    cy.contains('[class*="consistencyItemTitle"]', /^Kael$/)
      .parents('li')
      .first()
      .within(() => {
      cy.contains('button', 'Alpha Scene').click();
    });
    cy.contains('.tiptap-editor .review-focus-flash', 'Kael').should('be.visible');
    cy.get('[class*="consistencyList"]').first().find('li').first()
      .should('contain.text', 'Kael');
    cy.contains('[class*="consistencyItemTitle"]', /^Kael$/).should('be.visible');
    cy.contains('[class*="consistencyItemTitle"]', /^Kaelor$/).should('be.visible');

    cy.get('input[type="file"]').selectFile(
      {
        contents: Cypress.Buffer.from(
          'Miralin crossed the Silent Gate before dawn. Miralin checked the seal.'
        ),
        fileName: 'third-scene.txt',
        mimeType: 'text/plain',
        lastModified: Date.now()
      },
      {force: true}
    );

    cy.contains('[role="status"]', 'Imported 1 document(s).').should('be.visible');
    cy.contains('Cypress Smoke Project · third-scene').should('be.visible');
    cy.contains('[class*="consistencyItemTitle"]', /^Miralin$/).should('be.visible');
    cy.contains('[class*="consistencyItemTitle"]', /^Kael$/).should('exist');
    cy.contains('[class*="consistencyItemTitle"]', /^Kaelor$/).should('exist');

    cy.contains('[class*="consistencyItemTitle"]', /^Kael$/)
      .scrollIntoView()
      .parents('li')
      .first()
      .within(() => {
        cy.contains('button', 'Alpha Scene').click();
      });
    cy.contains('.tiptap-editor .review-focus-flash', 'Kael').should('be.visible');
    cy.get('[class*="consistencyList"]').first().find('li').first()
      .should('contain.text', 'Kael');
    cy.contains('[class*="consistencyItemTitle"]', /^Kael$/).should('be.visible');
    cy.contains('[class*="consistencyItemTitle"]', /^Kaelor$/).should('exist');
    cy.contains('[class*="consistencyItemTitle"]', /^Miralin$/).should('exist');
  });

  it('creates World Bible character canon from workspace review and preserves aliases after rename', () => {
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');

    cy.get('.tiptap-editor')
      .click()
      .type(
        '{selectall}"Garcia, get your head in the game!" Blatnor shouted.{enter}Garcia checked the seal.',
        {delay: 0}
      );

    cy.wait(1000);
    cy.get('button[aria-label^="Open review drawer"]').click();
    cy.contains('button', 'Run project review').click();
    cy.contains('Project review found').should('be.visible');
    cy.contains('.tiptap-editor [data-consistency-id]', 'Garcia').click();
    cy.get('select[aria-label="World category"]').select('Characters');
    cy.contains('button', 'Add Character').click();
    cy.contains('[role="status"]', 'Garcia').should('be.visible');
    cy.location('pathname').should('eq', '/workspace');
    cy.contains('.tiptap-editor [data-consistency-id]', 'Garcia').should('not.exist');
    cy.contains('.tiptap-editor [data-lore-id]', 'Garcia').should('be.visible');

    cy.contains('button', 'Save now').click();
    cy.contains('[role="status"]', /Scene (saved|already saved)\./).should('be.visible');

    cy.visit('/world-bible');
    cy.contains('h1', 'World Bible').should('be.visible');
    cy.contains('button', 'Characters').click();
    cy.contains('[class*="entityName"]', /^Garcia$/)
      .parents('li')
      .first()
      .within(() => {
        cy.contains('button', 'Edit').click();
      });
    cy.get('form').within(() => {
      cy.contains('label', 'Name').find('input').clear().type('Garcia de Terra');
      cy.contains('Saving this rename will keep').should('contain.text', 'Garcia');
      cy.contains('button', 'Save Canon Changes').click();
    });
    cy.contains('[role="status"]', 'Entry updated.').should('be.visible');
    cy.contains('li', 'Garcia de Terra').should('be.visible');

    cy.visit('/workspace');
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');
    cy.contains('.tiptap-editor [data-lore-id]', 'Garcia').should('be.visible');
    cy.contains('.tiptap-editor [data-consistency-id]', 'Garcia').should('not.exist');
  });

  it('links a workspace unknown alias to World Bible character canon without duplicate tools targets', () => {
    seedWorldBibleCharacterWithToolsProfile({
      entityId: 'entity-garcia-full',
      characterId: 'character-garcia-full',
      name: 'Garcia de Terra'
    });
    cy.reload();
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');

    cy.get('.tiptap-editor')
      .click()
      .type(
        '{selectall}"Garcia, get your head in the game!" Blatnor shouted.{enter}Garcia checked the seal.',
        {delay: 0}
      );

    cy.wait(1000);
    cy.get('button[aria-label^="Open review drawer"]').click();
    cy.contains('button', 'Run project review').click();
    cy.contains('Project review found').should('be.visible');
    cy.contains('.tiptap-editor [data-consistency-id]', 'Garcia').click();

    cy.contains('option', 'Garcia de Terra · Characters').should('exist');
    cy.contains('option', 'Garcia de Terra · Character Tools').should('not.exist');
    cy.contains('select option', 'Garcia de Terra · Characters')
      .invoke('val')
      .then((value) => {
        expect(value).to.be.a('string').and.match(/^entity:/);
        cy.contains('select option', 'Garcia de Terra · Characters')
          .parent()
          .select(value as string);
      });
    cy.contains('button', 'Connect to existing').click();
    cy.contains('[role="status"]', 'Connected "Garcia" as an alias').should('be.visible');
    cy.location('pathname').should('eq', '/workspace');
    cy.contains('.tiptap-editor [data-consistency-id]', 'Garcia').should('not.exist');
    cy.contains('.tiptap-editor [data-lore-id]', 'Garcia').should('be.visible');
    cy.contains('button', 'Connect to existing').should('not.exist');
  });

  it('keeps review counts and highlights in sync after character canonicalization across scenes', () => {
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('Cypress Smoke Project · Alpha Scene').should('be.visible');

    cy.get('.tiptap-editor')
      .click()
      .type('{selectall}Kael hated the dungeon.{enter}All he wanted was a muffin.', {
        delay: 0
      });

    cy.wait(1000);
    cy.get('button[aria-label^="Open review drawer"]').click();
    cy.contains('button', 'Run project review').click();
    cy.contains('Project review found').should('be.visible');
    cy.contains('.tiptap-editor [data-consistency-id]', 'Kael')
      .click();
    cy.contains('button', /Add Character|Add to World|Create record/).click();
    cy.contains('[role="status"]', 'Kael').should('be.visible');
    cy.contains('.tiptap-editor [data-lore-id]', 'Kael').should('be.visible');
    cy.get('button[aria-label^="Open review drawer"]')
      .invoke('text')
      .should('match', /Review clear/);

    cy.contains('button', /^Scenes$/).first().click();
    cy.contains('Beta Scene').click();
    cy.contains('Cypress Smoke Project · Beta Scene').should('be.visible');

    cy.get('.tiptap-editor')
      .click()
      .type(
        '{selectall}"Kaelor, get your head in the game!" Blatnor shouted.{enter}Kael thought to himself, "no."',
        {delay: 0}
      );

    cy.get('button[aria-label^="Open review drawer"]', {timeout: 10000})
      .should('contain.text', '2 review later');
    cy.contains('.tiptap-editor [data-consistency-id]', 'Kaelor').should('not.exist');
    cy.contains('.tiptap-editor [data-consistency-id]', 'Blatnor').should('not.exist');

    seedWorldBibleCharacterWithToolsProfile({
      entityId: 'entity-kaelor',
      characterId: 'character-kaelor',
      name: 'Kaelor'
    });

    cy.visit('/workspace');
    cy.contains('Beta Scene').click();
    cy.contains('Cypress Smoke Project · Beta Scene').should('be.visible');
    cy.wait(1000);

    cy.contains('.tiptap-editor [data-consistency-id]', 'Kaelor').should('not.exist');
    cy.contains('.tiptap-editor [data-consistency-id]', 'Blatnor').should('not.exist');
    cy.contains('.tiptap-editor [data-lore-id]', 'Kaelor').should('be.visible');
    cy.get('button[aria-label^="Open review drawer"]').should('contain.text', '1 review later');
  });

  it('removes lore highlights after deleting World Bible canon even if a tools profile remains', () => {
    seedWorldBibleCharacterWithToolsProfile({
      entityId: 'entity-garcia-full',
      characterId: 'character-garcia-full',
      name: 'Garcia de Terra',
      alias: 'Garcia'
    });
    cy.reload();
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');

    cy.get('.tiptap-editor')
      .click()
      .type('{selectall}Garcia de Terra entered quietly. Garcia checked the seal.', {
        delay: 0
      });

    cy.contains('.tiptap-editor [data-lore-id]', 'Garcia de Terra').should('be.visible');
    cy.contains('.tiptap-editor [data-lore-id]', 'Garcia').should('be.visible');

    cy.visit('/world-bible');
    cy.contains('h1', 'World Bible').should('be.visible');
    cy.on('window:confirm', () => true);
    cy.contains('li', 'Garcia de Terra')
      .contains('button', 'Delete')
      .click();
    cy.contains('[role="status"]', 'Entry deleted.').should('be.visible');

    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');

    cy.contains('.tiptap-editor [data-lore-id]', 'Garcia de Terra').should('not.exist');
    cy.contains('.tiptap-editor [data-lore-id]', 'Garcia').should('not.exist');
  });
});
