import {DB_NAME, DB_VERSION} from '../../src/db';

const PROJECT_ID = 'cypress-project-1';
const ANTHROPIC_STREAM = 'http://localhost:3001/api/anthropic/stream';
const WATCHED_STORES = [
  'entities',
  'entityCategories',
  'characters',
  'canonical_facts',
  'lore_fact_proposals',
  'state_mutation_events',
  'writingDocuments'
] as const;
const SCENE_TEXT = 'Sera met his stare with eyes the color of new moss, and did not blink first.';

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

function seed(db: IDBDatabase): Promise<void> {
  const now = Date.now();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['entityCategories', 'entities', 'canonical_facts', 'writingDocuments'], 'readwrite');
    tx.objectStore('entityCategories').put({
      id: 'characters', projectId: PROJECT_ID, kind: 'character', name: 'Characters',
      slug: 'characters', fieldSchema: [], createdAt: now
    });
    tx.objectStore('entities').put({
      id: 'entity-sera', projectId: PROJECT_ID, categoryId: 'characters', name: 'Sera',
      fields: {}, links: [], createdAt: now, updatedAt: now
    });
    tx.objectStore('canonical_facts').put({
      id: 'fact-sera-eyes', projectId: PROJECT_ID, targetType: 'entity', targetId: 'entity-sera',
      targetName: 'Sera', factType: 'appearance', value: 'gray eyes',
      sourceLoreDocumentTitle: 'Sera dossier', acceptedAt: now, updatedAt: now
    });
    const documents = tx.objectStore('writingDocuments');
    const getAlpha = documents.get('scene-alpha');
    getAlpha.onsuccess = () => documents.put({...getAlpha.result, content: `<p>${SCENE_TEXT}</p>`});
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const openReview = () => cy.get('button[aria-label^="Open review drawer"]').click();

describe('Model-assisted canon check', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    withDb(seed);
    cy.window().then((win) => win.localStorage.setItem('anthropic_api_key', 'cypress-test-key'));
    cy.reload();
    cy.visit('/workspace');
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'eyes the color of new moss');
  });

  it('previews validated contradictions, adds them to review only on confirmation, and changes no records', () => {
    cy.intercept('POST', ANTHROPIC_STREAM, anthropicReply(JSON.stringify({
      contradictions: [
        {factId: 'F1', evidence: {start: 0, end: 0, text: 'eyes the color of new moss'}, summary: 'Moss-colored eyes are green, not gray.'},
        {factId: 'F1', evidence: {text: 'eyes as green as spring'}, summary: 'Not a quote from the scene.'},
        {factId: 'F7', evidence: {text: 'did not blink first'}, summary: 'No such fact.'}
      ]
    }))).as('checkRequest');
    let baseline = '';
    withDb(readStores).then((snapshot) => {
      baseline = snapshot;
    });

    openReview();
    cy.contains('button', 'Check this scene against canon').click();
    cy.wait('@checkRequest').then(({request}) => {
      const body = JSON.stringify(request.body);
      expect(body).to.contain('F1 — Sera — appearance: gray eyes');
      expect(body).to.contain('eyes the color of new moss');
      expect(body).not.to.contain('Beta content');
    });

    cy.contains('strong', 'Add 1 possible conflict to review').should('be.visible');
    cy.contains("the scene says 'eyes the color of new moss'").should('be.visible');
    cy.contains('2 suggestions were discarded').should('be.visible');
    withDb(readStores).then((snapshot) => {
      expect(snapshot).to.equal(baseline);
    });

    cy.contains('button', 'Confirm action').click();
    cy.contains('Added 1 possible conflict to review.').should('be.visible');
    cy.contains('li', 'Possible canon conflict for Sera').within(() => {
      cy.contains('Model-assisted check · Anthropic (Claude)').should('be.visible');
      cy.contains('Moss-colored eyes are green, not gray.').should('be.visible');
      cy.contains('button', 'Dismiss').click();
    });
    cy.contains('li', 'Possible canon conflict for Sera').should('not.exist');
    withDb(readStores).then((snapshot) => {
      expect(snapshot).to.equal(baseline);
    });
  });

  it('drops an added item when the quoted text leaves the scene', () => {
    cy.intercept('POST', ANTHROPIC_STREAM, anthropicReply(JSON.stringify({
      contradictions: [{factId: 'F1', evidence: {text: 'the color of new moss'}, summary: 'Green, not gray.'}]
    })));
    openReview();
    cy.contains('button', 'Check this scene against canon').click();
    cy.contains('button', 'Confirm action').click();
    cy.contains('li', 'Possible canon conflict for Sera').should('be.visible');

    cy.get('.tiptap[contenteditable="true"]').type('{selectall}{backspace}Sera blinked.');
    cy.contains('li', 'Possible canon conflict for Sera').should('not.exist');
  });

  it('sends nothing and spends nothing when no accepted fact mentions anyone in the scene', () => {
    let requests = 0;
    cy.intercept('POST', ANTHROPIC_STREAM, (request) => {
      requests += 1;
      request.reply(anthropicReply('{"contradictions": []}'));
    });
    cy.get('.tiptap[contenteditable="true"]').type('{selectall}{backspace}Nobody is here.');
    openReview();
    cy.contains('button', 'Check this scene against canon').click();
    cy.contains('No accepted facts mention anyone in this scene').should('be.visible');
    cy.then(() => expect(requests).to.equal(0));
  });
});
