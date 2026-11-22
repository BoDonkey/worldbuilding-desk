// Slice 4.97: rewrite a paragraph beside the original, keep both, come back
// to the alternative from Snapshots, use it, and undo; and refuse a stale rewrite.
import {DB_NAME, DB_VERSION, SCENE_SNAPSHOT_STORE_NAME} from '../../src/services/storage/db';

const editor = () => cy.get('.tiptap-editor');
const panel = () => cy.get('section[aria-label="Rewrite beside the original"]');
const snapshotsDialog = () => cy.get('[role="dialog"][aria-labelledby="scene-snapshots-title"]');
const undoKey = Cypress.platform === 'darwin' ? '{cmd}z' : '{ctrl}z';
const toast = (text: string) =>
  cy.get('[data-testid="app-toast-viewport"]').contains(text).should('be.visible');

// At Cypress's narrow viewport the scene drawer covers the editor until closed.
const openScene = (title: string) => {
  cy.contains('button', 'Scenes').click();
  cy.contains('span', title).click({force: true});
  cy.contains('button', /^Close$/).click();
};

/** Selects the whole first paragraph of the scene and right-clicks it. */
const rewriteFirstParagraph = () => {
  editor().find('p').first().then(($paragraph) => {
    const doc = $paragraph[0].ownerDocument;
    const range = doc.createRange();
    range.selectNodeContents($paragraph[0]);
    const selection = doc.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    doc.dispatchEvent(new Event('selectionchange'));
  });
  editor().find('p').first().trigger('contextmenu');
  cy.contains('button', 'Rewrite beside original').click();
};

const readKinds = () =>
  cy.window({log: false}).then(
    (win) =>
      new Cypress.Promise<string[]>((resolve, reject) => {
        const request = win.indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const all = db.transaction(SCENE_SNAPSHOT_STORE_NAME, 'readonly').objectStore(SCENE_SNAPSHOT_STORE_NAME).getAll();
          all.onsuccess = () => {
            db.close();
            resolve((all.result as Array<{kind: string}>).map((snapshot) => snapshot.kind).sort());
          };
          all.onerror = () => reject(all.error);
        };
      })
  );

describe('Rewrite beside the original', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    openScene('Alpha Scene');
    editor().should('contain.text', 'Alpha content');
    editor().click().type('{selectall}Rain fell on the gate.{enter}She waited.', {delay: 0});
    editor().find('p').should('have.length', 2);
  });

  it('keeps both, comes back to the alternative, uses it, and undoes', () => {
    rewriteFirstParagraph();
    panel().within(() => {
      cy.get('[data-testid="rewrite-original"]').should('have.text', 'Rain fell on the gate.');
      cy.get('[data-testid="rewrite-copy"] [contenteditable="true"]')
        .type('{selectall}Rain hammered the iron gate.', {delay: 0});
      cy.get('input[type="text"]').type('Iron gate');
      cy.contains('button', 'Keep both').click();
    });
    toast('Saved "Iron gate" in this scene\'s Snapshots.');
    panel().should('not.exist');
    editor().should('contain.text', 'Rain fell on the gate.').and('not.contain.text', 'hammered');

    cy.contains('button', /^Snapshots$/).click();
    snapshotsDialog().within(() => {
      cy.get('ul[aria-label="Passage alternatives"]').contains('button', 'Iron gate').click();
      cy.get('[data-testid="snapshot-text"]').should('contain.text', 'Rain fell on the gate.');
      cy.get('[data-testid="snapshot-current-text"]').should('contain.text', 'Rain hammered the iron gate.');
      cy.contains('button', 'Open beside original').click();
    });
    snapshotsDialog().should('not.exist');

    panel().within(() => {
      cy.get('[data-testid="rewrite-copy"]').should('contain.text', 'hammered the iron gate');
      cy.contains('button', 'Use rewrite').click();
    });
    toast('Rewrite used.');
    panel().should('not.exist');
    editor().find('p').then(($paragraphs) => {
      expect([...$paragraphs].map((p) => p.textContent)).to.deep.equal(['Rain hammered the iron gate.', 'She waited.']);
    });
    readKinds().should('include', 'before-rewrite').and('include', 'alternative');

    editor().type(undoKey);
    editor().find('p').first().should('have.text', 'Rain fell on the gate.');
  });

  it('allows edits elsewhere but refuses once the original passage changes', () => {
    rewriteFirstParagraph();
    panel().find('[data-testid="rewrite-copy"] [contenteditable="true"]').type('{selectall}Rain hammered.', {delay: 0});

    editor().find('p').last().click().type('{end} Nobody came.', {delay: 0});
    editor().should('contain.text', 'Nobody came.');
    panel().find('[role="alert"]').should('not.exist');
    panel().contains('button', 'Use rewrite').should('not.be.disabled');

    // Text added just after the passage is outside it, so the rewrite still applies.
    editor().find('p').first().click().type('{end} Again.', {delay: 0});
    panel().find('[role="alert"]').should('not.exist');
    // An edit inside the passage makes Use rewrite refuse.
    editor().find('p').first().click().type('{home}{rightarrow}{rightarrow}{rightarrow}{rightarrow}y', {delay: 0});
    panel().find('[role="alert"]').should('contain.text', 'The original passage changed');
    panel().contains('button', 'Use rewrite').should('be.disabled');
    panel().contains('button', 'Discard').click();
    panel().should('not.exist');
    editor().find('p').first().should('have.text', 'Rainy fell on the gate. Again.');
  });
});
