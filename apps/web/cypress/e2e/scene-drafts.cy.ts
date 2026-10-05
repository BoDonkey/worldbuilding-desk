import {DB_NAME, DB_VERSION} from '../../src/db';

const PROJECT_ID = 'cypress-project-1';
const ANTHROPIC_STREAM = 'http://localhost:3001/api/anthropic/stream';
const WATCHED_STORES = [
  'entities',
  'entityCategories',
  'characters',
  'character_sheets',
  'canonical_facts',
  'lore_fact_proposals',
  'state_mutation_events',
  'corkboard_chapter_cards'
] as const;
const BETA_TEXT = `${Array.from({length: 60}, (_, index) => `beat${index}`).join(' ')} The lamp goes out.`;

const anthropicReply = (text: string) => ({
  statusCode: 200,
  headers: {'content-type': 'text/event-stream'},
  body: [
    `data: ${JSON.stringify({type: 'content_block_delta', delta: {type: 'text_delta', text}})}`,
    'data: [DONE]',
    ''
  ].join('\n\n')
});

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

function readStores(db: IDBDatabase): Promise<string> {
  return Promise.all(WATCHED_STORES.map((storeName) => new Promise<unknown[]>((resolve, reject) => {
    const request = db.transaction([storeName], 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as unknown[]);
    request.onerror = () => reject(request.error);
  }))).then((stores) => JSON.stringify(stores));
}

