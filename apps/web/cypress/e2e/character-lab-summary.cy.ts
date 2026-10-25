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

const stream = (text: string) => ({
  statusCode: 200,
  headers: {'content-type': 'text/event-stream'},
  body: [`data: ${JSON.stringify({choices: [{delta: {content: text}, finish_reason: 'stop'}]})}`, 'data: [DONE]', ''].join('\n\n')
});

const SUMMARY_HEADING = 'Summary of the earlier conversation';
// About 450 estimated tokens each, so four turns fill well over a third of a 4096-token model.
const longReply = (tag: string) => `${tag} ${'I remember the oath and the road. '.repeat(40)}`;

type Body = {messages: Array<{role: string; content: string}>};
const systemOf = (body: Body) => body.messages.find((message) => message.role === 'system')?.content ?? '';
const turnsOf = (body: Body) => JSON.stringify(body.messages.filter((message) => message.role !== 'system'));

describe('Rolling summaries in the Character Lab (4.74)', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.window().then((win) => seed(win));
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('offers a summary for a long conversation, sends it instead of the old turns, and can edit or remove it', () => {
    const replies = [
      longReply('REPLY-ONE'),
      longReply('REPLY-TWO'),
      longReply('REPLY-THREE'),
      longReply('REPLY-FOUR'),
      'SUMMARY-TEXT Aria explained her oath to the Ember Court.',
      'REPLY-FIVE Yes.',
      'REPLY-SIX Still yes.',
      'REPLY-SEVEN As I said.'
    ];
    const bodies: Body[] = [];
    cy.intercept('GET', `${LOCAL_SERVER}/models`, {statusCode: 200, body: {data: [{id: 'kobold-model'}]}});
    cy.intercept('GET', 'http://localhost:5001/props', {statusCode: 200, body: {default_generation_settings: {n_ctx: 4096}}});
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

    const send = (text: string, expected: string) => {
      cy.contains('label', 'Your message').find('textarea').type(text, {delay: 0});
      cy.contains('button', /^Send$/).click();
      cy.contains(expected).should('exist');
    };

    cy.get('[role="dialog"][aria-labelledby="character-lab-title"]').within(() => {
      send('Who do you serve?', 'REPLY-ONE');
      send('Why?', 'REPLY-TWO');
      cy.contains('button', 'Summarize earlier turns').should('not.exist');
      send('And then?', 'REPLY-THREE');
      send('After that?', 'REPLY-FOUR');

      cy.contains(/fills about \d+% of the model’s context/).should('exist');
      cy.contains('button', 'Summarize earlier turns').click();
      cy.get(`section[aria-label="${SUMMARY_HEADING}"] textarea`).should('have.value', replies[4]);
      cy.contains(`${SUMMARY_HEADING} · 2 turns · not canon`).should('exist');
      cy.get('li[data-summarized]').should('have.length', 2).and('contain', 'REPLY-ONE').and('contain', 'REPLY-TWO');

      send('Do you regret it?', 'REPLY-FIVE');

      cy.get(`section[aria-label="${SUMMARY_HEADING}"] textarea`).clear().type('EDITED-SUMMARY She swore at dawn.', {delay: 0});
      cy.contains(`${SUMMARY_HEADING} · 2 turns · not canon · edited`).should('exist');
      send('Truly?', 'REPLY-SIX');

      cy.contains('button', 'Remove summary').click();
      cy.get('li[data-summarized]').should('not.exist');
      send('Once more.', 'REPLY-SEVEN');
    });

    cy.wrap(bodies).should('have.length', 8).then(() => {
      // The summary request carries only the turns it summarizes, never the character's records.
      const summaryRequest = JSON.stringify(bodies[4]!.messages);
      expect(systemOf(bodies[4]!)).to.contain('not canon');
      expect(summaryRequest).to.contain('REPLY-ONE');
      expect(summaryRequest).to.contain('REPLY-TWO');
      expect(summaryRequest).not.to.contain('REPLY-THREE');
      expect(summaryRequest).not.to.contain('hedge knight');

      // With the summary: it replaces turns one and two; later turns go in full.
      expect(systemOf(bodies[5]!)).to.contain(replies[4]);
      expect(turnsOf(bodies[5]!)).not.to.contain('REPLY-ONE');
      expect(turnsOf(bodies[5]!)).not.to.contain('REPLY-TWO');
      expect(turnsOf(bodies[5]!)).to.contain('REPLY-THREE');
      expect(turnsOf(bodies[5]!)).to.contain('REPLY-FOUR');

      // The edited wording is what the model gets next.
      expect(systemOf(bodies[6]!)).to.contain('EDITED-SUMMARY');
      expect(systemOf(bodies[6]!)).not.to.contain('SUMMARY-TEXT');

      // Removed: every turn goes in full again, and no summary.
      expect(systemOf(bodies[7]!)).not.to.contain('EDITED-SUMMARY');
      expect(systemOf(bodies[7]!)).not.to.contain('Summary of your earlier conversation');
      expect(turnsOf(bodies[7]!)).to.contain('REPLY-ONE');
    });
  });
});
