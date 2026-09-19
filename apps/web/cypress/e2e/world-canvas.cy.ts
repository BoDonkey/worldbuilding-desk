import {DB_NAME} from '../../src/db';

const seedCanvasReturnExperience = (win: Window): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = win.indexedDB.open(DB_NAME);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const now = Date.now();
      const tx = db.transaction(
        ['entityCategories', 'entities', 'lore_documents', 'lore_document_links', 'world_canvases'],
        'readwrite'
      );
      const categories = tx.objectStore('entityCategories');
      categories.put({
        id: 'canvas-characters', projectId: 'cypress-project-1', kind: 'character',
        name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: now
      });
      categories.put({
        id: 'canvas-factions', projectId: 'cypress-project-1', kind: 'general',
        name: 'Factions', slug: 'factions', fieldSchema: [], createdAt: now
      });
      categories.put({
        id: 'canvas-relics', projectId: 'cypress-project-1', kind: 'general',
        name: 'Relics', slug: 'relics', fieldSchema: [], createdAt: now
      });
      const entities = tx.objectStore('entities');
      [
        {id: 'canvas-sera', categoryId: 'canvas-characters', name: 'Sera Kestrel', needsCompletion: true},
        {id: 'canvas-brannic', categoryId: 'canvas-characters', name: 'Brannic Halloway'},
        {id: 'canvas-compact', categoryId: 'canvas-factions', name: 'The Cinder Compact'},
        {id: 'canvas-key', categoryId: 'canvas-relics', name: 'Emberglass Key'}
      ].forEach((entity) => entities.put({
        ...entity,
        projectId: 'cypress-project-1', fields: {}, links: [], createdAt: now, updatedAt: now
      }));
      tx.objectStore('lore_documents').put({
        id: 'canvas-compact-note', projectId: 'cypress-project-1',
        title: 'Faction Notes — The Cinder Compact', kind: 'faction_notes',
        format: 'plain_text', content: 'Compact notes', source: {type: 'manual'},
        status: 'active', createdAt: now, updatedAt: now
      });
      tx.objectStore('lore_document_links').put({
        id: 'canvas-compact-link', projectId: 'cypress-project-1',
        loreDocumentId: 'canvas-compact-note', targetType: 'entity',
        targetId: 'canvas-compact', relationship: 'primary_subject', createdAt: now
      });
      tx.objectStore('world_canvases').put({
        id: 'cypress-project-1', projectId: 'cypress-project-1', premise: '', lenses: [],
        questions: [{
          id: 'canvas-old-question', text: 'Who first opened the Salt Door?',
          status: 'open', createdAt: now - 31 * 24 * 60 * 60 * 1000,
          updatedAt: now - 31 * 24 * 60 * 60 * 1000
        }],
        createdAt: now, updatedAt: now
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    };
  });

