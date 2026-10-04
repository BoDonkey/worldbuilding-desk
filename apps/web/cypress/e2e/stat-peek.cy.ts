import {DB_NAME, DB_VERSION} from '../../src/db';

const PROJECT_ID = 'cypress-project-1';
const WATCHED_STORES = [
  'character_sheets',
  'state_mutation_events',
  'entities',
  'characters',
  'writingDocuments',
  'settlement_state'
] as const;

function withDb<T>(work: (db: IDBDatabase) => Promise<T>): Cypress.Chainable<T> {
  return cy.window().then((win) => new Cypress.Promise<T>((resolve, reject) => {
    const request = win.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      work(db).then(
        (value) => {db.close(); resolve(value);},
        (error) => {db.close(); reject(error);}
      );
    };
  }));
}

function putRecords(db: IDBDatabase, storeName: string, records: object[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    records.forEach((record) => tx.objectStore(storeName).put(record));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function readStores(db: IDBDatabase): Promise<string> {
  return Promise.all(WATCHED_STORES.map((storeName) => new Promise<unknown[]>((resolve, reject) => {
    const request = db.transaction([storeName], 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as unknown[]);
    request.onerror = () => reject(request.error);
  }))).then((stores) => JSON.stringify(stores));
}

function seedRuleset(): Cypress.Chainable<void> {
  return cy.window().then((win) => new Cypress.Promise<void>((resolve, reject) => {
    // Rulesets live in their own database (services/rules/rulesetService.ts).
    const request = win.indexedDB.open('worldbuilding-desk', 2);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('rulesets')) {
        request.result
          .createObjectStore('rulesets', {keyPath: 'id'})
          .createIndex('projectId', 'projectId', {unique: false});
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['rulesets'], 'readwrite');
      tx.objectStore('rulesets').put({
        id: 'ruleset-stat-peek', projectId: PROJECT_ID, name: 'Peek Rules', version: '1',
        statDefinitions: [
          {id: 'strength', name: 'Strength', defaultValue: 10},
          {id: 'agility', name: 'Agility', defaultValue: 10}
        ],
        resourceDefinitions: [{id: 'hp', name: 'Health', defaultValue: 40, max: 100}],
        rules: [], itemTemplates: [], statusTemplates: [],
        createdAt: Date.now(), updatedAt: Date.now()
      });
      tx.oncomplete = () => {db.close(); resolve();};
      tx.onerror = () => {db.close(); reject(tx.error);};
    };
  }));
}

function pressStatPeekShortcut() {
  cy.get('.tiptap-editor').trigger('keydown', {
    key: 's',
    code: 'KeyS',
    metaKey: true,
    ctrlKey: true,
    altKey: true
  });
}

const nextFrame = () =>
  cy.window().then((win) => new Cypress.Promise((resolve) => win.requestAnimationFrame(() => resolve())));

/**
 * Puts a collapsed cursor after `prefix` in the scene's first paragraph and
 * waits until the editor's own selection has caught up. Synthetic arrow keys
 * move the DOM selection; ProseMirror syncs on the later selectionchange, so
 * a shortcut fired immediately can read the old cursor.
 *
 * After a dialog closes, the editor restores its previous selection on a
 * later frame. If that lands after `{moveToStart}`, the arrows count from the
 * old cursor, so settle first and retry a bounded number of times.
 */
function placeCursorAfter(prefix: string, attempt = 1) {
  nextFrame();
  nextFrame();
  cy.get('.tiptap-editor').type(`{moveToStart}${'{rightArrow}'.repeat(prefix.length)}`);
  nextFrame();
  cy.window().then((win) => {
    const selection = win.getSelection();
    const before = selection?.anchorNode?.textContent?.slice(0, selection.anchorOffset);
    if (before !== prefix && attempt < 3) {
      placeCursorAfter(prefix, attempt + 1);
      return;
    }
    expect(before).to.equal(prefix);
  });
  nextFrame();
}

function writeScene(text: string) {
  cy.get('.tiptap-editor').click().type(`{selectall}${text}`, {delay: 0});
  cy.contains('button', 'Save now').click();
  cy.contains('[role="status"]', /Scene (saved|already saved)\./).should('be.visible');
}

