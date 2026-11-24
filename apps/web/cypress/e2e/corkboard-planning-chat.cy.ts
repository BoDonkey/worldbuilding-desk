import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

const PROJECT_ID = 'cypress-project-1';
const ANTHROPIC_STREAM = 'http://localhost:3001/api/anthropic/stream';
const WATCHED_STORES = [
  'entities',
  'canonical_facts',
  'lore_fact_proposals',
  'state_mutation_events',
  'writingDocuments',
  'corkboard_chapter_cards'
] as const;

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

function seedCards(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['corkboard_chapter_cards'], 'readwrite');
    const store = tx.objectStore('corkboard_chapter_cards');
    store.put({
      id: 'card-arrival', projectId: PROJECT_ID, title: 'Arrival', summary: 'Mara reaches the city.',
      status: 'written', order: 0, sceneIds: [], plotPoints: [], createdAt: 1, updatedAt: 1
    });
    store.put({
      id: 'card-heist', projectId: PROJECT_ID, title: 'The Heist', summary: 'Mara breaks into the archive.',
      status: 'planned', order: 1, sceneIds: ['scene-gamma'],
      plotPoints: [{
        id: 'pp-guard', chapterCardId: 'card-heist', title: 'The guard changes shift',
        notes: 'Mara has two minutes.', order: 0, createdAt: 1, updatedAt: 1
      }],
      createdAt: 1, updatedAt: 1
    });
    store.put({
      id: 'card-escape', projectId: PROJECT_ID, title: 'Escape', summary: 'She flees over the walls.',
      status: 'planned', order: 2, sceneIds: [], plotPoints: [], createdAt: 1, updatedAt: 1
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const chat = () => cy.get('section[aria-labelledby="corkboard-planning-chat"]');

describe('Corkboard planning chat (4.85)', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.window().then((win) => win.localStorage.setItem('anthropic_api_key', 'cypress-test-key'));
    withDb(seedCards);
    cy.visit('/corkboard');
    cy.contains('button', 'The Heist').click();
  });

  it('talks about the whole board, then this card, without changing anything', () => {
    let baseline = '';
    withDb(readStores).then((snapshot) => {
      baseline = snapshot;
    });

    cy.intercept('POST', ANTHROPIC_STREAM, anthropicReply('The middle needs a cost for Mara.')).as('boardRequest');
    chat().within(() => {
      cy.contains('label', 'Whole board').find('input').should('be.checked');
      cy.contains("Sends your message, every chapter card").should('be.visible');
      cy.contains('label', 'Message').find('textarea').type('Where does the middle sag?');
      cy.contains('button', 'Send').click();
    });
    cy.wait('@boardRequest').then(({request}) => {
      const body = JSON.stringify(request.body);
      expect(body).to.contain('Chapter 1: Arrival [written]');
      expect(body).to.contain('Chapter 2: The Heist [planned]');
      expect(body).to.contain('Chapter 3: Escape [planned]');
      expect(body).to.contain('Gamma Scene (');
      // Whole board sends plot point titles, not notes, and no scene prose.
      expect(body).to.contain('The guard changes shift');
      expect(body).not.to.contain('Mara has two minutes.');
      expect(body).not.to.contain('Gamma content');
    });
    chat().contains('The middle needs a cost for Mara.').should('be.visible');

    cy.intercept('POST', ANTHROPIC_STREAM, anthropicReply('Open on the guard, not the door.')).as('cardRequest');
    chat().within(() => {
      cy.contains('label', 'This card: The Heist').find('input').check();
      cy.contains('label', 'Include the opening of each linked scene').find('input').check();
      cy.contains('the opening of each linked scene, and related World Bible records').should('be.visible');
      cy.contains('label', 'Message').find('textarea').type('What scenes does this chapter need?');
      cy.contains('button', 'Send').click();
    });
    cy.wait('@cardRequest').then(({request}) => {
      const body = JSON.stringify(request.body);
      expect(body).to.contain('chapter 2 of 3');
      expect(body).to.contain('Mara has two minutes.');
      expect(body).to.contain('Previous chapter — Chapter 1: Arrival');
      expect(body).to.contain('Next chapter — Chapter 3: Escape');
      expect(body).to.contain('Opening excerpt:');
      expect(body).to.contain('Gamma content');
      // The earlier turn goes with the follow-up.
      expect(body).to.contain('The middle needs a cost for Mara.');
    });
    chat().contains('Open on the guard, not the door.').should('be.visible');

    withDb(readStores).then((snapshot) => {
      expect(snapshot).to.equal(baseline);
    });
  });
});
