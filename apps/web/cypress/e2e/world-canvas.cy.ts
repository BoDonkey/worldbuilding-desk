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
    cy.visit('/world-canvas');

    cy.contains('h1', 'World Canvas').should('be.visible');
    cy.contains(/Nothing here is canon/i).should('be.visible');
    cy.contains('h2', 'Characters').should('not.exist');
    cy.get('textarea[placeholder*="borrowed memories"]')
      .type('A river city trades years of memory for safe passage.');

    cy.contains('article', 'Inhabitants and societies').within(() => cy.contains('button', 'Bring into focus').click());
    cy.contains('label', 'Inhabitants and societies working sketch')
      .find('textarea')
      .type('Ferrymen remember every bargain, even when travelers do not.');

    cy.contains('article', 'Constraints and costs').within(() => {
      cy.contains('button', 'Bring into focus').click();
    });
    cy.contains('label', 'Constraints and costs working sketch')
      .find('textarea')
      .type('Every crossing costs a cherished memory.');

    const threads = [
      'Who records the memories that were traded?',
      'What happens when the river refuses a bargain?',
      'Which faction profits from forgotten crossings?'
    ];
    threads.forEach((thread, index) => {
      cy.get('#world-canvas-new-thread').type(thread);
      if (index === 0) cy.get('#world-canvas-thread-lens').select('Inhabitants and societies');
      cy.contains('button', 'Add open thread').click();
    });

    threads.forEach((thread) => cy.contains(thread).should('be.visible'));
    cy.contains('article', threads[1]).contains('label', 'Status').find('select').select('Settled');
    cy.contains('article', threads[2]).contains('label', 'Status').find('select').select('Set aside');
    cy.contains('Saving...').should('be.visible');
    cy.contains(/Saved at/).should('be.visible');

    cy.contains('article', 'Inhabitants and societies').within(() => cy.contains('button', 'Collapse').click());
    cy.contains('Saving...').should('be.visible');
    cy.contains(/Saved at/).should('be.visible');
    cy.reload();
    cy.get('textarea[placeholder*="borrowed memories"]')
      .should('have.value', 'A river city trades years of memory for safe passage.');
    cy.contains('article', 'Inhabitants and societies').within(() => {
      cy.contains('1 sketch · Ferrymen remember every bargain').should('be.visible');
      cy.contains('button', 'Bring into focus').click();
    });
    cy.contains('label', 'Inhabitants and societies working sketch')
      .find('textarea')
      .should('have.value', 'Ferrymen remember every bargain, even when travelers do not.');
    cy.contains('label', 'Constraints and costs working sketch')
      .find('textarea')
      .should('have.value', 'Every crossing costs a cherished memory.');
    cy.contains(threads[0]).should('be.visible');
    cy.contains('summary', 'Settled and set-aside history').click();
    cy.contains(threads[1]).should('be.visible');
    cy.contains(threads[2]).should('be.visible');

    cy.viewport(780, 900);
    cy.contains('h1', 'World Canvas').should('be.visible');
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.at.most(win.innerWidth);
    });
  });

  it('marks an empty Open Thread as invalid without adding it', () => {
    cy.visit('/world-canvas');
    cy.contains('button', 'Add open thread').click();

    cy.get('#world-canvas-new-thread')
      .should('have.attr', 'aria-invalid', 'true')
      .and('have.attr', 'aria-describedby', 'world-canvas-thread-error');
    cy.contains('Enter an open thread before adding it.').should('be.visible');
  });

  it('moves lens ideas into Source Notes and the normal canon form', () => {
    cy.visit('/world-canvas');
    cy.contains('article', 'Places').within(() => cy.contains('button', 'Bring into focus').click());
    cy.contains('label', 'Places working sketch').find('textarea').type(
      'Name: Glass Citadel{enter}Background: A harbor fortress founded after the first beacon failed.'
    );
    cy.contains('article', 'Places').within(() => {
      cy.contains('button', 'Develop as Source Note').click();
      cy.contains('Source Note: Name: Glass Citadel').should('be.visible');
      cy.contains('button', 'Open').click();
    });

    cy.location('pathname').should('eq', '/lore');
    cy.contains('h2', 'Edit Source Note').should('be.visible');
    cy.get('textarea').should('contain.value', 'From World Canvas — Places');
    cy.contains('button', 'Extract Candidates').click();
    cy.contains('[role="status"]', /Extracted \d+ entity proposal/).should('be.visible');

    cy.visit('/world-canvas');
    cy.contains('article', 'Places').within(() => {
      cy.contains('button', 'Propose canon anchor').click();
      cy.contains('label', 'Record name').find('input').clear().type('Glass Citadel');
      cy.contains('button', 'Open World Bible form').click();
    });
    cy.contains('h2', 'New Location').should('be.visible');
    cy.contains('label', 'Name').find('input').should('have.value', 'Glass Citadel');
    cy.contains('button', 'Create Entry').click();
    cy.contains('[role="status"]', 'Entry created.').should('be.visible');

    cy.visit('/world-canvas');
    cy.contains('article', 'Places').within(() => {
      cy.contains('World Bible: Glass Citadel').should('be.visible');
    });
  });

  it('keeps repeatable routed sketches and preserves cancelled composer text', () => {
    cy.visit('/world-canvas');
    cy.contains('article', 'Constraints and costs').within(() => {
      cy.contains('button', 'Bring into focus').click();
    });
    cy.contains('label', 'Constraints and costs working sketch').find('textarea')
      .type('Every crossing costs a cherished memory.');
    cy.contains('article', 'Constraints and costs').within(() => {
      cy.contains('button', 'Propose canon anchor').click();
      cy.contains('button', 'Cancel').click();
      cy.contains('label', 'Constraints and costs working sketch').find('textarea')
        .should('have.value', 'Every crossing costs a cherished memory.');
      cy.contains('button', 'Keep as Open Thread').click();
      cy.contains('button', 'Add another sketch').should('be.enabled').click();
      cy.contains('label', 'Constraints and costs working sketch').find('textarea')
        .type('The ferrymen can waive the price once in a lifetime.');
      cy.contains('button', 'Keep as Open Thread').click();
      cy.contains('button', 'Add another sketch').click();
      cy.contains('Sketches from this lens').should('be.visible');
      cy.contains('button', 'Every crossing costs a cherished memory.').click();
      cy.contains('label', 'Constraints and costs working sketch').find('textarea')
        .should('have.value', 'Every crossing costs a cherished memory.');
      cy.contains('Open Thread: Every crossing costs a cherished memory.').should('be.visible');
    });
    cy.contains('Saving...').should('be.visible');
    cy.contains(/Saved at/).should('be.visible');
    cy.reload();
    cy.contains('article', 'Constraints and costs').within(() => {
      cy.contains('label', 'Constraints and costs working sketch').find('textarea')
        .should('have.value', 'Every crossing costs a cherished memory.');
      cy.contains('Sketches from this lens').should('be.visible');
    });
  });

  it('snapshots and links the Core Idea without silently rewriting or duplicating it', () => {
    cy.visit('/world-canvas');
    cy.get('textarea[placeholder*="borrowed memories"]')
      .type('A city powered by borrowed memories.');
    cy.get('#world-canvas-premise-heading').parents('section').first().within(() => {
      cy.contains('button', 'Keep as Source Note').click();
      cy.contains('Source Note: A city powered by borrowed memories').should('be.visible');
      cy.contains('button', 'Keep as Source Note').should('be.disabled');
      cy.contains('button', 'Open').click();
    });
    cy.location('pathname').should('eq', '/lore');
    cy.get('textarea').should('contain.value', 'From World Canvas — Core Idea')
      .and('contain.value', 'A city powered by borrowed memories.');

    cy.visit('/world-canvas');
    cy.get('textarea[placeholder*="borrowed memories"]')
      .type(' Its founders are forgotten.');
    cy.contains(/Saved at/).should('be.visible');
    cy.get('#world-canvas-premise-heading').parents('section').first().within(() => cy.contains('button', 'Open').click());
    cy.get('textarea').should('contain.value', 'A city powered by borrowed memories.')
      .and('not.contain.value', 'Its founders are forgotten.');

    cy.visit('/world-canvas');
    cy.get('#world-canvas-premise-heading').parents('section').first().within(() => {
      cy.contains('button', 'Propose canon anchor').click();
      cy.contains('label', 'Record name').find('input').clear().type('The Borrowed City');
      cy.contains('button', 'Open World Bible form').click();
    });
    cy.contains('label', 'Name').find('input').should('have.value', 'The Borrowed City');
    cy.contains('button', 'Create Entry').click();
    cy.contains('[role="status"]', 'Entry created.').should('be.visible');
    cy.visit('/world-canvas');
    cy.get('#world-canvas-premise-heading').parents('section').first().within(() => {
      cy.contains('World Bible: The Borrowed City').should('be.visible');
    });
  });

  it('removes Worth a Look and migrates old questions without age warnings', () => {
    cy.visit('/world-canvas');
    cy.window().then(seedCanvasReturnExperience);
    cy.reload();

    cy.contains('From saved material').should('not.exist');
    cy.contains('Other records').should('not.exist');
    cy.contains('Worth a look').should('not.exist');
    cy.contains('This question has stayed open for more than 30 days.').should('not.exist');
    cy.contains('Who first opened the Salt Door?').should('be.visible');

    cy.viewport(780, 900);
    cy.contains('article', 'Inhabitants and societies').should('be.visible');
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.at.most(win.innerWidth);
    });
  });

  describe('brainstorming', () => {
    // The web build streams Anthropic through the local proxy, not api.anthropic.com directly.
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

    const openFactionsLens = () => {
      cy.visit('/world-canvas');
      cy.window().then(seedCanvasReturnExperience);
      cy.reload();
      cy.contains('article', 'Factions and institutions').within(() => {
        cy.contains('button', 'Bring into focus').click();
      });
      cy.contains('label', 'Factions and institutions working sketch')
        .find('textarea')
        .type('The Compact trades in forgotten crossings.');
    };

    it('explains the missing provider and links to Settings without sending anything', () => {
      cy.intercept('POST', ANTHROPIC_STREAM, cy.spy().as('providerRequest'));
      cy.intercept('POST', 'https://api.anthropic.com/v1/messages', cy.spy().as('directRequest'));
      openFactionsLens();

      cy.contains('section', 'Brainstorm: Factions and institutions').within(() => {
        cy.contains('Anthropic API key is missing').should('be.visible');
        cy.contains('a', 'Open Settings').should('have.attr', 'href', '/settings');
        cy.contains('button', 'Ask for tensions and questions').should('be.disabled');
      });
      cy.get('@providerRequest').should('not.have.been.called');
      cy.get('@directRequest').should('not.have.been.called');
    });

    it('asks once, then keeps, adds, and dismisses ideas one at a time', () => {
      cy.window().then((win) => win.localStorage.setItem('anthropic_api_key', 'cypress-test-key'));
      cy.intercept('POST', ANTHROPIC_STREAM, anthropicReply(JSON.stringify({
        items: [
          {kind: 'tension', text: 'The Compact profits when travelers forget the toll.'},
          {kind: 'question', text: 'Who audits the memories the Compact collects?'},
          {kind: 'alternative', text: 'What if the river, not the Compact, sets the price?'}
        ]
      }))).as('brainstorm');
      openFactionsLens();

      cy.contains('section', 'Brainstorm: Factions and institutions').within(() => {
        cy.contains('to Anthropic’s servers').should('be.visible');
        cy.contains("Costs 1 of this project's 20 daily AI consultations").should('be.visible');
        cy.contains('button', 'Ask for tensions and questions').click();
      });

      cy.wait('@brainstorm').then(({request}) => {
        const body = JSON.stringify(request.body);
        expect(body).to.contain('EXPLORATORY — NOT CANON');
        expect(body).to.contain('The Compact trades in forgotten crossings.');
        expect(body).to.contain('The Cinder Compact');
        // Canon travels as names only: seeded Source Note text never reaches the provider.
        expect(body).not.to.contain('Compact notes');
      });
      cy.get('@brainstorm.all').should('have.length', 1);

      cy.contains('section', 'Brainstorm: Factions and institutions').within(() => {
        cy.contains('19 left').should('be.visible');
        cy.contains('to Anthropic’s servers').should('not.exist');
        cy.contains('li', 'The Compact profits').within(() => {
          cy.contains('button', 'Keep as Source Note').click();
        });
        cy.contains('li', 'The Compact profits').should('not.exist');
        cy.contains('li', 'Who audits the memories').within(() => {
          cy.contains('button', 'Keep as Open Thread').click();
        });
        cy.contains('li', 'What if the river').within(() => {
          cy.contains('button', 'Dismiss').click();
        });
        cy.get('li').should('not.exist');
      });

      cy.contains('article', 'Factions and institutions')
        .contains('Source Note: The Compact profits when travelers forget the toll')
        .should('be.visible');
      cy.contains('article', 'Who audits the memories the Compact collects?')
        .should('contain.text', 'From World Canvas brainstorm');
      cy.contains(/Saved at/).should('be.visible');

      cy.reload();
      cy.contains('article', 'Who audits the memories the Compact collects?')
        .should('contain.text', 'From World Canvas brainstorm');
      cy.contains('What if the river, not the Compact, sets the price?').should('not.exist');

      cy.contains('article', 'Factions and institutions')
        .contains('Source Note: The Compact profits')
        .within(() => cy.contains('button', 'Open').click());
      cy.location('pathname').should('eq', '/lore');
      cy.contains('h2', 'Edit Source Note').should('be.visible');
      cy.get('textarea').should(
        'contain.value',
        'From World Canvas brainstorm — Factions and institutions (Tension)'
      );
    });

    describe('on a local model', () => {
      const OLLAMA_CHAT = 'http://localhost:11434/api/chat';
      // Ollama streams newline-delimited JSON: thinking fragments first, then the answer.
      const ndjson = (thinking: string[], answer: string) => [
        ...thinking.map((text) => JSON.stringify({message: {role: 'assistant', content: '', thinking: text}})),
        JSON.stringify({message: {role: 'assistant', content: answer}}),
        JSON.stringify({done: true, done_reason: 'stop'})
      ].join('\n');

      const openLocalFactionsLens = () => {
        cy.visit('/world-canvas');
        cy.setSeededProjectProvider('ollama');
        cy.window().then(seedCanvasReturnExperience);
        cy.reload();
        cy.contains('article', 'Factions and institutions').within(() => {
          cy.contains('button', 'Bring into focus').click();
        });
      };

      it('streams with no response cap and shows the thinking apart from the answer', () => {
        cy.intercept('POST', OLLAMA_CHAT, {
          statusCode: 200,
          headers: {'content-type': 'application/x-ndjson'},
          body: ndjson(
            ['The author wants tensions', ' about the Compact.'],
            JSON.stringify({items: [{kind: 'question', text: 'Who audits the Compact?'}]})
          )
        }).as('localBrainstorm');
        openLocalFactionsLens();

        cy.contains('section', 'Brainstorm: Factions and institutions').within(() => {
          cy.contains('Nothing leaves this computer').should('be.visible');
          cy.contains('button', 'Ask for tensions and questions').click();
        });
        cy.wait('@localBrainstorm').then(({request}) => {
          expect(request.body.stream).to.equal(true);
          expect(request.body.options?.num_predict).to.equal(undefined);
          expect(request.body).not.to.have.property('think');
        });

        cy.contains('section', 'Brainstorm: Factions and institutions').within(() => {
          cy.contains('li', 'Who audits the Compact?').should('be.visible');
          cy.contains(/^Finished in \d+:\d{2}\.$/).should('be.visible');
          cy.contains('summary', 'Show thinking (7 words)').click();
          cy.contains('The author wants tensions about the Compact.').should('be.visible');
          cy.get('li').should('have.length', 1);
        });
      });

      it('lets the author stop a slow run', () => {
        cy.intercept('POST', OLLAMA_CHAT, {
          statusCode: 200,
          headers: {'content-type': 'application/x-ndjson'},
          body: ndjson([], JSON.stringify({items: [{kind: 'question', text: 'Too late?'}]})),
          delay: 15000
        }).as('slowBrainstorm');
        openLocalFactionsLens();

        cy.contains('section', 'Brainstorm: Factions and institutions').within(() => {
          cy.contains('button', 'Ask for tensions and questions').click();
          cy.contains('[role="status"]', 'Waiting for the model…').should('be.visible');
          cy.contains('button', 'Asking...').should('be.disabled');
          cy.contains('button', 'Stop').click();
          cy.contains(/^Stopped after 0:\d{2}\.$/).should('be.visible');
          cy.contains('[role="alert"]', 'Stopped before the model finished').should('be.visible');
          cy.contains('button', 'Ask for tensions and questions').should('be.enabled');
          cy.contains('Too late?').should('not.exist');
        });
      });
    });

    it('shows the fallback message for a malformed reply and adds nothing', () => {
      cy.window().then((win) => win.localStorage.setItem('anthropic_api_key', 'cypress-test-key'));
      cy.intercept(
        'POST',
        ANTHROPIC_STREAM,
        anthropicReply('Here are some thoughts about the Compact and its tolls.')
      ).as('brainstorm');
      openFactionsLens();

      cy.contains('section', 'Brainstorm: Factions and institutions').within(() => {
        cy.contains('button', 'Ask for tensions and questions').click();
        cy.contains('[role="alert"]', 'could not be read as a brainstorm list').should('be.visible');
        cy.get('li').should('not.exist');
      });
      cy.contains('article', 'Factions and institutions')
        .contains('Source Note: Here are some')
        .should('not.exist');
    });
  });
});