function seed(allowSceneDrafts: boolean) {
  return (db: IDBDatabase): Promise<void> => new Promise((resolve, reject) => {
    const now = Date.now();
    const tx = db.transaction(
      ['projectSettings', 'entityCategories', 'entities', 'canonical_facts', 'writingDocuments', 'corkboard_chapter_cards'],
      'readwrite'
    );
    const settings = tx.objectStore('projectSettings');
    const getSettings = settings.get(`settings-${PROJECT_ID}`);
    getSettings.onsuccess = () => {
      const existing = getSettings.result;
      settings.put({...existing, aiSettings: {...existing.aiSettings, allowSceneDrafts}});
    };
    tx.objectStore('entityCategories').put({
      id: 'characters', projectId: PROJECT_ID, kind: 'character', name: 'Characters',
      slug: 'characters', fieldSchema: [], createdAt: now
    });
    tx.objectStore('entities').put({
      id: 'entity-mara', projectId: PROJECT_ID, categoryId: 'characters', name: 'Mara',
      fields: {notes: '<p>A courier who owes the guild.</p>'}, links: [], createdAt: now, updatedAt: now
    });
    tx.objectStore('canonical_facts').put({
      id: 'fact-mara', projectId: PROJECT_ID, targetType: 'entity', targetId: 'entity-mara',
      targetName: 'Mara', factType: 'trait', value: 'counts exits in every room', acceptedAt: now, updatedAt: now
    });
    // Lengthen Beta in place, keeping its position between Alpha and Gamma.
    const documents = tx.objectStore('writingDocuments');
    const getBeta = documents.get('scene-beta');
    getBeta.onsuccess = () => documents.put({...getBeta.result, content: `<p>${BETA_TEXT}</p>`});
    tx.objectStore('corkboard_chapter_cards').put({
      id: 'card-heist', projectId: PROJECT_ID, title: 'The Heist', summary: 'Mara breaks into the archive.',
      status: 'planned', order: 0, sceneIds: ['scene-gamma'], plotPoints: [], createdAt: 1, updatedAt: 1
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const draftDialog = () => cy.get('[role="dialog"][aria-labelledby="scene-draft-title"]');

describe('Opt-in AI scene drafts', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.window().then((win) => win.localStorage.setItem('anthropic_api_key', 'cypress-test-key'));
    cy.reload();
  });

  it('is offered only after the author turns the project setting on', () => {
    withDb(seed(false));
    cy.visit('/workspace');
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'Alpha content');
    cy.contains('button', 'Draft this scene').should('not.exist');

    cy.visit('/settings');
    cy.ensureSettingsSectionOpen('AI Settings');
    cy.contains('button', 'Show advanced settings').click();
    cy.contains('label', 'Allow AI scene drafts').find('input').should('not.be.checked').check();
    cy.contains('Drafts are previews until you insert them').should('be.visible');

    cy.visit('/workspace');
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'Alpha content');
    cy.contains('button', 'Draft this scene').should('be.visible');
  });

  it('drafts an empty scene from visible inputs and inserts marked, undoable text without touching records', () => {
    withDb(seed(true));
    cy.reload();
    cy.visit('/workspace');
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'Alpha content');
    cy.intercept('POST', ANTHROPIC_STREAM, anthropicReply('Mara counts the exits.\n\nThe archive is cold.'))
      .as('draftRequest');
    let baseline = '';
    withDb(readStores).then((snapshot) => {
      baseline = snapshot;
    });

    cy.contains('button', 'Draft this scene').click();
    draftDialog().within(() => {
      cy.contains('button', 'Draft scene').should('be.disabled');
      cy.contains('label', 'What happens in this scene').find('textarea').type('Mara slips into the archive.');
      cy.contains('fieldset', 'Characters present').contains('label', 'Mara').find('input').check();
      cy.contains('label', 'Point of view').find('select').select('Mara');
      cy.contains('Sends the fields above').should('be.visible');
      cy.contains('button', 'Draft scene').click();
    });

    cy.wait('@draftRequest').then(({request}) => {
      const body = JSON.stringify(request.body);
      expect(body).to.contain('Mara slips into the archive.');
      expect(body).to.contain('counts exits in every room');
      expect(body).to.contain('Point of view: Mara.');
      // Other scenes are not sent: Alpha is first, so there is no previous ending.
      expect(body).not.to.contain('The lamp goes out.');
      expect(body).not.to.contain('Gamma content');
    });
    draftDialog().within(() => {
      cy.contains('The archive is cold.').should('be.visible');
    });
    cy.get('.tiptap-editor').should('not.contain.text', 'The archive is cold.');
    withDb(readStores).then((snapshot) => {
      expect(snapshot).to.equal(baseline);
    });

    draftDialog().contains('button', 'Insert into scene').click();
    draftDialog().should('not.exist');
    cy.get('.tiptap [data-ai-text="scene-draft"]').should('contain.text', 'The archive is cold.');
    cy.get('.tiptap[contenteditable="true"]').type(`{${Cypress.platform === 'darwin' ? 'cmd' : 'ctrl'}+z}`);
    cy.get('.tiptap-editor').should('not.contain.text', 'The archive is cold.');
    withDb(readStores).then((snapshot) => {
      expect(snapshot).to.equal(baseline);
    });
  });

  it('is not offered on a populated scene', () => {
    withDb(seed(true));
    cy.reload();
    cy.visit('/workspace');
    cy.contains('button', /^Scenes$/).first().click();
    cy.contains('li', 'Beta Scene').contains('Beta Scene').click();
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'The lamp goes out.');
    cy.contains('button', 'Draft this scene').should('not.exist');
  });

  it('opens from a Corkboard chapter card with the card as the goal and the previous ending shown', () => {
    withDb(seed(true));
    cy.reload();
    cy.visit('/corkboard');
    cy.get('button[aria-label="Draft scene Gamma Scene"]').click();
    cy.location('pathname').should('eq', '/workspace');
    draftDialog().within(() => {
      cy.contains('h2', 'Gamma Scene').should('be.visible');
      cy.contains('label', 'What happens in this scene').find('textarea')
        .should('have.value', 'Mara breaks into the archive.');
      cy.contains('label', 'How the previous scene ends').find('textarea')
        .invoke('val').should('contain', 'The lamp goes out.');
      cy.contains('button', 'Close').click();
    });
    cy.contains('label', 'Title').find('input').should('have.value', 'Gamma Scene');
  });
});
