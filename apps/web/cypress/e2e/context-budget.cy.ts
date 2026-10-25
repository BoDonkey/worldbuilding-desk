import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

const PROJECT_ID = 'cypress-project-1';
const LOCAL_SERVER = 'http://localhost:5001/v1';
const FACT_COUNT = 60;

function seed(win: Window): Promise<void> {
  const now = Date.now();
  return new Promise((resolve, reject) => {
    const open = win.indexedDB.open(DB_NAME, DB_VERSION);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['entityCategories', 'entities', 'canonical_facts', 'projectSettings'], 'readwrite');
      const record = (id: string, categoryId: string, name: string, notes: string, links: string[] = []) => ({
        id, projectId: PROJECT_ID, categoryId, name, fields: {notes: `<p>${notes}</p>`}, links, createdAt: now, updatedAt: now
      });
      tx.objectStore('entityCategories').put({
        id: 'characters', projectId: PROJECT_ID, kind: 'character', name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: now
      });
      tx.objectStore('entityCategories').put({
        id: 'places', projectId: PROJECT_ID, kind: 'location', name: 'Places', slug: 'places', fieldSchema: [], createdAt: now
      });
      tx.objectStore('entities').put(record('entity-aria', 'characters', 'Aria', 'A hedge knight who distrusts courts.', ['entity-keep']));
      tx.objectStore('entities').put(record('entity-keep', 'places', 'Thornwall Keep', `KEEP-RECORD ${'Old stones. '.repeat(40)}`));
      tx.objectStore('entities').put(record('entity-court', 'places', 'Ember Court', 'COURT-RECORD A court of smoke.'));
      tx.objectStore('entities').put(record('entity-moon', 'places', 'Moon Harbor', 'UNLINKED-RECORD'));
      const fact = (id: string, factType: string, value: string) => ({
        id, projectId: PROJECT_ID, targetType: 'entity', targetId: 'entity-aria', targetName: 'Aria',
        factType, value, acceptedAt: now, updatedAt: now
      });
      tx.objectStore('canonical_facts').put(fact('fact-oath', 'membership', 'sworn to the Ember Court'));
      for (let index = 0; index < FACT_COUNT; index += 1) {
        tx.objectStore('canonical_facts').put(
          fact(`fact-${index}`, 'trait', `FACT-${String(index).padStart(2, '0')} ${'keeps her word even when it costs her. '.repeat(2)}`)
        );
      }
      const settings = tx.objectStore('projectSettings');
      const get = settings.get('settings-cypress-project-1');
      get.onsuccess = () => {
        const existing = get.result;
        settings.put({...existing, aiSettings: {...existing.aiSettings, provider: 'local-openai', includeLinkedRecords: true}});
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    };
  });
}

const serve = (contextTokens: number) => {
  cy.intercept('GET', `${LOCAL_SERVER}/models`, {statusCode: 200, body: {data: [{id: 'kobold-model'}]}});
  cy.intercept('GET', 'http://localhost:5001/props', {statusCode: 200, body: {default_generation_settings: {n_ctx: contextTokens}}});
  cy.intercept('POST', `${LOCAL_SERVER}/chat/completions`, {
    statusCode: 200,
    headers: {'content-type': 'text/event-stream'},
    body: [`data: ${JSON.stringify({choices: [{delta: {content: 'Hm.'}, finish_reason: 'stop'}]})}`, 'data: [DONE]', ''].join('\n\n')
  }).as('localServer');
};

const openLab = () => {
  cy.visit('/world-bible');
  cy.contains('button', 'Characters').click();
  cy.contains('[class*="entityName"]', /^Aria$/).parents('li').first().within(() => {
    cy.contains('button', 'Edit').click();
  });
  cy.contains('button', 'Talk to Aria').click();
  return cy.get('[role="dialog"][aria-labelledby="character-lab-title"]');
};

const send = () => {
  cy.get('[role="dialog"]').within(() => {
    cy.get('textarea').first().type('Who do you serve?');
    cy.contains('button', /^Send$/).click();
    cy.contains('Hm.').scrollIntoView().should('be.visible');
  });
  return cy.wait('@localServer').then(({request}) => (request.body as {messages: Array<{content: string}>}).messages[0]!.content);
};

describe('Context budget, linked records, and prompt size (4.71, 4.72)', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.window().then((win) => seed(win));
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('sends linked records and every fact when the model has room', () => {
    serve(32768);
    openLab().within(() => {
      cy.contains('li', 'Accepted canon: linked World Bible record - Thornwall Keep (linked to Aria)').should('be.visible');
      cy.contains('li', 'Accepted canon: linked World Bible record - Ember Court (linked to Aria)').should('be.visible');
      cy.contains('Left out to fit').should('not.exist');
      // 4.72: each section carries an estimated token count, and the prompt is totalled against the model.
      cy.get('[aria-label="Prompt size"]').invoke('text').should('match', /^Prompt: about [\d,]+ tokens of the model’s 32,768 \(/);
      cy.contains('li', 'Accepted canon facts - Aria').find('small').invoke('text').should('match', /^~[\d,]+ tokens$/);
    });
    send().then((system) => {
      expect(system).to.contain('KEEP-RECORD');
      expect(system).to.contain('COURT-RECORD');
      expect(system).to.contain(`FACT-${String(FACT_COUNT - 1).padStart(2, '0')}`);
      expect(system).not.to.contain('UNLINKED-RECORD');
      expect(system).not.to.contain('left out to fit');
    });
  });

  it('leaves out linked records first, then lower-ranked facts, on a small model, and shows what', () => {
    serve(2048);
    openLab().within(() => {
      cy.get('[aria-label="Left out of the model’s context"]')
        .should('contain.text', 'The model takes 2,048 tokens.')
        .and('contain.text', 'Accepted canon: linked World Bible record - Thornwall Keep (linked to Aria)')
        .and('contain.text', `trait: FACT-${String(FACT_COUNT - 1).padStart(2, '0')}`);
      cy.contains('li', 'Accepted canon: World Bible record - Aria').should('be.visible');
      cy.get('[aria-label="Prompt size"]').invoke('text').then((text) => {
        const [, total] = /^Prompt: about ([\d,]+) tokens of the model’s 2,048/.exec(text) ?? [];
        expect(Number(total?.replace(/,/g, ''))).to.be.within(1, 2048 - 768);
        expect(text).to.match(/About [\d,]+ left for the reply\.$/);
      });
    });
    send().then((system) => {
      expect(system).to.contain('A hedge knight who distrusts courts.');
      expect(system).to.contain('sworn to the Ember Court');
      expect(system).to.contain('FACT-00');
      expect(system).not.to.contain('KEEP-RECORD');
      expect(system).not.to.contain(`FACT-${String(FACT_COUNT - 1).padStart(2, '0')}`);
      expect(system).to.match(/\(\d+ more accepted facts left out to fit the model's context\.\)/);
    });
  });
});
