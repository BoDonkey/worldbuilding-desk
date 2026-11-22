// Slice 4.95: take a named snapshot, edit, compare, restore, then restore back.
import {DB_NAME, DB_VERSION, SCENE_SNAPSHOT_STORE_NAME} from '../../src/services/storage/db';

const readSnapshots = () =>
  cy.window({log: false}).then(
    (win) =>
      new Cypress.Promise<Array<{sceneId: string; kind: string; sceneTitle?: string; content: string}>>((resolve, reject) => {
        const request = win.indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const all = db.transaction(SCENE_SNAPSHOT_STORE_NAME, 'readonly').objectStore(SCENE_SNAPSHOT_STORE_NAME).getAll();
          all.onsuccess = () => {
            db.close();
            resolve(all.result);
          };
          all.onerror = () => reject(all.error);
        };
      })
  );

const editor = () => cy.get('.tiptap-editor');
const dialog = () => cy.get('[role="dialog"][aria-labelledby="scene-snapshots-title"]');
// At Cypress's narrow viewport the scene drawer covers the editor until closed.
const openScene = (title: string) => {
  cy.contains('button', 'Scenes').click();
  cy.contains('span', title).click({force: true});
  cy.contains('button', /^Close$/).click();
};
const toast = (text: string) =>
  cy.get('[data-testid="app-toast-viewport"]').contains(text).should('be.visible');

describe('Scene snapshots', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    openScene('Alpha Scene');
    editor().should('contain.text', 'Alpha content');
  });

  it('takes, compares, restores, and restores back', () => {
    cy.contains('button', /^Snapshots$/).click();
    dialog().within(() => {
      cy.contains('No snapshots yet').should('be.visible');
      cy.get('input[type="text"]').type('Draft 1');
      cy.contains('button', 'Take snapshot').click();
    });
    toast('Snapshot "Draft 1" saved.');
    dialog().within(() => {
      cy.contains('button', 'Draft 1').should('have.attr', 'aria-pressed', 'true');
      cy.contains('button', 'Close').click();
    });

    editor().click().type('{selectall}Alpha rewritten beside the iron gate', {delay: 0});
    editor().should('contain.text', 'iron gate');

    cy.contains('button', /^Snapshots$/).click();
    dialog().within(() => {
      cy.get('[data-testid="snapshot-text"]').should('contain.text', 'Alpha content');
      cy.get('[data-testid="snapshot-current-text"]').should('contain.text', 'iron gate');
      cy.get('ins').should('not.exist');

      cy.contains('label', 'Compare').click();
      cy.get('[data-testid="snapshot-compare-summary"]').should('contain.text', '5 words added, 1 word removed');
      cy.get('[data-testid="snapshot-text"] del').should('have.text', 'content');
      cy.get('[data-testid="snapshot-current-text"] ins').first().should('have.text', 'rewritten');

      cy.contains('button', 'Restore').click();
    });
    toast('Snapshot restored.');
    editor().should('contain.text', 'Alpha content').and('not.contain.text', 'iron gate');

    // The text before the restore is itself a snapshot, so the restore can be undone.
    dialog().within(() => {
      cy.contains('button', 'Automatic: before a restore').click();
      cy.get('[data-testid="snapshot-text"]').should('contain.text', 'iron gate');
      cy.contains('button', 'Restore').click();
    });
    editor().should('contain.text', 'iron gate').and('not.contain.text', 'Alpha content');
    dialog().within(() => {
      cy.get('ul[aria-label="Snapshots of this scene"] > li').should('have.length', 3);
      cy.contains('button', 'Close').click();
    });

    // The restored text saves like any edit and the snapshots persist.
    cy.contains('Saved at', {timeout: 8000});
    cy.reload();
    openScene('Alpha Scene');
    editor().should('contain.text', 'iron gate');
    cy.contains('button', /^Snapshots$/).click();
    dialog().find('ul[aria-label="Snapshots of this scene"] > li').should('have.length', 3);
  });

  it('takes an unnamed snapshot from the shortcut', () => {
    editor().click().type('{ctrl}{shift}s', {delay: 0});
    toast('Snapshot saved.');
    cy.contains('button', /^Snapshots$/).click();
    dialog().contains('button', /^Snapshot/).should('contain.text', '2 words');
  });

  it('keeps a deleted scene\'s snapshots and saves its last text first', () => {
    cy.contains('button', /^Snapshots$/).click();
    dialog().within(() => {
      cy.contains('button', 'Take snapshot').click();
      cy.contains('button', 'Close').click();
    });
    editor().click().type('{selectall}Alpha, last words before deletion', {delay: 0});
    cy.contains('button', 'Scenes').click();
    cy.contains('li', 'Alpha Scene').contains('button', 'Delete').click({force: true});
    cy.contains('[role="alertdialog"], [role="dialog"]', 'Delete "Alpha Scene"?').contains('button', /^Delete$/).click();
    toast('Scene deleted.');
    readSnapshots().then((snapshots) => {
      const alpha = snapshots.filter((snapshot) => snapshot.sceneId === 'scene-alpha');
      expect(alpha.map((snapshot) => snapshot.kind).sort()).to.deep.equal(['before-delete', 'manual']);
      expect(alpha.find((snapshot) => snapshot.kind === 'before-delete')).to.include({sceneTitle: 'Alpha Scene'});
      expect(alpha.find((snapshot) => snapshot.kind === 'before-delete')?.content).to.contain('last words before deletion');
    });
  });
});
