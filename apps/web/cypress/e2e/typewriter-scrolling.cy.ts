// Slice 4.92: typewriter scrolling keeps the caret line about a third of the
// way down the editor while typing, and leaves the author's own scrolling and
// clicks alone until the next key press.
export {};

type EditorElement = HTMLElement & {
  editor: {
    commands: {setContent: (html: string) => void; focus: (position: 'end') => void};
    state: {selection: {head: number}};
    view: {coordsAtPos: (pos: number) => {top: number}};
  };
};

const BAND_PX = 40;
const scrollArea = () => cy.get('[data-wbd-scroll-key="workspace-editor"]');
const longScene = Array.from(
  {length: 80},
  (_, index) => `<p>Paragraph ${index + 1}: the tide came in over the stones and went out again.</p>`
).join('');

/** Where the caret line is, as a share of the scroll area's height. */
const caretShare = () =>
  cy.get('[data-workspace-root] .ProseMirror').then(($el) => {
    const el = $el[0] as EditorElement;
    const area = el.closest('[data-wbd-scroll-key="workspace-editor"]') as HTMLElement;
    const caretTop = el.editor.view.coordsAtPos(el.editor.state.selection.head).top;
    return (caretTop - area.getBoundingClientRect().top) / area.clientHeight;
  });

const expectCaretOnLine = () =>
  cy.get('[data-workspace-root] .ProseMirror').should(($el) => {
    const el = $el[0] as EditorElement;
    const area = el.closest('[data-wbd-scroll-key="workspace-editor"]') as HTMLElement;
    const caretTop = el.editor.view.coordsAtPos(el.editor.state.selection.head).top;
    const line = area.getBoundingClientRect().top + area.clientHeight / 3;
    expect(Math.abs(caretTop - line), 'caret distance from the typing line').to.be.lessThan(BAND_PX);
  });

const openLongScene = (typewriter: 'on' | 'off', focusMode: 'on' | 'off' = 'off') => {
  cy.viewport(1400, 900);
  cy.visit('/');
  cy.seedSmokeProjectData();
  cy.window().then((win) => {
    win.localStorage.setItem('editorTypewriter', typewriter);
    win.localStorage.setItem('focusModeStart', focusMode);
    // Animation would make each check wait; reduced-motion jumps are tested the same way.
    win.localStorage.setItem('theme', 'light');
  });
  cy.visit('/workspace');
  cy.get('[data-workspace-root]').should('exist');
  if (focusMode === 'off') {
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.contains('button', /^Scenes$/).should('be.visible');
    cy.get('body').then(($body) => {
      if (!$body.find('aside[data-wbd-scroll-key="workspace-scene-drawer"]').length) {
        cy.contains('button', /^Scenes$/).click();
      }
    });
    cy.get('aside[data-wbd-scroll-key="workspace-scene-drawer"]').contains('span', 'Alpha Scene').click();
  }
  cy.get('[data-workspace-root] .ProseMirror').should('contain.text', 'Alpha content').then(($el) => {
    const el = $el[0] as EditorElement;
    el.editor.commands.setContent(longScene);
    el.editor.commands.focus('end');
  });
  cy.get('[data-workspace-root] .ProseMirror').should('contain.text', 'Paragraph 80');
};

describe('Typewriter scrolling', () => {
  it('keeps the caret line in the band while typing and on keyboard caret moves', () => {
    openLongScene('on');
    cy.get('html').should('have.attr', 'data-editor-typewriter', 'on');
    cy.focused().type(' More.{enter}A new line at the end.');
    expectCaretOnLine();
    cy.focused().type('{enter}And another.');
    expectCaretOnLine();
    cy.focused().type('{uparrow}{uparrow}{uparrow}{uparrow}{uparrow}{uparrow}');
    expectCaretOnLine();
  });

  it('does not undo a manual scroll or a click until typing resumes', () => {
    openLongScene('on');
    cy.focused().type(' More.');
    expectCaretOnLine();
    cy.wait(700); // let the smooth scroll finish

    // Undoing the author's scroll would mean jumping back to the caret, far below.
    scrollArea().then(($area) => {
      $area[0].scrollTop = 0;
    });
    cy.wait(700);
    scrollArea().its('0.scrollTop').should('be.lessThan', BAND_PX);

    // A click may nudge the caret out from under the sticky toolbar (ProseMirror
    // scrolls a few pixels), but it never moves the line to the typing height.
    // scrollBehavior: false, or Cypress itself scrolls the paragraph into view.
    cy.contains('[data-workspace-root] .ProseMirror p', 'Paragraph 5:').click({scrollBehavior: false});
    cy.wait(700);
    scrollArea().its('0.scrollTop').should('be.lessThan', BAND_PX);

    cy.focused().type('x');
    // The caret is near the top, so the area cannot scroll it down to the line;
    // move far enough down that it can.
    cy.focused().type('{downarrow}'.repeat(30));
    expectCaretOnLine();
  });

  it('works in focus mode', () => {
    // The seeded project opens its only scene, so focus mode can start on.
    openLongScene('on', 'on');
    cy.get('[data-testid="focus-mode-bar"]').should('be.visible');
    cy.focused().type(' More.{enter}A new line at the end.');
    expectCaretOnLine();
  });

  it('is off by default: the caret stays wherever the browser puts it', () => {
    openLongScene('off');
    cy.get('html').should('have.attr', 'data-editor-typewriter', 'off');
    cy.focused().type(' More.{enter}A new line at the end.');
    cy.wait(300);
    caretShare().should('be.greaterThan', 0.5);
  });
});
