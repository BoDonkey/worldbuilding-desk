import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

const PROJECT_ID = 'cypress-project-1';
const LOCAL_SERVER = 'http://localhost:5001/v1';

function seed(win: Window): Promise<void> {
  const now = Date.now();
  return new Promise((resolve, reject) => {
    const open = win.indexedDB.open(DB_NAME, DB_VERSION);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['entityCategories', 'entities', 'projectSettings'], 'readwrite');
      tx.objectStore('entityCategories').put({
        id: 'characters', projectId: PROJECT_ID, kind: 'character', name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: now
      });
      tx.objectStore('entities').put({
        id: 'entity-aria', projectId: PROJECT_ID, categoryId: 'characters', name: 'Aria',
        fields: {notes: '<p>A hedge knight.</p>'}, links: [], createdAt: now, updatedAt: now
      });
      const settings = tx.objectStore('projectSettings');
      const get = settings.get('settings-cypress-project-1');
      get.onsuccess = () => settings.put({...get.result, aiSettings: {...get.result.aiSettings, provider: 'local-openai'}});
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
}

function readScratchpads(win: Window): Promise<string> {
  return new Promise((resolve, reject) => {
    const open = win.indexedDB.open(DB_NAME, DB_VERSION);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction(['scratchpads'], 'readonly').objectStore('scratchpads').getAll();
      request.onsuccess = () => {
        db.close();
        resolve(JSON.stringify(request.result));
      };
      request.onerror = () => reject(request.error);
    };
  });
}

const stream = (text: string) => ({
  statusCode: 200,
  headers: {'content-type': 'text/event-stream'},
  body: [`data: ${JSON.stringify({choices: [{delta: {content: text}, finish_reason: 'stop'}]})}`, 'data: [DONE]', ''].join('\n\n')
});

describe('Alternative replies in the Character Lab (4.73)', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.window().then((win) => seed(win));
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('asks for another version, steps back, and keeps only the version shown', () => {
    const replies = ['REPLY-ONE The Ember Court.', 'REPLY-TWO No one at all.', 'REPLY-THREE Because I swore.'];
    const bodies: Array<{messages: Array<{role: string; content: string}>}> = [];
    cy.intercept('GET', `${LOCAL_SERVER}/models`, {statusCode: 200, body: {data: [{id: 'kobold-model'}]}});
    cy.intercept('GET', 'http://localhost:5001/props', {statusCode: 200, body: {default_generation_settings: {n_ctx: 8192}}});
    cy.intercept('POST', `${LOCAL_SERVER}/chat/completions`, (req) => {
      bodies.push(req.body);
      req.reply(stream(replies[bodies.length - 1] ?? 'extra'));
    }).as('localServer');

    cy.visit('/world-bible');
    cy.contains('button', 'Characters').click();
    cy.contains('[class*="entityName"]', /^Aria$/).parents('li').first().within(() => {
      cy.contains('button', 'Edit').click();
    });
    cy.contains('button', 'Talk to Aria').click();

    cy.get('[role="dialog"][aria-labelledby="character-lab-title"]').within(() => {
      cy.get('textarea').first().type('Who do you serve?');
      cy.contains('button', /^Send$/).click();
      cy.contains('REPLY-ONE').should('exist');
      cy.contains('button', 'Another version').click();
      cy.contains('REPLY-TWO').should('exist');
      cy.contains('Version 2 of 2').should('exist');
      cy.contains('REPLY-ONE').should('not.exist');
      cy.get('button[aria-label="Previous version"]').click();
      cy.contains('REPLY-ONE').should('exist');
      cy.contains('Version 1 of 2').should('exist');

      cy.get('textarea').first().type('Why?');
      cy.contains('button', /^Send$/).click();
      cy.contains('REPLY-THREE').should('exist');
      cy.contains(/Version \d of \d/).should('not.exist');
      cy.contains('REPLY-TWO').should('not.exist');
      cy.contains('button', 'Save to Scratchpad').click();
      cy.contains('[role="status"]', 'Saved to Scratchpad.').should('exist');
    });

    cy.wrap(bodies).should('have.length', 3).then(() => {
      // The second version repeated the first request exactly.
      expect(bodies[1]).to.deep.equal(bodies[0]);
      const third = JSON.stringify(bodies[2]!.messages);
      expect(third).to.contain('REPLY-ONE');
      expect(third).not.to.contain('REPLY-TWO');
    });
    cy.window().then((win) => readScratchpads(win)).then((saved) => {
      expect(saved).to.contain('REPLY-ONE');
      expect(saved).to.contain('REPLY-THREE');
      expect(saved).not.to.contain('REPLY-TWO');
    });
  });
});