describe('World Canvas', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('captures optional worldbuilding notes and restores them after reload', () => {
    cy.visit('/world-bible');
    cy.contains('h1', 'World Bible').should('be.visible');
    cy.contains('button', 'World Canvas').click();

    cy.contains('h2', 'World Canvas').should('be.visible');
    cy.contains(/Nothing here is canon/i).should('be.visible');
    cy.contains('h2', 'Characters').should('not.exist');
    cy.get('textarea[placeholder*="borrowed memories"]')
      .type('A river city trades years of memory for safe passage.');

    cy.contains('article', 'People').within(() => cy.contains('button', 'Open lens').click());
    cy.contains('label', 'People notes')
      .find('textarea')
      .type('Ferrymen remember every bargain, even when travelers do not.');

    cy.contains('article', 'Constraints and costs').within(() => {
      cy.contains('button', 'Open lens').click();
    });
    cy.contains('label', 'Constraints and costs notes')
      .find('textarea')
      .type('Every crossing costs a cherished memory.');

    const questions = [
      'Who records the memories that were traded?',
      'What happens when the river refuses a bargain?',
      'Which faction profits from forgotten crossings?'
    ];
    questions.forEach((question, index) => {
      cy.get('#world-canvas-new-question').type(question);
      if (index === 0) cy.get('#world-canvas-question-lens').select('People');
      cy.contains('button', 'Add question').click();
    });

    questions.forEach((question) => cy.contains(question).should('be.visible'));
    cy.contains('label', 'Question 2 status').find('select').select('Answered');
    cy.contains('label', 'Question 3 status').find('select').select('Dropped');
    cy.contains('Saving...').should('be.visible');
    cy.contains(/Saved at/).should('be.visible');

    cy.reload();
    cy.contains('button', 'World Canvas').click();
    cy.get('textarea[placeholder*="borrowed memories"]')
      .should('have.value', 'A river city trades years of memory for safe passage.');
    cy.contains('label', 'People notes')
      .find('textarea')
      .should('have.value', 'Ferrymen remember every bargain, even when travelers do not.');
    cy.contains('label', 'Constraints and costs notes')
      .find('textarea')
      .should('have.value', 'Every crossing costs a cherished memory.');
    questions.forEach((question) => cy.contains(question).should('be.visible'));
    cy.contains('label', 'Question 2 status').find('select').should('have.value', 'answered');
    cy.contains('label', 'Question 3 status').find('select').should('have.value', 'dropped');

    cy.viewport(780, 900);
    cy.contains('h2', 'World Canvas').should('be.visible');
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.at.most(win.innerWidth);
    });
  });

  it('marks an empty question as invalid without adding it', () => {
    cy.visit('/world-bible');
    cy.contains('button', 'World Canvas').click();
    cy.contains('button', 'Add question').click();

    cy.get('#world-canvas-new-question')
      .should('have.attr', 'aria-invalid', 'true')
      .and('have.attr', 'aria-describedby', 'world-canvas-question-error');
    cy.contains('Enter a question before adding it.').should('be.visible');
  });

  it('moves lens ideas into Source Notes and the normal canon form', () => {
    cy.visit('/world-bible');
    cy.contains('button', 'World Canvas').click();
    cy.contains('article', 'Places').within(() => cy.contains('button', 'Open lens').click());
    cy.contains('label', 'Places notes').find('textarea').type(
      'Name: Glass Citadel{enter}Background: A harbor fortress founded after the first beacon failed.'
    );
    cy.contains('article', 'Places').within(() => {
      cy.contains('button', 'Keep as Source Note').click();
      cy.contains('Source Note: Name: Glass Citadel').should('be.visible');
      cy.contains('button', 'Open note').click();
    });

    cy.location('pathname').should('eq', '/lore');
    cy.contains('h2', 'Edit Source Note').should('be.visible');
    cy.get('textarea').should('contain.value', 'From World Canvas — Places');
    cy.contains('button', 'Extract Candidates').click();
    cy.contains('[role="status"]', /Extracted \d+ entity proposal/).should('be.visible');

    cy.visit('/world-bible');
    cy.contains('button', 'World Canvas').click();
    cy.contains('article', 'Places').within(() => {
      cy.contains('button', 'Propose as canon').click();
      cy.contains('label', 'Canon record name').find('input').clear().type('Glass Citadel');
      cy.contains('button', 'Open canon form').click();
    });
    cy.contains('h2', 'New Location').should('be.visible');
    cy.contains('label', 'Name').find('input').should('have.value', 'Glass Citadel');
    cy.contains('button', 'Create Entry').click();
    cy.contains('[role="status"]', 'Entry created.').should('be.visible');

    cy.contains('button', 'World Canvas').click();
    cy.contains('article', 'Places').within(() => {
      cy.contains('World Bible: Glass Citadel').should('be.visible');
    });
  });

  it('returns to mapped canon, Source Notes, and rule-stated reminders', () => {
    cy.visit('/world-bible');
    cy.contains('h1', 'World Bible').should('be.visible');
    cy.window().then(seedCanvasReturnExperience);
    cy.reload();
    cy.contains('button', 'World Canvas').click();

    cy.contains('article', 'People').within(() => {
      cy.contains('2 World Bible records:').should('be.visible');
      cy.contains('Brannic Halloway, Sera Kestrel').should('be.visible');
    });
    cy.contains('article', 'Factions and institutions').within(() => {
      cy.contains('The Cinder Compact').should('be.visible');
      cy.contains('Faction Notes — The Cinder Compact').should('be.visible');
    });
    cy.contains('Other records').parent().should('contain.text', 'Emberglass Key');
    cy.contains('aside', 'Worth a look').within(() => {
      cy.contains('Sera Kestrel').should('be.visible');
      cy.contains('This record is marked for author review.').should('be.visible');
      cy.contains('No Source Note is linked to this record.').should('be.visible');
      cy.contains('Who first opened the Salt Door?').should('be.visible');
      cy.contains('This question has stayed open for more than 30 days.').should('be.visible');
      cy.contains(/%|score|progress bar/i).should('not.exist');
    });

    cy.viewport(780, 900);
    cy.contains('article', 'People').should('be.visible');
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.at.most(win.innerWidth);
    });
  });
});
