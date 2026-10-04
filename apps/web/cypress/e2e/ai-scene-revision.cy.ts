describe('Reviewed assistant scene revisions', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.visit('/workspace');
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'Alpha content');
    cy.window().then((win) => {
      win.sessionStorage.setItem('wbd:assistant-conversation:cypress-project-1', JSON.stringify([
        {role: 'assistant', content: 'Revised opening'}
      ]));
    });
  });

  function selectAlpha() {
    cy.window().then((win) => win.dispatchEvent(new CustomEvent('ai-expand-request', {
      detail: {selectedText: 'Alpha', from: 1, to: 6}
    })));
    cy.contains('button', 'Preview scene revision').should('be.visible').click();
    cy.contains('strong', 'Replace selected scene text').should('be.visible');
  }

  it('offers the inline writing coach with scene evidence, and keeps it enabled once text is selected', () => {
    cy.contains('button', 'Context').click();
    cy.contains('button', /^AI$/).click();
    cy.contains('button', 'Ask the writing coach').should('be.visible').and('not.be.disabled');
    cy.window().then((win) => win.dispatchEvent(new CustomEvent('ai-expand-request', {
      detail: {selectedText: 'Alpha', from: 1, to: 6}
    })));
    cy.contains('button', 'Ask the writing coach').should('not.be.disabled');
  });

  it('previews, dismisses, and confirms a replacement without automatic writes', () => {
    selectAlpha();
    cy.get('.tiptap[contenteditable="true"]').should('have.text', 'Alpha content');
    cy.contains('button', 'Dismiss').click();
    cy.get('.tiptap[contenteditable="true"]').should('have.text', 'Alpha content');
    cy.contains('button', 'Preview scene revision').click();
    cy.contains('button', 'Confirm action').click();
    cy.get('.tiptap[contenteditable="true"]').should('have.text', 'Revised opening content');
    cy.contains('strong', 'Replace selected scene text').should('not.exist');
    // An app-written reply (no provenance) is not AI text.
    cy.get('.tiptap [data-ai-text]').should('not.exist');
  });

  it('marks a confirmed model-written revision as AI text the author can reclaim', () => {
    cy.window().then((win) => {
      win.sessionStorage.setItem('wbd:assistant-conversation:cypress-project-1', JSON.stringify([
        {
          role: 'assistant',
          content: 'Revised opening',
          provenance: {origin: 'scene-revision', provider: 'ollama', route: 'private-local', at: 1}
        }
      ]));
    });
    cy.reload();
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'Alpha content');
    selectAlpha();
    cy.contains('button', 'Confirm action').click();
    cy.get('.tiptap [data-ai-text="scene-revision"]').should('have.text', 'Revised opening');
    cy.contains('button', 'Hide AI text').should('be.visible');

    cy.get('.tiptap [data-ai-text]').click();
    cy.contains('button', 'Mark as my writing').click();
    cy.get('.tiptap [data-ai-text]').should('not.exist');
    cy.get('.tiptap[contenteditable="true"]').should('have.text', 'Revised opening content');
    cy.contains('button', 'Hide AI text').should('not.exist');
  });

  it('refuses a replacement after the scene changes', () => {
    selectAlpha();
    cy.get('.tiptap[contenteditable="true"]').type('{end} changed');
    cy.contains('button', 'Confirm action').click();
    cy.contains('[role="alert"]', 'The scene or selected text changed').should('be.visible');
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'Alpha content').and('not.contain.text', 'Revised opening');
  });

  it('makes confirmation reachable after closing the narrow context drawer', () => {
    cy.viewport(800, 900);
    cy.reload();
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'Alpha content');
    selectAlpha();
    cy.contains('button', 'Confirm action').should('be.visible').click();
    cy.get('.tiptap[contenteditable="true"]').should('have.text', 'Revised opening content');
  });

  it('previews an append when there is no selected passage', () => {
    cy.contains('button', 'Context').click();
    cy.contains('button', /^AI$/).click();
    cy.contains('button', 'Preview scene revision').click();
    cy.contains('strong', 'Append to the current scene').should('be.visible');
    cy.get('.tiptap[contenteditable="true"]').should('have.text', 'Alpha content');
    cy.contains('button', 'Confirm action').click();
    cy.get('.tiptap[contenteditable="true"] p').last().should('have.text', 'Revised opening');
  });
});