describe('Stat peek', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    withDb((db) => putRecords(db, 'character_sheets', [{
      id: 'sheet-borin-1',
      projectId: PROJECT_ID,
      name: 'Borin',
      level: 2,
      experience: 150,
      stats: [{definitionId: 'strength', value: 9}],
      resources: [{definitionId: 'hp', current: 18, max: 25}],
      inventory: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }]));
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('peeks by shortcut on rostered and non-rostered characters without changing records', () => {
    cy.visit('/workspace');
    writeScene('Aria waits by the gate while Borin sharpens an axe.');

    // Borin is named in the prose but taken off this scene's roster.
    cy.contains('button', 'Context').click();
    cy.contains('button', /^Scene$/).click();
    cy.get('button[aria-label="Hide Borin from this scene roster"]').click();
    cy.get('button[aria-label="Hide Borin from this scene roster"]').should('not.exist');
    cy.contains('article', 'Aria').should('be.visible');

    let baseline = '';
    withDb(readStores).then((snapshot) => {
      baseline = snapshot;
    });

    // Rostered: cursor inside "Aria".
    placeCursorAfter('Ar');
    pressStatPeekShortcut();
    cy.get('[role="dialog"][aria-label="Character stats"]').should('have.focus').within(() => {
      cy.get('article[aria-label="Aria stats"]').within(() => {
        cy.contains('Level 5').should('be.visible');
        cy.contains('32 / 40').should('be.visible');
        cy.contains('At the cursor in Alpha Scene').should('be.visible');
        cy.contains('14').should('exist');
      });
    });
    cy.focused().type('{esc}');
    cy.get('[role="dialog"][aria-label="Character stats"]').should('not.exist');
    cy.focused().should('have.class', 'ProseMirror');

    // Non-rostered: cursor at the end of "Borin".
    placeCursorAfter('Aria waits by the gate while Borin');
    pressStatPeekShortcut();
    cy.get('article[aria-label="Borin stats"]').within(() => {
      cy.contains('Level 2').should('be.visible');
      cy.contains('18 / 25').should('be.visible');
    });
    cy.focused().type('{esc}');

    // Nothing named at the cursor.
    cy.get('.tiptap-editor').type('{moveToEnd}');
    pressStatPeekShortcut();
    cy.contains('No character name at the cursor.').should('be.visible');
    cy.focused().type('{esc}');

    // Context menu on a name.
    cy.get('.tiptap-editor').contains('Aria waits').rightclick(4, 8);
    cy.get('[role="menu"][aria-label="Character actions"]').within(() => {
      cy.contains('[role="menuitem"]', 'Show stats').click();
    });
    cy.get('article[aria-label="Aria stats"]').should('be.visible');
    cy.focused().type('{esc}');

    // The command palette peeks at the cursor in Workspace.
    cy.get('body').type('{ctrl}k');
    cy.get('input[placeholder="Type a command..."]').type('borin');
    cy.contains('[role="option"]', 'Show stats for Borin').click();
    cy.get('article[aria-label="Borin stats"]').within(() => {
      cy.contains('At the cursor in Alpha Scene').should('be.visible');
    });
    cy.focused().type('{esc}');

    withDb(readStores).then((snapshot) => {
      expect(snapshot).to.equal(baseline);
    });
  });

  it('shows the same values as the Sheets route from the palette on other routes', () => {
    seedRuleset();
    // Direct visits can hit the systems gate before settings load; navigate in-app.
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.get('body').type('{ctrl}k');
    cy.get('input[placeholder="Type a command..."]').type('go to sheets{enter}');
    cy.location('pathname').should('eq', '/sheets');
    cy.contains('button', 'Advanced sheet setup').click();
    cy.contains('h2', 'Character Sheets').parent().contains('strong', /^Aria$/)
      .parents('div').filter((_, el) => el.textContent?.includes('Level 5') ?? false).first()
      .should('contain.text', 'Level 5')
      .and('contain.text', 'Strength: 14')
      .and('contain.text', 'Health: 32/40');

    cy.visit('/corkboard');
    // The palette shortcut listener attaches after first render; wait for the route first.
    cy.contains('h1', 'Corkboard').should('be.visible');
    cy.get('body').type('{ctrl}k');
    cy.get('input[placeholder="Type a command..."]').type('aria');
    cy.contains('[role="option"]', 'Show stats for Aria').click();
    cy.get('[role="dialog"][aria-label="Show stats for"]').within(() => {
      cy.get('article[aria-label="Aria stats"]').within(() => {
        cy.contains('Level 5').should('be.visible');
        cy.contains('32 / 40').should('be.visible');
        cy.contains('Strength').parent().should('contain.text', '14');
        cy.contains('Latest, after every accepted change').should('be.visible');
      });
    });
  });

  it('is unavailable when game systems are disabled', () => {
    withDb((db) => new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['projectSettings'], 'readwrite');
      const store = tx.objectStore('projectSettings');
      const request = store.get('settings-cypress-project-1');
      request.onsuccess = () => store.put({
        ...request.result,
        projectMode: 'general',
        featureToggles: {
          enableGameSystems: false,
          enableRuntimeModifiers: false,
          enableSettlementAndZoneSystems: false,
          enableRuleAuthoring: false
        }
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }));
    cy.visit('/workspace');
    writeScene('Aria waits by the gate.');
    placeCursorAfter('A');
    pressStatPeekShortcut();
    cy.get('[aria-label="Character stats"]').should('not.exist');
    cy.get('body').type('{ctrl}k');
    cy.get('input[placeholder="Type a command..."]').type('stats');
    cy.contains('[role="option"]', 'Show stats for').should('not.exist');
  });

  it('pins characters to a panel that follows the cursor and shows latest elsewhere', () => {
    cy.visit('/workspace');
    writeScene('Aria waits by the gate while Borin sharpens an axe.');

    // Pin Aria from the peek and Borin from the scene roster.
    placeCursorAfter('A');
    pressStatPeekShortcut();
    cy.get('[role="dialog"][aria-label="Character stats"]').within(() => {
      cy.contains('button', 'Pin stats').click();
      cy.contains('button', 'Unpin stats').should('have.attr', 'aria-pressed', 'true');
    });
    cy.focused().type('{esc}');
    cy.contains('button', 'Context').click();
    cy.contains('button', /^Scene$/).click();
    cy.get('button[aria-label="Pin Borin\'s stats"]').click();

    cy.get('aside[aria-label="Pinned stats"]').within(() => {
      cy.contains('button', 'Pinned stats (2)').should('have.attr', 'aria-expanded', 'true');
      cy.get('article[aria-label="Aria stats"]').should('contain.text', 'At the cursor in Alpha Scene');
      cy.get('article[aria-label="Borin stats"]').should('contain.text', '18 / 25');
      cy.get('select').should('not.exist');
    });
    // The open panel sits above Workspace's save bar instead of covering it.
    cy.contains('button', 'Save now').click();
    cy.get('aside[aria-label="Pinned stats"]').within(() => {
      cy.get('article[aria-label="Aria stats"]').within(() => {
        cy.contains('button', 'Changes since previous chapter').click();
        cy.contains('Since the previous scene (no chapter card links this scene)').should('be.visible');
        cy.contains('No changes.').should('be.visible');
      });
    });

    // Elsewhere the panel shows the latest state, with an as-of picker, and
    // stays visible over the Scratchpad.
    cy.visit('/corkboard');
    cy.get('aside[aria-label="Pinned stats"]').within(() => {
      cy.get('article[aria-label="Aria stats"]')
        .should('contain.text', 'Latest, after every accepted change')
        .and('contain.text', '32 / 40');
      cy.get('select').select('End of Beta Scene');
      cy.get('article[aria-label="Aria stats"]').should('contain.text', 'At the end of Beta Scene');
    });
    cy.contains('button', 'Scratchpad').click();
    cy.get('[role="dialog"][aria-label="Project scratchpad"]').should('be.visible');
    cy.get('aside[aria-label="Pinned stats"]').within(() => {
      cy.contains('button', 'Pinned stats (2)').click();
      cy.contains('button', 'Pinned stats (2)').should('have.attr', 'aria-expanded', 'false');
      cy.contains('button', 'Pinned stats (2)').click();
    });
    cy.get('[role="dialog"][aria-label="Project scratchpad"]').should('be.visible');
    cy.get('body').type('{esc}');

    // A bottom sheet on narrow screens.
    cy.viewport(390, 844);
    cy.get('aside[aria-label="Pinned stats"]').then(($panel) => {
      const rect = $panel[0].getBoundingClientRect();
      expect(rect.left).to.equal(0);
      expect(rect.width).to.be.closeTo(390, 1);
    });
    cy.document().then((document) => {
      expect(document.documentElement.scrollWidth).to.be.at.most(390);
    });
    cy.viewport(1400, 1000);

    // Pins survive a reload; unpinning the last one removes the panel.
    cy.reload();
    cy.get('aside[aria-label="Pinned stats"]').within(() => {
      cy.get('button[aria-label="Unpin Aria\'s stats"]').click();
      cy.get('button[aria-label="Unpin Borin\'s stats"]').click();
    });
    cy.get('aside[aria-label="Pinned stats"]').should('not.exist');
  });
});
