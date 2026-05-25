const DB_NAME = 'worldbuilding-db';
const DB_VERSION = 24;

function setSeededProjectToGeneralFiction(): Cypress.Chainable<void> {
  return cy.window().then(
    (win) =>
      new Cypress.Promise<void>((resolve, reject) => {
        const openRequest = win.indexedDB.open(DB_NAME, DB_VERSION);
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => {
          const db = openRequest.result;
          const tx = db.transaction(['projectSettings'], 'readwrite');
          const store = tx.objectStore('projectSettings');
          const getRequest = store.get('settings-cypress-project-1');

          getRequest.onerror = () => reject(getRequest.error);
          getRequest.onsuccess = () => {
            store.put({
              ...getRequest.result,
              projectMode: 'general',
              featureToggles: {
                enableGameSystems: false,
                enableRuntimeModifiers: false,
                enableSettlementAndZoneSystems: false,
                enableRuleAuthoring: false
              }
            });
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      })
  );
}

function seedWorldBibleReviewQueueItem(): Cypress.Chainable<void> {
  return cy.window().then(
    (win) =>
      new Cypress.Promise<void>((resolve, reject) => {
        const now = Date.now();
        const openRequest = win.indexedDB.open(DB_NAME, DB_VERSION);
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => {
          const db = openRequest.result;
          const tx = db.transaction(['entityCategories', 'entities'], 'readwrite');
          tx.objectStore('entityCategories').put({
            id: 'characters',
            projectId: 'cypress-project-1',
            name: 'Characters',
            slug: 'characters',
            fieldSchema: [
              {key: 'description', label: 'Description', type: 'textarea', required: true},
              {key: 'age', label: 'Age', type: 'text'},
              {key: 'role', label: 'Role', type: 'text'},
              {key: 'notes', label: 'Notes', type: 'textarea'}
            ],
            createdAt: now
          });
          tx.objectStore('entities').put({
            id: 'entity-review-kael',
            projectId: 'cypress-project-1',
            categoryId: 'characters',
            name: 'Kael Review',
            fields: {
              age: '31',
              role: 'Scout'
            },
            needsCompletion: true,
            links: [],
            createdAt: now,
            updatedAt: now
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      })
  );
}

describe('Project mode guardrails', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    setSeededProjectToGeneralFiction();
    cy.reload();
    cy.contains('h2', 'Cypress Smoke Project').should('be.visible');
  });

  it('hides ruleset, sheets, and compendium surfaces for general fiction', () => {
    cy.contains('nav a', 'Ruleset').should('not.exist');
    cy.contains('nav a', 'Compendium').should('not.exist');

    cy.visit('/characters');
    cy.location('pathname').should('eq', '/world-bible');
    cy.contains('h1', 'World Bible').should('be.visible');
    cy.contains('h2', 'Characters').should('be.visible');
    cy.get('section[aria-label="Cast canon"]').find('button').should('have.length', 3);
    cy.contains('h2', 'New Character').should('not.exist');
    cy.contains('h2', 'Characters')
      .parents('section[aria-label="Cast canon"]')
      .should('be.visible');
    cy.contains('button', 'Create Manually').should('be.visible');
    cy.contains('button', 'Create Manually').click();
    cy.get('form').then(($form) => {
      const formText = $form.text();
      expect(formText.indexOf('Name')).to.be.lessThan(formText.indexOf('Age'));
      expect(formText.indexOf('Age')).to.be.lessThan(formText.indexOf('Role'));
      expect(formText.indexOf('Role')).to.be.lessThan(formText.indexOf('Description'));
      expect(formText.indexOf('Description')).to.be.lessThan(formText.indexOf('Notes'));
      expect(formText.indexOf('Notes')).to.be.lessThan(formText.indexOf('Add character section'));
      expect(formText.indexOf('Add character section')).to.be.lessThan(
        formText.indexOf('Canon and aliases')
      );
      expect(formText.indexOf('Canon and aliases')).to.be.lessThan(
        formText.indexOf('Alternative names')
      );
    });
    cy.contains('button', 'Sheets').should('not.exist');
    cy.contains('button', 'Export Roster + Sheets').should('not.exist');
    cy.contains('button', 'Import Roster + Sheets').should('not.exist');
    cy.contains('button', 'Open Sheet').should('not.exist');
    cy.contains('span', 'Description')
      .closest('[class*="container"]')
      .should('have.attr', 'data-rich-text-variant', 'character')
      .find('.tiptap-editor')
      .should('exist');
    cy.contains('span', 'Notes')
      .closest('[class*="container"]')
      .should('have.attr', 'data-rich-text-variant', 'character')
      .find('.tiptap-editor')
      .should('exist');
    cy.contains('strong', 'Add character section').should('be.visible');
    cy.get('input[placeholder="Education, Traumas, Addictions..."]').type('Education');
    cy.contains('button', 'Add Section').click();
    cy.contains('span', 'Education')
      .closest('[class*="container"]')
      .should('have.attr', 'data-rich-text-variant', 'character')
      .find('.tiptap-editor')
      .should('exist');
    cy.get('form').then(($form) => {
      const formText = $form.text();
      expect(formText.indexOf('Notes')).to.be.lessThan(formText.indexOf('Education'));
      expect(formText.indexOf('Education')).to.be.lessThan(
        formText.indexOf('Add character section')
      );
    });
    cy.get('[class*="content"]').should('have.css', 'display', 'grid');

    cy.visit('/ruleset');
    cy.location('pathname').should('eq', '/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
  });

  it('imports pasted character notes into rich review fields for general fiction', () => {
    cy.visit('/characters');
    cy.location('pathname').should('eq', '/world-bible');
    cy.get('section[aria-label="Cast canon"]').should('be.visible');
    cy.contains('button', 'Create Manually').click();
    cy.get('input[placeholder="Education, Traumas, Addictions..."]').type('Education');
    cy.contains('button', 'Add Section').click();
    cy.get('section[aria-label="Cast canon"]')
      .contains('button', 'Import Or Paste')
      .should('be.visible')
      .click();
    cy.contains('h2', 'Import Character').should('be.visible');
    cy.get('section[aria-label="Import character"] textarea').type(
      [
        'Name: Mira Voss',
        'Age: 34',
        'Role: Cartographer',
        '',
        'Background:',
        'Mira mapped the undercity after the lantern guild vanished.',
        '',
        'Voice:',
        'Dry, precise, and fond of unfinished jokes.'
      ].join('\n')
    );
    cy.contains('button', 'Review Paste').click();

    cy.contains('h2', 'Review Character Import').should('be.visible');
    cy.contains('[class*="characterImportReviewCard"]', 'Voice')
      .find('select')
      .select('Education');
    cy.get('input[value="Mira Voss"]').should('be.visible');
    cy.contains('h2', 'New Character').should('be.visible');
    cy.contains('span', 'Description')
      .closest('[class*="container"]')
      .should('have.attr', 'data-rich-text-variant', 'character')
      .find('.tiptap-editor')
      .should('contain.text', 'Mira mapped the undercity');
    cy.contains('span', 'Notes')
      .closest('[class*="container"]')
      .should('have.attr', 'data-rich-text-variant', 'character')
      .find('.tiptap-editor')
      .should('not.contain.text', 'Dry, precise');
    cy.contains('span', 'Education')
      .closest('[class*="container"]')
      .should('have.attr', 'data-rich-text-variant', 'character')
      .find('.tiptap-editor')
      .should('contain.text', 'Dry, precise');
  });

  it('opens AI-assisted character draft without background generation', () => {
    cy.visit('/characters');
    cy.location('pathname').should('eq', '/world-bible');
    cy.get('section[aria-label="Cast canon"]').should('be.visible');
    cy.contains('button', 'Start With AI').should('be.enabled').click();
    cy.contains('h2', 'AI-Assisted Draft').should('be.visible');
    cy.contains('h2', 'New Character').should('be.visible');
    cy.contains('button', 'Generate Draft').should('be.disabled');
    cy.get('section[aria-label="AI-assisted character draft"] textarea').type(
      'A disgraced royal cartographer who suspects the capital was redrawn overnight.'
    );
    cy.contains('button', 'Generate Draft').should('be.enabled').click();
    cy.contains('[role="status"]', /API key is missing|Unable to generate/i).should('be.visible');
    cy.contains('label', 'Name').find('input').should('have.value', '');
  });

  it('keeps World Bible review queue cards low density', () => {
    seedWorldBibleReviewQueueItem();
    cy.visit('/world-bible');
    cy.contains('button', /Review Queue \(1\)/).click();
    cy.contains('h2', 'Review Queue').should('be.visible');
    cy.contains('[data-cy="world-bible-review-card"]', 'Kael Review').within(() => {
      cy.contains('button', 'Review details').should('be.visible');
      cy.contains('button', 'Mark reviewed').should('be.visible');
      cy.contains('button', 'Mark reviewed + next').should('not.exist');
      cy.contains('button', 'Merge matches').should('not.exist');
      cy.contains('button', 'Review aliases').should('not.exist');
    });
  });

  it('clears the active project summary after deleting the last project', () => {
    cy.visit('/projects');
    cy.contains('button', 'Open Workspace').should('be.visible');
    cy.window().then((win) => {
      cy.stub(win, 'confirm').returns(true);
    });

    cy.get('li')
      .filter(':contains("Cypress Smoke Project")')
      .first()
      .within(() => {
        cy.contains('button', 'Delete').click();
      });

    cy.contains('[role="status"]', 'Project deleted.').should('be.visible');
    cy.contains('No projects yet. Create one to get started.').should('be.visible');
    cy.contains('button', 'Open Workspace').should('not.exist');

    cy.visit('/workspace');
    cy.contains('No active project.').should('be.visible');
  });

  it('omits ruleset and compendium commands for general fiction', () => {
    cy.visit('/workspace');
    cy.get('body').type('{ctrl}k');
    cy.get('[role="dialog"][aria-label="Command palette"]').should('be.visible');

    cy.contains('button', 'Go to Ruleset').should('not.exist');
    cy.contains('button', 'Go to Compendium').should('not.exist');
    cy.contains('button', 'Workspace: Open Context - Ruleset').should('not.exist');
    cy.contains('button', 'Workspace: Open Context - Compendium').should('not.exist');
  });
});
