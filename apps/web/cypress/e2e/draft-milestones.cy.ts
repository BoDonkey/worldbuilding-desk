// Slice 4.96: save a draft milestone, edit two scenes, open the milestone and
// read the old text, export it, and restore a deleted scene from Drafts.
import {sanitizeFileNamePart} from '../../src/utils/downloadJson';

const editor = () => cy.get('.tiptap-editor');
const drafts = () => cy.get('[role="dialog"][aria-labelledby="drafts-title"]');
// At Cypress's narrow viewport the scene drawer covers the editor until closed.
const openScene = (title: string) => {
  cy.contains('button', 'Scenes').click();
  cy.contains('span', title).click({force: true});
  cy.contains('button', /^Close$/).click();
};
const openDrafts = () => {
  cy.contains('button', 'Scenes').click();
  cy.contains('button', /^Drafts$/).click({force: true});
};
const toast = (text: string) =>
  cy.get('[data-testid="app-toast-viewport"]').contains(text).should('be.visible');

describe('Draft milestones', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    openScene('Alpha Scene');
    editor().should('contain.text', 'Alpha content');
  });

  it('saves a milestone, shows its old text after edits, and exports it', () => {
    openDrafts();
    drafts().within(() => {
      cy.contains('No milestones yet').should('be.visible');
      cy.get('input[type="text"]').type('Draft 1 complete');
      cy.contains('button', 'Save draft milestone').click();
    });
    toast('Draft milestone "Draft 1 complete" saved.');
    drafts().within(() => {
      cy.contains('button', 'Draft 1 complete').should('contain.text', '3 scenes');
      cy.contains('button', 'Close').click();
    });
    cy.contains('button', /^Close$/).click();

    editor().click().type('{selectall}Alpha rewritten after the draft', {delay: 0});
    editor().should('contain.text', 'after the draft');
    openScene('Beta Scene');
    editor().should('contain.text', 'Beta content');
    editor().click().type('{selectall}Beta rewritten too', {delay: 0});
    editor().should('contain.text', 'rewritten too');

    openDrafts();
    drafts().within(() => {
      cy.get('[data-testid="milestone-text"]')
        .should('contain.text', 'Alpha content')
        .and('contain.text', 'Beta content')
        .and('contain.text', 'Gamma content')
        .and('not.contain.text', 'rewritten');
      cy.contains('button', 'Alpha Scene').should('contain.text', '(changed since)');
      cy.contains('button', 'Gamma Scene').should('not.contain.text', 'changed since');

      cy.contains('button', 'Beta Scene').click();
      cy.get('[data-testid="snapshot-text"]').should('contain.text', 'Beta content');
      cy.get('[data-testid="snapshot-current-text"]').should('contain.text', 'Beta rewritten too');
      cy.contains('label', 'Compare').click();
      cy.get('[data-testid="snapshot-compare-summary"]').should('contain.text', '2 words added, 1 word removed');

      cy.contains('button', 'Markdown').click();
    });
    toast('Exported "Draft 1 complete".');
    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `${sanitizeFileNamePart('Cypress Smoke Project - Draft 1 complete')}-scenes-${stamp}.md`;
    cy.readFile(`cypress/downloads/${fileName}`, {timeout: 10000}).should((markdown: string) => {
      expect(markdown).to.contain('Alpha content').and.contain('Beta content').and.contain('Gamma content');
      expect(markdown).not.to.contain('rewritten');
    });
  });

  it('lists a deleted scene and restores it from its snapshot', () => {
    editor().click().type('{selectall}Alpha, last words before deletion', {delay: 0});
    cy.contains('button', 'Scenes').click();
    cy.contains('li', 'Alpha Scene').contains('button', 'Delete').click({force: true});
    cy.contains('[role="alertdialog"], [role="dialog"]', 'Delete "Alpha Scene"?')
      .should('contain.text', 'Drafts → Deleted scenes can bring it back')
      .contains('button', /^Delete$/)
      .click();
    toast('Scene deleted.');

    cy.contains('button', /^Drafts$/).click({force: true});
    drafts().within(() => {
      cy.get('ul[aria-label="Deleted scenes"]').contains('button', 'Alpha Scene').click();
      cy.get('[data-testid="snapshot-text"]').should('contain.text', 'last words before deletion');
      cy.contains('button', 'Restore scene from this snapshot').click();
    });
    toast('Restored "Alpha Scene" from its snapshot.');
    drafts().should('not.exist');
    editor().should('contain.text', 'last words before deletion');

    cy.reload();
    openScene('Alpha Scene');
    editor().should('contain.text', 'last words before deletion');
  });

  it('saves a milestone from the Projects page', () => {
    cy.visit('/projects');
    cy.contains('button', 'Save draft milestone').click();
    cy.get('[role="dialog"]').within(() => {
      cy.get('input[type="text"]').type('Before revisions');
      cy.contains('button', 'Save draft milestone').click();
    });
    toast('Draft milestone "Before revisions" saved for Cypress Smoke Project.');
    cy.visit('/workspace');
    openDrafts();
    drafts().contains('button', 'Before revisions').should('contain.text', '3 scenes');
  });
});
