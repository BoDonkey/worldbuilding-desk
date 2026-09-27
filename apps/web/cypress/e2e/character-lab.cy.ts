import {DB_NAME, DB_VERSION} from '../../src/db';

const PROJECT_ID = 'cypress-project-1';
const ANTHROPIC_STREAM = 'http://localhost:3001/api/anthropic/stream';
const OLLAMA_CHAT = 'http://localhost:11434/api/chat';
const WATCHED_STORES = [
  'entities',
  'entityCategories',
  'characters',
  'character_sheets',
  'canonical_facts',
  'lore_fact_proposals',
  'state_mutation_events',
  'writingDocuments'
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

function seedAria(db: IDBDatabase): Promise<void> {
  const now = Date.now();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ['entityCategories', 'entities', 'character_sheets', 'canonical_facts', 'lore_fact_proposals'],
      'readwrite'
    );
    tx.objectStore('entityCategories').put({
      id: 'characters', projectId: PROJECT_ID, kind: 'character', name: 'Characters',
      slug: 'characters', fieldSchema: [], createdAt: now
    });
    tx.objectStore('entities').put({
      id: 'entity-aria', projectId: PROJECT_ID, categoryId: 'characters', name: 'Aria',
      fields: {notes: '<p>A hedge knight who distrusts courts.</p>'}, links: [],
      createdAt: now, updatedAt: now
    });
    tx.objectStore('character_sheets').put({
      id: 'sheet-aria-1', projectId: PROJECT_ID, characterEntityId: 'entity-aria', name: 'Aria',
      level: 5, experience: 2300,
      stats: [{definitionId: 'strength', value: 14}],
      resources: [{definitionId: 'hp', current: 32, max: 40}],
      inventory: [], createdAt: now, updatedAt: now
    });
    tx.objectStore('canonical_facts').put({
      id: 'fact-aria-oath', projectId: PROJECT_ID, targetType: 'entity', targetId: 'entity-aria',
      targetName: 'Aria', factType: 'membership', value: 'sworn to the Ember Court',
      acceptedAt: now, updatedAt: now
    });
    // Saved as canon but its proposal never finished accepting: must not ground Aria.
    tx.objectStore('canonical_facts').put({
      id: 'fact-aria-half-accepted', projectId: PROJECT_ID, targetType: 'entity', targetId: 'entity-aria',
      targetName: 'Aria', factType: 'background', value: 'secretly a spy',
      sourceProposalId: 'proposal-aria-spy', acceptedAt: now, updatedAt: now
    });
    tx.objectStore('lore_fact_proposals').put({
      id: 'proposal-aria-spy', projectId: PROJECT_ID, loreDocumentId: 'lore-aria', targetType: 'entity',
      targetId: 'entity-aria', factType: 'background', value: 'secretly a spy', confidence: 0.9,
      evidence: {start: 0, end: 4, text: 'spy'}, status: 'proposed', createdAt: now, updatedAt: now
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function seedSceneCast(db: IDBDatabase): Promise<void> {
  const now = Date.now();
  const character = (id: string, name: string, notes: string) => ({
    id, projectId: PROJECT_ID, categoryId: 'characters', name,
    fields: {notes: `<p>${notes}</p>`}, links: [], createdAt: now, updatedAt: now
  });
  const fact = (id: string, targetId: string, targetName: string, value: string) => ({
    id, projectId: PROJECT_ID, targetType: 'entity', targetId, targetName, factType: 'trait',
    value, acceptedAt: now, updatedAt: now
  });
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ['entities', 'canonical_facts', 'world_canvases', 'corkboard_chapter_cards'],
      'readwrite'
    );
    tx.objectStore('entities').put(character('entity-borin', 'Borin', 'A smith who owes the wrong people.'));
    tx.objectStore('entities').put(character('entity-cael', 'Cael', 'A courier nobody remembers.'));
    tx.objectStore('canonical_facts').put(fact('fact-borin', 'entity-borin', 'Borin', 'laughs when frightened'));
    tx.objectStore('canonical_facts').put(fact('fact-cael', 'entity-cael', 'Cael', 'CAEL-ONLY-FACT'));
    tx.objectStore('world_canvases').put({
      schemaVersion: 2, id: PROJECT_ID, projectId: PROJECT_ID, premise: '', lenses: [],
      openThreads: [
        {id: 'thread-toll', text: 'Who collects the bridge toll?', status: 'open', createdAt: now, updatedAt: now},
        {id: 'thread-done', text: 'SETTLED-THREAD', status: 'settled', createdAt: now, updatedAt: now + 1}
      ],
      createdAt: now, updatedAt: now
    });
    tx.objectStore('corkboard_chapter_cards').put({
      id: 'card-gate', projectId: PROJECT_ID, title: 'The gate', summary: 'Aria refuses the bribe.',
      status: 'planned', order: 0, sceneIds: ['scene-alpha'], plotPoints: [], createdAt: now, updatedAt: now
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const labDialog = () => cy.get('[role="dialog"][aria-labelledby="character-lab-title"]');
const sceneDialog = () => cy.get('[role="dialog"][aria-labelledby="character-scene-title"]');

describe('Character lab', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    withDb(seedAria);
    cy.window().then((win) => win.localStorage.setItem('anthropic_api_key', 'cypress-test-key'));
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('talks to a character from World Bible and saves the transcript to the Scratchpad without changing canon', () => {
    cy.intercept('POST', ANTHROPIC_STREAM, anthropicReply('Courts are for people who like knives in the back.'))
      .as('labRequest');
    cy.visit('/world-bible');
    cy.contains('h1', 'World Bible').should('be.visible');
    cy.contains('button', 'Characters').click();
    cy.contains('[class*="entityName"]', /^Aria$/).parents('li').first().within(() => {
      cy.contains('button', 'Edit').click();
    });

    let baseline = '';
    withDb(readStores).then((snapshot) => {
      baseline = snapshot;
    });

    cy.contains('button', 'Talk to Aria').click();
    labDialog().within(() => {
      cy.contains('h2', 'Talk to Aria').should('be.visible');
      cy.contains('Accepted canon facts - Aria').should('be.visible');
      cy.contains('not what Aria knows').should('be.visible');
      cy.get('article[aria-label="Aria stats"]').should('contain.text', '32 / 40');
      cy.contains('to Anthropic’s servers only when you send').should('be.visible');

      cy.get('textarea').first().type('What do you think of the royal court?');
      cy.contains('button', /^Send$/).click();
    });

    cy.wait('@labRequest').then(({request}) => {
      const body = JSON.stringify(request.body);
      expect(body).to.contain('What do you think of the royal court?');
      expect(body).to.contain('sworn to the Ember Court');
      expect(body).to.contain('A hedge knight who distrusts courts.');
      expect(body).not.to.contain('secretly a spy');
    });

    labDialog().within(() => {
      cy.contains('Courts are for people who like knives in the back.').should('be.visible');
      cy.contains('button', 'Save to Scratchpad').click();
      cy.contains('[role="status"]', 'Saved to Scratchpad.').should('be.visible');
      cy.contains('button', 'Close').click();
    });

    cy.contains('button', /^Scratchpad$/).first().click();
    cy.get('[role="dialog"][aria-label="Project scratchpad"]').within(() => {
      cy.contains('Character lab: Aria').should('be.visible');
      cy.contains('What do you think of the royal court?').should('be.visible');
      cy.contains('Courts are for people who like knives in the back.').should('be.visible');
    });

    withDb(readStores).then((snapshot) => {
      expect(snapshot).to.equal(baseline);
    });
  });

  it('runs a reaction test from the Workspace drawer at the current scene and keeps the session transcript', () => {
    cy.intercept('POST', ANTHROPIC_STREAM, anthropicReply('She steps between them before she thinks.'))
      .as('labRequest');
    cy.visit('/workspace');
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'Alpha content');

    let baseline = '';
    withDb(readStores).then((snapshot) => {
      baseline = snapshot;
    });

    cy.contains('button', 'Context').click();
    cy.contains('button', /^Characters$/).click();
    cy.contains('label', 'Character').find('select').should('have.value', 'entity-aria');
    cy.contains('button', 'Open character lab').click();

    labDialog().within(() => {
      cy.contains('label', 'Story point').find('select').should('have.value', 'scene-alpha');
      cy.contains('label', 'Moment').find('select').should('have.value', 'cursor');
      cy.contains('button', 'Reaction test').click();
      cy.get('textarea').first().type('A stranger draws a blade on a child.');
      cy.contains('button', 'Test reaction').click();
    });

    cy.wait('@labRequest').then(({request}) => {
      const body = JSON.stringify(request.body);
      expect(body).to.contain('A stranger draws a blade on a child.');
      expect(body).to.contain('Alpha Scene');
    });

    labDialog().within(() => {
      cy.contains('She steps between them before she thinks.').should('be.visible');
      cy.contains('button', 'Close').click();
    });

    cy.contains('button', 'Open character lab').click();
    labDialog().within(() => {
      cy.contains('A stranger draws a blade on a child.').should('be.visible');
      cy.contains('She steps between them before she thinks.').should('be.visible');
      cy.contains('button', 'Close').click();
    });

    withDb(readStores).then((snapshot) => {
      expect(snapshot).to.equal(baseline);
    });
  });
  it('grounds local Ollama runs in the system message and stops a slow reply cleanly', () => {
    cy.intercept('POST', OLLAMA_CHAT, {
      statusCode: 200,
      headers: {'content-type': 'application/x-ndjson'},
      body: [
        JSON.stringify({message: {role: 'assistant', content: 'Too late.'}}),
        JSON.stringify({done: true, done_reason: 'stop'})
      ].join('\n'),
      delay: 15000
    }).as('slowLocal');
    cy.setSeededProjectProvider('ollama');
    cy.visit('/world-bible');
    cy.contains('button', 'Characters').click();
    cy.contains('[class*="entityName"]', /^Aria$/).parents('li').first().within(() => {
      cy.contains('button', 'Edit').click();
    });
    cy.contains('button', 'Talk to Aria').click();

    labDialog().within(() => {
      cy.contains('Runs on your local Ollama model. Nothing leaves this computer.').should('be.visible');
      cy.get('textarea').first().type('Who do you serve?');
      cy.contains('button', /^Send$/).click();
      cy.contains('[role="status"]', 'Waiting for the model…').should('be.visible');
    });

    cy.get('@slowLocal.all').should('have.length', 1).then((calls) => {
      const {request} = (calls as unknown as Array<{request: {body: {messages: Array<{role: string; content: string}>}}}>)[0];
      const [system, ...rest] = request.body.messages;
      expect(system.role).to.equal('system');
      expect(system.content).to.contain('sworn to the Ember Court');
      expect(system.content).to.contain('not what any character knows');
      expect(rest[rest.length - 1]).to.deep.equal({role: 'user', content: 'Who do you serve?'});
    });

    labDialog().within(() => {
      cy.contains('button', 'Stop').click();
      cy.contains('Stopped before the reply finished.').should('be.visible');
      cy.contains('Too late.').should('not.exist');
    });
  });
  describe('character scenes', () => {
    beforeEach(() => {
      withDb(seedSceneCast);
      cy.reload();
      cy.visit('/workspace');
      cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'Alpha content');
    });

    const openSceneFromDrawer = () => {
      cy.contains('button', 'Context').click();
      cy.contains('button', /^Characters$/).click();
      cy.contains('button', 'Write a character scene').click();
    };

    it('writes a directed scene from only the chosen characters and inserts it as an undoable edit', () => {
      cy.intercept('POST', ANTHROPIC_STREAM, anthropicReply('Aria: "Put the hammer down."\nBorin laughs, and does not.'))
        .as('sceneRequest');
      let baseline = '';
      withDb(readStores).then((snapshot) => {
        baseline = snapshot;
      });
      openSceneFromDrawer();

      sceneDialog().within(() => {
        cy.contains('label', 'Aria').find('input').should('be.checked');
        cy.contains('button', 'Write scene').should('be.disabled');
        cy.contains('label', 'Borin').find('input').check();
        cy.contains('label', 'Scene setup').find('textarea').type('Borin blocks the forge door at dusk.');
        cy.contains('button', 'Write scene').click();
      });

      cy.wait('@sceneRequest').then(({request}) => {
        const body = JSON.stringify(request.body);
        expect(body).to.contain('Borin blocks the forge door at dusk.');
        expect(body).to.contain('sworn to the Ember Court');
        expect(body).to.contain('laughs when frightened');
        expect(body).not.to.contain('CAEL-ONLY-FACT');
        expect(body).not.to.contain('A courier nobody remembers.');
      });

      sceneDialog().within(() => {
        cy.contains('Borin laughs, and does not.').should('be.visible');
      });
      withDb(readStores).then((snapshot) => {
        expect(snapshot).to.equal(baseline);
      });

      sceneDialog().contains('button', 'Insert at cursor').click();
      sceneDialog().should('not.exist');
      cy.get('.tiptap-editor').should('contain.text', 'Borin laughs, and does not.');
      cy.get('.tiptap[contenteditable="true"]').type('{cmd+z}');
      cy.get('.tiptap-editor').should('not.contain.text', 'Borin laughs, and does not.');
      cy.get('.tiptap-editor').should('contain.text', 'Alpha content');
    });

    it('surprises from the linked chapter card and open threads, then saves to the Scratchpad', () => {
      cy.intercept('POST', ANTHROPIC_STREAM, anthropicReply('The toll collector knows Aria by name.'))
        .as('sceneRequest');
      openSceneFromDrawer();

      sceneDialog().within(() => {
        cy.contains('label', 'Borin').find('input').check();
        cy.contains('label', 'Cael').find('input').check();
        cy.contains('button', 'Surprise me').click();
        cy.contains('li', 'Chapter card "The gate": Aria refuses the bribe.').should('be.visible');
        cy.contains('li', 'Open thread: Who collects the bridge toll?').should('be.visible');
        cy.contains('SETTLED-THREAD').should('not.exist');
        cy.contains('button', 'Write scene').click();
      });

      cy.wait('@sceneRequest').then(({request}) => {
        const body = JSON.stringify(request.body);
        expect(body).to.contain('Aria refuses the bribe.');
        expect(body).to.contain('Who collects the bridge toll?');
        expect(body).to.contain('CAEL-ONLY-FACT');
        expect(body).not.to.contain('SETTLED-THREAD');
      });

      sceneDialog().within(() => {
        cy.contains('The toll collector knows Aria by name.').should('be.visible');
        cy.contains('button', 'Save to Scratchpad').click();
        cy.contains('[role="status"]', 'Saved to Scratchpad.').should('be.visible');
        cy.contains('button', 'Close').click();
      });

      cy.contains('button', 'Scratchpad').first().click();
      cy.contains('Character scene: Aria, Borin, Cael').should('be.visible');
      cy.contains('The toll collector knows Aria by name.').should('be.visible');
    });
  });
});
