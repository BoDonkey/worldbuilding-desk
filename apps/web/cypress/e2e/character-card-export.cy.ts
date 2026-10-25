import {DB_NAME, DB_VERSION} from '../../src/services/storage/db';

const PROJECT_ID = 'cypress-project-1';

function seedMira(win: Window): Promise<void> {
  const now = Date.now();
  return new Promise((resolve, reject) => {
    const open = win.indexedDB.open(DB_NAME, DB_VERSION);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(
        ['entityCategories', 'entities', 'canonical_facts', 'lore_fact_proposals', 'consistency_aliases', 'lore_documents'],
        'readwrite'
      );
      const fact = (id: string, factType: string, value: string, extra: Record<string, unknown> = {}) => ({
        id, projectId: PROJECT_ID, targetType: 'entity', targetId: 'entity-mira', targetName: 'Mira Voss',
        factType, value, acceptedAt: now, updatedAt: now, ...extra
      });
      const proposal = (id: string, value: string) => ({
        id, projectId: PROJECT_ID, loreDocumentId: 'lore-mira', targetType: 'entity', targetId: 'entity-mira',
        factType: 'background', value, confidence: 0.9, evidence: {start: 0, end: 4, text: value},
        status: 'proposed', createdAt: now, updatedAt: now
      });
      tx.objectStore('entityCategories').put({
        id: 'characters', projectId: PROJECT_ID, kind: 'character', name: 'Characters', slug: 'characters',
        fieldSchema: [{key: 'description', label: 'Description', type: 'textarea'}], createdAt: now
      });
      tx.objectStore('entities').put({
        id: 'entity-mira', projectId: PROJECT_ID, categoryId: 'characters', name: 'Mira Voss',
        fields: {description: '<p>A smith in Glass Harbor.</p>', notes: '<p>Maybe she knew the envoy.</p>'},
        links: [], createdAt: now, updatedAt: now
      });
      tx.objectStore('canonical_facts').put(fact('fact-mira-trait', 'trait', 'blunt'));
      tx.objectStore('canonical_facts').put(fact('fact-mira-job', 'occupation', 'smith'));
      // Saved as canon, but its proposal never finished accepting.
      tx.objectStore('canonical_facts').put(
        fact('fact-mira-half', 'background', 'HALF-ACCEPTED-FACT', {sourceProposalId: 'proposal-mira-half'})
      );
      tx.objectStore('lore_fact_proposals').put(proposal('proposal-mira-half', 'HALF-ACCEPTED-FACT'));
      tx.objectStore('lore_fact_proposals').put(proposal('proposal-mira-pending', 'PENDING-PROPOSAL'));
      tx.objectStore('consistency_aliases').put({
        id: 'alias-mira', projectId: PROJECT_ID, targetType: 'entity', targetId: 'entity-mira',
        alias: 'Lantern-Mira', createdAt: now, updatedAt: now
      });
      tx.objectStore('lore_documents').put({
        id: 'lore-mira', projectId: PROJECT_ID, title: 'Mira rumors', kind: 'general_lore', format: 'plain_text',
        content: 'SOURCE-NOTE-TEXT', status: 'active', source: {type: 'manual'}, createdAt: now, updatedAt: now
      });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    };
  });
}

describe('Character card export (4.70)', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.window().then((win) => seedMira(win));
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('downloads a V2 card with accepted canon only', () => {
    cy.visit('/world-bible');
    cy.contains('h1', 'World Bible').should('be.visible');
    cy.contains('button', 'Characters').click();
    cy.contains('[class*="entityName"]', /^Mira Voss$/).parents('li').first().within(() => {
      cy.contains('button', 'Edit').click();
    });

    const blobs: Blob[] = [];
    cy.window().then((win) => {
      const original = win.URL.createObjectURL.bind(win.URL);
      cy.stub(win.URL, 'createObjectURL').callsFake((blob: Blob) => {
        blobs.push(blob);
        return original(blob);
      });
    });

    cy.contains('[role="tab"]', 'Writing aids').click();
    cy.contains('button', 'Export character card').click();
    cy.contains('[role="status"]', 'Saved Mira_Voss.card.json.').should('be.visible');

    cy.wrap(null).then(() => {
      expect(blobs).to.have.length(1);
      return blobs[0]!.text();
    }).then((text) => {
      const card = JSON.parse(text as unknown as string) as {spec: string; data: Record<string, string>};
      expect(card.spec).to.equal('chara_card_v2');
      expect(card.data.name).to.equal('Mira Voss');
      expect(card.data.description).to.contain('A smith in Glass Harbor.');
      expect(card.data.description).to.contain('Also known as: Lantern-Mira');
      expect(card.data.description).to.contain('- occupation: smith');
      expect(card.data.personality).to.equal('blunt');
      expect(card.data.creator_notes).to.contain('Maybe she knew the envoy.');
      for (const left of ['HALF-ACCEPTED-FACT', 'PENDING-PROPOSAL', 'SOURCE-NOTE-TEXT']) {
        expect(text).not.to.contain(left);
      }
    });
  });
});
