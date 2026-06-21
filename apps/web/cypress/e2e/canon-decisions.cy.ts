const DB_NAME = 'worldbuilding-db';
const DB_VERSION = 24;
const PROJECT_ID = 'cypress-project-1';
const TARGET_ID = 'entity-ember-archive';
const TARGET_NAME = 'Ember Archive';

function seedFactConflict(): Cypress.Chainable<void> {
  return cy.window({log: false}).then((win) => {
    const now = Date.now();

    return new Cypress.Promise<void>((resolve, reject) => {
      const openRequest = win.indexedDB.open(DB_NAME, DB_VERSION);

      openRequest.onerror = () => reject(openRequest.error);
      openRequest.onsuccess = () => {
        const db = openRequest.result;
        const tx = db.transaction(
          ['lore_documents', 'lore_fact_proposals', 'canonical_facts'],
          'readwrite'
        );

        tx.objectStore('lore_documents').put({
          id: 'lore-doc-ember-archive',
          projectId: PROJECT_ID,
          title: 'Ember Archive Conflicting Notes',
          kind: 'general_lore',
          format: 'plain_text',
          content: 'Background: Founded in the old watchtower.',
          summary: 'Conflicting notes for Ember Archive.',
          status: 'active',
          createdAt: now,
          updatedAt: now
        });

        tx.objectStore('canonical_facts').put({
          id: 'canonical-fact-ember-background',
          projectId: PROJECT_ID,
          targetType: 'entity',
          targetId: TARGET_ID,
          targetName: TARGET_NAME,
          loreDocumentId: 'lore-doc-accepted-ember',
          sourceLoreDocumentTitle: 'Accepted Ember Archive Notes',
          sourceProposalId: 'accepted-proposal-ember-background',
          factType: 'background',
          value: 'Founded after the first beacon failed.',
          evidenceText: 'Background: Founded after the first beacon failed.',
          evidenceStart: 0,
          evidenceEnd: 50,
          acceptedAt: now - 1,
          updatedAt: now - 1
        });

        tx.objectStore('lore_fact_proposals').put({
          id: 'proposal-ember-background-conflict',
          projectId: PROJECT_ID,
          loreDocumentId: 'lore-doc-ember-archive',
          targetType: 'entity',
          targetId: TARGET_ID,
          targetName: TARGET_NAME,
          factType: 'background',
          value: 'Founded in the old watchtower.',
          confidence: 0.85,
          evidence: {
            start: 0,
            end: 40,
            text: 'Background: Founded in the old watchtower.'
          },
          status: 'proposed',
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
    });
  });
}

describe('Canon Decisions', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('keeps a resolved fact conflict suppressed after reload', () => {
    seedFactConflict();

    cy.visit('/canon-decisions');
    cy.contains('h1, h2', 'Canon Decisions').should('be.visible');
    cy.contains('h2', 'background conflict for Ember Archive').should('be.visible');
    cy.contains(
      'The proposed value "Founded in the old watchtower." conflicts with accepted canon "Founded after the first beacon failed.".'
    ).should('be.visible');
    cy.contains('strong', 'Proposed:')
      .parent()
      .should('contain.text', 'background = Founded in the old watchtower.');
    cy.contains('strong', 'Current canon:')
      .parent()
      .should('contain.text', 'Ember Archive background: Founded after the first beacon failed.');
    cy.contains('strong', 'Evidence:')
      .parent()
      .should('contain.text', 'Background: Founded in the old watchtower.');

    cy.contains('button', 'Keep Separate').click();
    cy.contains('[role="status"]', 'Cluster marked keep separate.').should('be.visible');
    cy.contains('h2', 'No open canon decisions').should('be.visible');
    cy.contains('background conflict for Ember Archive').should('not.exist');

    cy.reload();
    cy.contains('h2', 'No open canon decisions').should('be.visible');
    cy.contains('background conflict for Ember Archive').should('not.exist');
  });
});
