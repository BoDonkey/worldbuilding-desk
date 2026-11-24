// Slice 4.91: focus mode hides everything but the scene and a word count,
// keeps saving, and puts the panels back as they were when it ends.
export {};

const editor = () => cy.get('[data-workspace-root] .ProseMirror');
const focusBar = () => cy.get('[data-testid="focus-mode-bar"]');
const rail = () => cy.get('nav[aria-label="Primary navigation"]');
const sceneDrawer = () => cy.get('aside[data-wbd-scroll-key="workspace-scene-drawer"]');
const contextDrawer = () => cy.get('aside[class*="contextDrawerDesktop"]');
const toolbar = () => cy.get('[data-workspace-root] .tiptap-wrapper > .control-group');

const expectFocusMode = () => {
  focusBar().should('be.visible').and('contain.text', 'words');
  cy.get('html').should('have.attr', 'data-focus-mode', 'on');
  rail().should('not.be.visible');
  cy.get('aside[data-wbd-scroll-key="workspace-scene-drawer"]:visible').should('not.exist');
  cy.get('aside[class*="contextDrawerDesktop"]:visible').should('not.exist');
  toolbar().should('not.be.visible');
  cy.contains('h1', 'Writing Workspace').should('not.be.visible');
  cy.contains('button', 'Save now').should('not.be.visible');
  cy.focused().should('have.class', 'ProseMirror');
};

const expectNormalMode = () => {
  focusBar().should('not.exist');
  cy.get('html').should('not.have.attr', 'data-focus-mode');
  rail().should('be.visible');
  toolbar().should('be.visible');
  cy.contains('h1', 'Writing Workspace').should('be.visible');
};

// The scene drawer may already be open (its state is remembered); open it if not.
const openAlphaScene = () => {
  cy.contains('button', /^Scenes$/).should('be.visible');
  cy.get('body').then(($body) => {
    if (!$body.find('aside[data-wbd-scroll-key="workspace-scene-drawer"]').length) {
      cy.contains('button', /^Scenes$/).click();
    }
  });
  sceneDrawer().contains('span', 'Alpha Scene').click();
};

describe('Focus mode', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    openAlphaScene();
    editor().should('contain.text', 'Alpha content');
  });

  it('hides the panels, keeps saving, and restores them on Escape', () => {
    cy.contains('button', /^Context$/).click();
    contextDrawer().should('be.visible');
    cy.contains('button', /^Focus mode$/).should('have.attr', 'aria-pressed', 'false').click();
    expectFocusMode();
    cy.get('[role="status"]').should('contain.text', 'Focus mode on. Press Escape to leave.');

    cy.focused().type('{moveToEnd}{enter}Written in focus mode.');
    focusBar().should('contain.text', '6 words');

    cy.focused().type('{esc}');
    expectNormalMode();
    cy.focused().should('have.class', 'ProseMirror');
    sceneDrawer().should('be.visible').and('contain.text', 'Alpha Scene');
    contextDrawer().should('be.visible');
    cy.contains('Saved at', {timeout: 8000}).should('be.visible');

    cy.reload();
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    openAlphaScene();
    editor().should('contain.text', 'Written in focus mode.');
  });

  it('toggles from the shortcut and the command palette, and Escape closes the find bar first', () => {
    cy.get('body').type('{ctrl}{shift}F');
    expectFocusMode();

    // Find opens over focus mode; Escape closes it and focus mode stays on.
    cy.focused().type('{ctrl}f');
    cy.focused().should('not.have.class', 'ProseMirror');
    cy.focused().type('{esc}');
    focusBar().should('be.visible');
    cy.get('html').should('have.attr', 'data-focus-mode', 'on');

    cy.contains('button', 'Leave focus mode').click();
    expectNormalMode();

    cy.get('body').type('{ctrl}k');
    cy.get('[role="dialog"][aria-label="Command palette"]').should('be.visible');
    cy.contains('button', 'Workspace: Focus Mode').click();
    expectFocusMode();

    cy.get('body').type('{ctrl}{shift}F');
    expectNormalMode();
  });

  it('starts on when the setting says so, and ends when leaving the Workspace', () => {
    cy.visit('/settings');
    cy.ensureSettingsSectionOpen('Reading & Editor');
    cy.get('[role="group"][aria-label="Focus mode when the Workspace opens"]').within(() => {
      cy.contains('button', 'On').click().should('have.attr', 'aria-pressed', 'true');
    });
    cy.get('html').should('not.have.attr', 'data-focus-mode');

    cy.visit('/workspace');
    cy.get('html').should('have.attr', 'data-focus-mode', 'on');
    rail().should('not.be.visible');

    cy.visit('/settings');
    cy.get('html').should('not.have.attr', 'data-focus-mode');
    rail().should('be.visible');
  });
});
