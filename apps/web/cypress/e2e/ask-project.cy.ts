import {DB_NAME, DB_VERSION} from '../../src/db';

const PROJECT_ID = 'cypress-project-1';
const ANTHROPIC_STREAM = 'http://localhost:3001/api/anthropic/stream';

const anthropicReply = (text: string) => ({
  statusCode: 200,
  headers: {'content-type': 'text/event-stream'},
  body: [
    `data: ${JSON.stringify({type: 'content_block_delta', delta: {type: 'text_delta', text}})}`,
    'data: [DONE]',
    ''
  ].join('\n\n')
});

function seed(win: Window): Promise<void> {
  const now = Date.now();
  return new Promise((resolve, reject) => {
    const request = win.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['entityCategories', 'entities', 'lore_documents', 'lore_fact_proposals'], 'readwrite');
      tx.objectStore('entityCategories').put({
        id: 'characters', projectId: PROJECT_ID, kind: 'character', name: 'Characters',
        slug: 'characters', fieldSchema: [], createdAt: now
      });
      tx.objectStore('entities').put({
        id: 'entity-sera', projectId: PROJECT_ID, categoryId: 'characters', name: 'Sera',
        fields: {}, links: [], createdAt: now, updatedAt: now
      });
      tx.objectStore('lore_documents').put({
        id: 'note-rumors', projectId: PROJECT_ID, title: 'Harbor rumors', kind: 'general_lore', format: 'plain_text',
        content: 'They say Sera was a spy all along.', source: {type: 'manual'}, status: 'active',
        createdAt: now, updatedAt: now
      });
      tx.objectStore('lore_fact_proposals').put({
        id: 'proposal-spy', projectId: PROJECT_ID, loreDocumentId: 'note-rumors', targetType: 'entity',
        targetId: 'entity-sera', targetName: 'Sera', factType: 'background', value: 'secretly a spy',
        confidence: 0.8, evidence: {start: 9, end: 33, text: 'Sera was a spy all along'},
        status: 'proposed', createdAt: now, updatedAt: now
      });
      tx.oncomplete = () => {db.close(); resolve();};
      tx.onerror = () => {db.close(); reject(tx.error);};
      tx.onabort = () => {db.close(); reject(tx.error);};
    };
  });
}

const ask = (question: string) => {
  cy.get('textarea[placeholder^="Ask about your characters"]').should('not.be.disabled').type(question);
  cy.contains('button', /^Send$/).click();
};

describe('Ask your project', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.window().then((win) => seed(win));
    cy.window().then((win) => win.localStorage.setItem('anthropic_api_key', 'cypress-test-key'));
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('is reachable from More, answers factual questions without guessing, and lists pending proposals only when asked', () => {
    let requests = 0;
    cy.intercept('POST', ANTHROPIC_STREAM, (request) => {
      requests += 1;
      request.reply(anthropicReply('unexpected'));
    });
    cy.contains('button', 'More').click();
    cy.contains('a', 'Ask your project').click();
    cy.location('pathname').should('eq', '/ask');
    cy.contains('h1', 'Ask your project').should('be.visible');
    cy.contains('button', 'Ask the writing coach').should('not.exist');

    ask('Is Sera a spy?');
    cy.contains("won't guess").should('be.visible');
    cy.contains('Pending, not accepted canon').should('not.exist');

    cy.contains('label', 'Include pending proposals').find('input').check();
    cy.contains('1 pending proposal from Source Notes').should('be.visible');
    ask('Was Sera ever a spy?');
    cy.contains('Pending, not accepted canon (from Source Note review):').should('be.visible');
    cy.contains('- Sera — background: secretly a spy').should('be.visible');
    cy.then(() => expect(requests, 'factual questions never reach the model').to.equal(0));

    // A separate conversation from the Workspace drawer.
    cy.window().then((win) => {
      expect(win.sessionStorage.getItem(`wbd:assistant-conversation:ask:${PROJECT_ID}`)).to.contain('Was Sera ever a spy?');
      expect(win.sessionStorage.getItem(`wbd:assistant-conversation:${PROJECT_ID}`) ?? '').not.to.contain('Was Sera ever a spy?');
    });
  });

  it('labels pending proposals for discussion, and keeps them out unless asked', () => {
    cy.intercept('POST', ANTHROPIC_STREAM, anthropicReply('If the rumor holds, her loyalty becomes the open question.')).as('discussion');
    cy.visit('/ask');
    ask('Help me think through the spy rumor about Sera.');
    cy.wait('@discussion').then(({request}) => {
      expect(JSON.stringify(request.body)).not.to.contain('secretly a spy');
    });

    cy.contains('label', 'Include pending proposals').find('input').check();
    cy.contains('1 pending proposal from Source Notes').should('be.visible');
    ask('Help me think through the spy rumor about Sera.');
    cy.wait('@discussion').then(({request}) => {
      const body = JSON.stringify(request.body);
      expect(body).to.contain('Pending proposal, not canon - Sera — background: secretly a spy');
      expect(body).to.contain('never as established fact');
    });
    cy.contains('her loyalty becomes the open question').should('be.visible');
  });

  it('saves a reply only through the Source Note preview', () => {
    cy.intercept('POST', ANTHROPIC_STREAM, anthropicReply('A harbor smuggler could have started the rumor.'));
    cy.visit('/ask');
    ask('Brainstorm who started the rumor about Sera.');
    cy.contains('A harbor smuggler could have started the rumor.').should('be.visible');
    cy.contains('button', 'Save as Source Note').click();
    cy.contains('strong', 'Save as draft Source Note').should('be.visible');
    cy.contains('button', 'Confirm action').click();
    cy.contains('as a draft Source Note').should('be.visible');
    cy.visit('/lore');
    cy.contains('A harbor smuggler could have started the rumor.').should('exist');
  });
});
