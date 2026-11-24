import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

const PROJECT_ID = 'cypress-project-1';
const ANTHROPIC_STREAM = 'http://localhost:3001/api/anthropic/stream';

interface StoredPlotPoint {id: string; title: string; notes?: string; order: number}
interface StoredCard {id: string; title: string; summary: string; order: number; sceneIds?: string[]; plotPoints: StoredPlotPoint[]}
interface StoredScene {id: string; projectId: string; title: string; content: string}

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

const readAll = <T>(db: IDBDatabase, storeName: string): Promise<T[]> => new Promise((resolve, reject) => {
  const request = db.transaction([storeName], 'readonly').objectStore(storeName).getAll();
  request.onsuccess = () => resolve(request.result as T[]);
  request.onerror = () => reject(request.error);
});

const readBoard = (db: IDBDatabase) => Promise.all([
  readAll<StoredCard>(db, 'corkboard_chapter_cards'),
  readAll<StoredScene>(db, 'writingDocuments')
]).then(([cards, scenes]) => ({
  cards: cards.sort((a, b) => a.order - b.order),
  scenes: scenes.filter((scene) => scene.projectId === PROJECT_ID)
}));

const readWatched = (db: IDBDatabase) => Promise.all(
  ['entities', 'canonical_facts', 'lore_fact_proposals', 'state_mutation_events', 'writingDocuments', 'corkboard_chapter_cards']
    .map((storeName) => readAll(db, storeName))
).then((stores) => JSON.stringify(stores));

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
      status: 'planned', order: 1, sceneIds: [],
      plotPoints: [
        {id: 'pp-guard', chapterCardId: 'card-heist', title: 'The guard changes shift', notes: 'Two minutes.', order: 0, createdAt: 1, updatedAt: 1},
        {id: 'pp-vault', chapterCardId: 'card-heist', title: 'The vault door', notes: '', order: 1, createdAt: 1, updatedAt: 1}
      ],
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

/** One of each kind, plus a second summary revision to dismiss. Keys match the seeded board. */
const PROPOSALS = {
  proposals: [
    {kind: 'revise-card-summary', card: 'C1', summary: 'Mara reaches the city already hunted.', reason: 'Raise the stakes early.'},
    {kind: 'add-plot-point', card: 'C2', title: 'The alarm bell', notes: 'It rings early.'},
    {kind: 'revise-plot-point', plotPoint: 'C2.P1', title: 'The guard changes shift early', notes: 'One minute.'},
    {kind: 'reorder-plot-points', card: 'C2', order: ['C2.P2', 'C2.P1']},
    {kind: 'reorder-cards', order: ['C1', 'C3', 'C2']},
    {kind: 'add-card', after: 'C1', title: 'Interlude', summary: 'Mara hides in the tannery.'},
    {kind: 'plan-scene', card: 'C3', title: 'Over the wall', goal: 'Mara climbs out as the bell rings.'},
    {kind: 'revise-card-summary', card: 'C3', summary: 'She is caught on the wall.'}
  ]
};

const chat = () => cy.get('section[aria-labelledby="corkboard-planning-chat"]');
const proposal = (title: string) => cy.contains('strong', title).closest('section');
const confirm = (title: string) => proposal(title).within(() => cy.contains('button', 'Confirm action').click());

/** Retries a database read until `check` passes; autosave is debounced. */
function eventuallyBoard(check: (board: Awaited<ReturnType<typeof readBoard>>) => void, attempts = 30): void {
  withDb(readBoard).then((board) => {
    try {
      check(board);
    } catch (error) {
      if (attempts <= 1) throw error;
      cy.wait(100);
      eventuallyBoard(check, attempts - 1);
    }
  });
}

describe('Corkboard planning chat proposals (4.86)', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.window().then((win) => win.localStorage.setItem('anthropic_api_key', 'cypress-test-key'));
    withDb(seedCards);
    cy.visit('/corkboard');
    cy.contains('button', 'The Heist').click();
  });

  it('accepts one proposal of each kind, dismisses one, and changes nothing before acceptance', () => {
    cy.intercept('POST', ANTHROPIC_STREAM, anthropicReply('Open on the hunt and move the heist last.')).as('chatRequest');
    chat().within(() => {
      cy.contains('label', 'Message').find('textarea').type('How should the book be ordered?');
      cy.contains('button', 'Send').click();
    });
    cy.wait('@chatRequest');
    chat().contains('Open on the hunt and move the heist last.').should('be.visible');

    let baseline = '';
    withDb(readWatched).then((snapshot) => {
      baseline = snapshot;
    });

    cy.intercept('POST', ANTHROPIC_STREAM, anthropicReply(JSON.stringify(PROPOSALS))).as('proposalRequest');
    chat().contains('button', 'Propose changes').click();
    cy.wait('@proposalRequest').then(({request}) => {
      const body = JSON.stringify(request.body);
      expect(body).to.contain('Reply with JSON only');
      expect(body).to.contain('[C2] Chapter 2: The Heist');
      expect(body).to.contain('[C2.P1] The guard changes shift');
      expect(body).to.contain('Open on the hunt and move the heist last.');
    });

    proposal('Plan a scene: Chapter 3, Escape').should('contain', 'Mara climbs out as the bell rings.');
    proposal('Revise a card summary: Chapter 1, Arrival').should('contain', 'Mara reaches the city.');
    chat().contains('Nothing on the board changes until you confirm a proposal.').should('be.visible');
    // Proposals shown, nothing written.
    withDb(readWatched).then((snapshot) => {
      expect(snapshot).to.equal(baseline);
    });

    proposal('Revise a card summary: Chapter 3, Escape').within(() => cy.contains('button', 'Dismiss').click());
    cy.contains('strong', 'Revise a card summary: Chapter 3, Escape').should('not.exist');

    // Order matters only where one proposal's basis is another's target.
    confirm('Revise a card summary: Chapter 1, Arrival');
    confirm('Revise a plot point: plot point 1 of Chapter 2, The Heist');
    confirm('Reorder plot points: Chapter 2, The Heist');
    confirm('Add a plot point: Chapter 2, The Heist');
    confirm('Reorder chapter cards: the board');
    confirm('Add a chapter card: after Chapter 1, Arrival');
    confirm('Plan a scene: Chapter 3, Escape');
    cy.contains('Created "Over the wall" and linked it to Escape.').should('be.visible');
    chat().contains('Pending action').should('not.exist');

    eventuallyBoard(({cards, scenes}) => {
      expect(cards.map((card) => card.title)).to.deep.equal(['Arrival', 'Interlude', 'Escape', 'The Heist']);
      expect(cards[0]!.summary).to.equal('Mara reaches the city already hunted.');
      expect(cards[1]!.summary).to.equal('Mara hides in the tannery.');
      // The dismissed revision left Escape's summary alone.
      expect(cards[2]!.summary).to.equal('She flees over the walls.');
      const heist = cards[3]!;
      expect([...heist.plotPoints].sort((a, b) => a.order - b.order).map((point) => point.title)).to.deep.equal([
        'The vault door',
        'The guard changes shift early',
        'The alarm bell'
      ]);
      expect(heist.plotPoints.find((point) => point.id === 'pp-guard')!.notes).to.equal('One minute.');
      const scene = scenes.find((entry) => entry.title === 'Over the wall');
      expect(scene, 'planned scene').to.exist;
      expect(scene!.content).to.equal('<p></p>');
      expect(cards[2]!.sceneIds).to.deep.equal([scene!.id]);
    });
  });
});
