import {DB_NAME, DB_VERSION} from '../../src/db';

const longSceneContent = (label: string, marker: string) =>
  Array.from({length: 45}, (_, index) =>
    `<p>${label} paragraph ${index + 1}. ${
      index === 8 || index === 32 ? marker : 'The road continues beyond the ridge.'
    }</p>`
  ).join('');

function seedContinuityScenes(): Cypress.Chainable<void> {
  return cy.window({log: false}).then(
    (win) =>
      new Cypress.Promise<void>((resolve, reject) => {
        const request = win.indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('writingDocuments', 'readwrite');
          const now = Date.now();
          tx.objectStore('writingDocuments').put({
            id: 'scene-alpha',
            projectId: 'cypress-project-1',
            title: 'Alpha Scene',
            content: longSceneContent('Alpha', 'Sunspire signal'),
            createdAt: now,
            updatedAt: now
          });
          tx.objectStore('writingDocuments').put({
            id: 'scene-beta',
            projectId: 'cypress-project-1',
            title: 'Beta Scene',
            content: longSceneContent('Beta', 'Moonwell signal'),
            createdAt: now + 1,
            updatedAt: now + 1
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        };
      })
  );
}

const editorScroller = () =>
  cy.get<HTMLElement>('[data-wbd-scroll-key="workspace-editor"]');

const setEditorScrollTop = (top: number) => {
  editorScroller().then(($element) => {
    const element = $element[0];
    expect(element.scrollHeight).to.be.greaterThan(element.clientHeight);
    element.dispatchEvent(new WheelEvent('wheel', {bubbles: true, deltaY: top}));
    element.scrollTop = top;
    element.dispatchEvent(new Event('scroll'));
  });
  cy.wait(100);
};

describe('Workspace scene continuity and current-scene Find', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.seedSmokeProjectData();
    seedContinuityScenes();
    cy.reload();
    cy.visit('/workspace');
    cy.contains('h1', 'Writing Workspace').should('be.visible');
  });

  it('keeps scene selection and isolated scroll through scene changes and route remounts', () => {
    cy.contains('button', 'Scenes').click();
    cy.contains('span', 'Beta Scene').click({force: true});
    cy.get('.tiptap-editor').should('contain.text', 'Moonwell signal');

    setEditorScrollTop(240);
    editorScroller().should(($element) => {
      expect($element[0].scrollTop).to.be.closeTo(240, 2);
    });

    cy.contains('span', 'Alpha Scene').click({force: true});
    cy.get('.tiptap-editor').should('contain.text', 'Sunspire signal');
    editorScroller().should(($element) => {
      expect($element[0].scrollTop).to.equal(0);
    });
    setEditorScrollTop(80);

    cy.contains('span', 'Beta Scene').click({force: true});
    cy.get('.tiptap-editor').should('contain.text', 'Moonwell signal');
    editorScroller().should(($element) => {
      expect($element[0].scrollTop).to.be.closeTo(240, 2);
    });

    cy.contains('button', 'Scenes').click({force: true});
    cy.window()
      .its('__wbdEditorScrollPositions.workspace-editor-scroll:cypress-project-1:scene-beta')
      .should('eq', 240);

    cy.contains('a', 'World Bible').click();
    cy.contains('h1', 'World Bible').should('be.visible');
    cy.window()
      .its('__wbdEditorScrollPositions.workspace-editor-scroll:cypress-project-1:scene-beta')
      .should('eq', 240);
    cy.contains('a', 'Workspace').click();
    cy.contains('h1', 'Writing Workspace').should('be.visible');
    cy.get('label').contains('Title').parent().find('input').should('have.value', 'Beta Scene');
    cy.get('.tiptap-editor').should('contain.text', 'Moonwell signal');
    cy.window()
      .its('__wbdEditorScrollPositions.workspace-editor-scroll:cypress-project-1:scene-beta')
      .should('eq', 240);
    editorScroller().should(($element) => {
      expect($element[0].scrollTop).to.be.closeTo(240, 2);
    });

    cy.contains('button', 'Find in scene').click();
    cy.get('[role="search"][aria-label="Find in current scene"]').should('be.visible');
    cy.get('button[aria-label="Close find in scene"]').click();
    cy.get('body').type('{ctrl}f');
    cy.get('[role="search"][aria-label="Find in current scene"] input')
      .should('be.focused')
      .type('moonwell');
    cy.contains('[role="status"]', '1 of 2').should('be.visible');
    cy.get('[data-current-scene-find-match]').should('have.length', 2);

    cy.get('[role="search"][aria-label="Find in current scene"] input').type('{enter}');
    cy.contains('[role="status"]', '2 of 2').should('be.visible');
    cy.get('[data-current-scene-find-active="true"]')
      .should('have.attr', 'data-current-scene-find-match', '2');

    cy.get('body').type('{esc}');
    cy.get('[role="search"][aria-label="Find in current scene"]').should('not.exist');
    cy.get('.tiptap-editor').should('be.focused');
  });
});
