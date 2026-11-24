// Slice 4.90: paragraph style, Narrow width, and the Custom font survive a
// reload, and the manuscript editor shows them.
const appearance = (label: string) => cy.get(`[role="group"][aria-label="${label}"]`);
const choose = (label: string, option: string) =>
  appearance(label).within(() => {
    cy.contains('button', option).click().should('have.attr', 'aria-pressed', 'true');
  });
// At Cypress's narrow viewport the scene drawer covers the editor until closed.
const openScene = (title: string) => {
  cy.contains('button', 'Scenes').click();
  cy.contains('span', title).click({force: true});
  cy.contains('button', /^Close$/).click();
};

describe('Editor text options', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
  });

  it('keeps Narrow, Indented, and a Custom font after a reload', () => {
    cy.visit('/settings');
    cy.ensureSettingsSectionOpen('Reading & Editor');
    choose('Reading width', 'Narrow');
    choose('Paragraphs', 'Indented');
    choose('Text style', 'Custom');
    cy.get('#editor-custom-font').type('Courier New');
    cy.get('[data-testid="custom-font-preview"]')
      .should('have.css', 'font-family')
      .and('match', /^"Courier New", "Iowan Old Style"/);

    cy.reload();
    cy.ensureSettingsSectionOpen('Reading & Editor');
    appearance('Reading width').contains('button', 'Narrow').should('have.attr', 'aria-pressed', 'true');
    appearance('Paragraphs').contains('button', 'Indented').should('have.attr', 'aria-pressed', 'true');
    appearance('Text style').contains('button', 'Custom').should('have.attr', 'aria-pressed', 'true');
    cy.get('#editor-custom-font').should('have.value', 'Courier New');
    cy.get('html')
      .should('have.attr', 'data-editor-width', 'narrow')
      .and('have.attr', 'data-editor-paragraph', 'indented')
      .and('have.attr', 'data-editor-font', 'custom');

    cy.visit('/workspace');
    openScene('Alpha Scene');
    cy.get('.ProseMirror').should('contain.text', 'Alpha content');
    cy.get('.ProseMirror').should('have.css', 'max-width', '640px');
    cy.get('.ProseMirror').should('have.css', 'font-family').and('match', /^"Courier New"/);
    cy.get('.ProseMirror').click().type('{moveToEnd}{enter}Second paragraph');
    cy.get('.ProseMirror p').first().should('have.css', 'margin-bottom', '0px').and('have.css', 'text-indent', '0px');
    cy.get('.ProseMirror p').eq(1).should('contain.text', 'Second paragraph')
      .and('not.have.css', 'text-indent', '0px');
  });

  it('switches back to Spaced paragraphs and the default width', () => {
    cy.visit('/settings');
    cy.ensureSettingsSectionOpen('Reading & Editor');
    choose('Paragraphs', 'Indented');
    choose('Paragraphs', 'Spaced');
    choose('Reading width', 'Wide');
    cy.reload();
    cy.get('html').should('have.attr', 'data-editor-paragraph', 'spaced').and('have.attr', 'data-editor-width', 'wide');

    cy.visit('/workspace');
    openScene('Alpha Scene');
    cy.get('.ProseMirror').should('have.css', 'max-width', '980px');
    cy.get('.ProseMirror p').first().should('not.have.css', 'margin-bottom', '0px');
  });
});
