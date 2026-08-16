import {DB_NAME, DB_VERSION} from '../../src/db';

function seedItemAuthoringFixture(content: string): Cypress.Chainable<void> {
  return cy.window().then((win) => new Cypress.Promise<void>((resolve, reject) => {
    const now = Date.now();
    const openRequest = win.indexedDB.open(DB_NAME, DB_VERSION);
    openRequest.onerror = () => reject(openRequest.error);
    openRequest.onsuccess = () => {
      const db = openRequest.result;
      const tx = db.transaction(
        ['projects', 'writingDocuments', 'entityCategories', 'entities', 'character_sheets'],
        'readwrite'
      );
      const projectStore = tx.objectStore('projects');
      const projectRequest = projectStore.get('cypress-project-1');
      projectRequest.onerror = () => reject(projectRequest.error);
      projectRequest.onsuccess = () => projectStore.put({
        ...projectRequest.result,
        rulesetId: 'ruleset-item-authoring',
        updatedAt: now
      });
      ['alpha', 'beta', 'gamma'].forEach((sceneName, index) => {
        tx.objectStore('writingDocuments').put({
          id: `scene-${sceneName}`,
          projectId: 'cypress-project-1',
          title: `Potion ${sceneName}`,
          content: `<p>${content}</p>`,
          createdAt: now + index,
          updatedAt: now + index
        });
      });
      tx.objectStore('entityCategories').put({
        id: 'characters', projectId: 'cypress-project-1', kind: 'character',
        name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: now
      });
      tx.objectStore('entityCategories').put({
        id: 'items', projectId: 'cypress-project-1', kind: 'general',
        name: 'Items', slug: 'items', fieldSchema: [], createdAt: now
      });
      tx.objectStore('entities').put({
        id: 'entity-bill', projectId: 'cypress-project-1', categoryId: 'characters',
        name: 'Bill', fields: {}, links: [], createdAt: now, updatedAt: now
      });
      tx.objectStore('character_sheets').put({
        id: 'sheet-bill', projectId: 'cypress-project-1', characterEntityId: 'entity-bill',
        name: 'Bill', level: 1, experience: 0, stats: [],
        resources: [{definitionId: 'health', current: 40, max: 100}],
        inventory: [], createdAt: now, updatedAt: now
      });
      tx.oncomplete = () => {
        db.close();
        const activeProject = JSON.parse(win.localStorage.getItem('activeProject') ?? '{}');
        const nextProject = {...activeProject, rulesetId: 'ruleset-item-authoring'};
        win.localStorage.setItem('activeProject', JSON.stringify(nextProject));
        const shell = JSON.parse(win.localStorage.getItem('wbd-app-shell') ?? '{}');
        win.localStorage.setItem('wbd-app-shell', JSON.stringify({
          ...shell,
          state: {...shell.state, activeProject: nextProject}
        }));

        const rulesRequest = win.indexedDB.open('worldbuilding-desk', 2);
        rulesRequest.onerror = () => reject(rulesRequest.error);
        rulesRequest.onupgradeneeded = () => {
          const rulesDb = rulesRequest.result;
          if (!rulesDb.objectStoreNames.contains('rulesets')) {
            const store = rulesDb.createObjectStore('rulesets', {keyPath: 'id'});
            store.createIndex('projectId', 'projectId', {unique: false});
          }
        };
        rulesRequest.onsuccess = () => {
          const rulesDb = rulesRequest.result;
          const rulesTx = rulesDb.transaction(['rulesets'], 'readwrite');
          rulesTx.objectStore('rulesets').put({
            id: 'ruleset-item-authoring', projectId: 'cypress-project-1',
            name: 'Item Authoring Rules', version: '1', statDefinitions: [],
            resourceDefinitions: [
              {id: 'health', name: 'Health', defaultValue: 40, max: 100}
            ],
            rules: [], itemTemplates: [], statusTemplates: [],
            createdAt: now, updatedAt: now
          });
          rulesTx.oncomplete = () => {
            rulesDb.close();
            resolve();
          };
          rulesTx.onerror = () => reject(rulesTx.error);
          rulesTx.onabort = () => reject(rulesTx.error);
        };
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    };
  }));
}

function openSelectionProposal(): void {
  cy.visit('/workspace');
  cy.contains('h1', 'Writing Workspace').should('be.visible');
  cy.get('.ProseMirror').click().type('{selectall}');
  cy.contains('button', 'Record item/state').click();
}

function setGeneralFictionMode(): Cypress.Chainable<void> {
  return cy.window().then((win) => new Cypress.Promise<void>((resolve, reject) => {
    const request = win.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['projectSettings'], 'readwrite');
      const store = tx.objectStore('projectSettings');
      const getRequest = store.get('settings-cypress-project-1');
      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => store.put({
        ...getRequest.result,
        projectMode: 'general',
        featureToggles: {
          enableGameSystems: false,
          enableRuntimeModifiers: false,
          enableSettlementAndZoneSystems: false,
          enableRuleAuthoring: false
        }
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

describe('Prose-proximate item and state authoring', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.seedSmokeProjectData();
  });

  it('records acquisition state without creating reusable records by default', () => {
    seedItemAuthoringFixture('Bill found a health potion.');
    cy.reload();
    openSelectionProposal();

    cy.get('[role="dialog"][aria-label="Add selected item to inventory"]').within(() => {
      cy.contains('“Bill found a health potion.”').should('be.visible');
      cy.get('input').filter('[value="health potion"]').should('exist');
      cy.contains('label', 'Character').find('select').should('have.value', 'sheet-bill');
      cy.contains('label', 'Save as a reusable world item')
        .find('input[type="checkbox"]')
        .should('not.be.checked');
      cy.contains('button', 'Add at selection').click();
    });

    cy.contains('Added health potion to Bill').should('be.visible');
    cy.window().then((win) => new Cypress.Promise<void>((resolve, reject) => {
      const request = win.indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(
          ['state_mutation_events', 'entities', 'compendium_entries'], 'readonly'
        );
        const eventsRequest = tx.objectStore('state_mutation_events').getAll();
        const entitiesRequest = tx.objectStore('entities').getAll();
        const definitionsRequest = tx.objectStore('compendium_entries').getAll();
        tx.oncomplete = () => {
          const events = eventsRequest.result as Array<{commands: Array<{type: string}>}>;
          const entities = entitiesRequest.result as Array<{name: string}>;
          expect(events.some((event) => event.commands[0]?.type === 'inventory_add')).to.eq(true);
          expect(entities.some((entity) => entity.name === 'health potion')).to.eq(false);
          expect(definitionsRequest.result).to.have.length(0);
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    }));
  });

  it('keeps first-use effect authoring usable at the narrow breakpoint', () => {
    cy.viewport(390, 844);
    seedItemAuthoringFixture('Bill drank a health potion.');
    cy.reload();
    openSelectionProposal();

    cy.get('[role="dialog"][aria-label="Record selected item use"]').within(() => {
      cy.contains('Confirm what changes here without leaving the scene.').should('be.visible');
      cy.get('select[aria-label="Missing inventory choice"]').select('add-and-consume');
      cy.get('input[type="number"]').clear().type('25');
      cy.contains('label', 'Remember this effect').find('input').check();
      cy.contains('health potion: 1 -> 0').should('be.visible');
      cy.contains('Health: 40 -> 65').should('be.visible');
      cy.contains('button', 'Cancel').should('be.visible');
      cy.contains('button', 'Confirm item use').should('be.visible').click();
    });

    cy.contains('Recorded Bill using health potion.').should('be.visible');
  });

  it('does not add mechanics pressure to general-fiction selection tools', () => {
    seedItemAuthoringFixture('Bill found a health potion.');
    setGeneralFictionMode();
    cy.reload();
    cy.visit('/workspace');
    cy.get('.ProseMirror').click().type('{selectall}');
    cy.contains('button', 'Record item/state').should('not.exist');
  });
});
