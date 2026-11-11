const PROJECT_ID = 'cypress-project-1';

/** Rulesets live in their own database (services/rules/rulesetService.ts). */
function seedRulesetWithLevelTable(): Cypress.Chainable<void> {
  return cy.window().then((win) => new Cypress.Promise<void>((resolve, reject) => {
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
        id: 'ruleset-xp-levels', projectId: PROJECT_ID, name: 'Level Rules', version: '1',
        statDefinitions: [
          {id: 'strength', name: 'Strength', type: 'number', defaultValue: 10},
          {id: 'agility', name: 'Agility', type: 'number', defaultValue: 10}
        ],
        resourceDefinitions: [{id: 'hp', name: 'Health', type: 'number', defaultValue: 40, max: 100}],
        // The seeded Aria is level 5 with 2,300 XP.
        levelTable: [{level: 6, experience: 3000}, {level: 7, experience: 6000}],
        rules: [], itemTemplates: [], statusTemplates: [],
        createdAt: Date.now(), updatedAt: Date.now()
      });
      tx.oncomplete = () => {db.close(); resolve();};
      tx.onerror = () => {db.close(); reject(tx.error);};
    };
  }));
}

/** Recording state needs the sheet linked to a World Bible character. */
function linkAriaToCharacter(): Cypress.Chainable<void> {
  const now = Date.now();
  return cy.putIndexedDbRecords('entityCategories', [{
    id: 'characters', projectId: PROJECT_ID, kind: 'character', name: 'Characters', slug: 'characters',
    fieldSchema: [], createdAt: now
  } as {id: string}]).then(() => cy.putIndexedDbRecords('entities', [{
    id: 'entity-aria', projectId: PROJECT_ID, categoryId: 'characters', name: 'Aria',
    fields: {}, links: [], createdAt: now, updatedAt: now
  } as {id: string}])).then(() => cy.putIndexedDbRecords('character_sheets', [{
    id: 'sheet-aria-1', projectId: PROJECT_ID, characterEntityId: 'entity-aria', name: 'Aria',
    level: 5, experience: 2300,
    stats: [{definitionId: 'strength', value: 14}, {definitionId: 'agility', value: 11}],
    resources: [{definitionId: 'hp', current: 32, max: 40}],
    inventory: [], createdAt: now, updatedAt: now
  } as {id: string}]));
}

function openScene(title: string) {
  cy.contains(title).click();
  cy.get('.tiptap-editor').should('contain.text', `${title.split(' ')[0]} content`);
}

/** Shows Aria's stats at the end of the open scene's text. */
function peekAtAria() {
  cy.get('.tiptap-editor').click().type('{moveToEnd} Aria');
  cy.get('.tiptap-editor').trigger('keydown', {
    key: 's', code: 'KeyS', metaKey: true, ctrlKey: true, altKey: true
  });
  return cy.get('[role="dialog"][aria-label="Character stats"]').find('article[aria-label="Aria stats"]');
}

describe('XP and levels through the scene ledger (3.34a)', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    seedRulesetWithLevelTable();
    linkAriaToCharacter();
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('records XP in one scene and shows the level it reaches in the next', () => {
    // Direct visits can hit the systems gate before settings load; navigate in-app.
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.get('body').type('{ctrl}k');
    cy.get('input[placeholder="Type a command..."]').type('go to sheets{enter}');
    cy.location('pathname').should('eq', '/sheets');
    cy.contains('button', 'XP, inventory, equipment, status, or location').click();

    cy.contains('h2', 'Record a detailed scene change').parents('section').first().within(() => {
      cy.contains('label', 'Character').find('select').select('Aria');
      cy.contains('label', 'Scene').find('select').select('1. Alpha Scene');
      cy.contains('label', 'What changed?').find('select').select('Gain XP');
      cy.contains('label', 'XP gained').find('input').type('700');
      cy.contains('label', 'Reason (optional)').find('input').type('Cleared the archive');
      cy.contains('Experience: 2300 -> 3000').should('be.visible');
      cy.contains('button', 'Record State Change').click();

      cy.contains('h3', 'Recorded scene changes').parent().within(() => {
        cy.contains('li', 'XP +700 (Cleared the archive)').should('be.visible');
        cy.contains('li', 'Now level 6 · 3000 XP').should('be.visible');
      });
    });

    // The gain is recorded at the end of Alpha Scene, so Beta Scene opens at level 6.
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('button', /^Scenes$/).first().click();
    openScene('Beta Scene');
    peekAtAria().within(() => {
      cy.contains('Level 6').should('be.visible');
      cy.contains('3000 XP').should('be.visible');
    });
    cy.focused().type('{esc}');

    // Inside Alpha Scene, before its end, Aria is still level 5.
    openScene('Alpha Scene');
    peekAtAria().within(() => {
      cy.contains('Level 5').should('be.visible');
      cy.contains('2300 XP').should('be.visible');
    });
  });
});
