// Custom AI actions in the selection menu (Slice 5.19).
const ANTHROPIC_STREAM = 'http://localhost:3001/api/anthropic/stream';

const anthropicReply = (text: string) => ({
  statusCode: 200,
  headers: {'content-type': 'text/event-stream'},
  body: [
    `data: ${JSON.stringify({type: 'content_block_delta', delta: {type: 'text_delta', text}})}`,
    'data: [DONE]',
    ''
  ].join('\n\n')
});

const action = (id: string, name: string, output: 'replace' | 'note', enabled = true) => ({
  id,
  name,
  instructions: `${name} instructions.`,
  includeScene: false,
  includeWorldBible: false,
  output,
  enabled
});

describe('Custom AI actions', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.setSeededSelectionActions([
      action('tighten', 'Tighten', 'replace'),
      action('canon', 'Check against canon', 'note'),
      action('off', 'Switched off', 'replace', false)
    ]);
    cy.window().then((win) => win.localStorage.setItem('anthropic_api_key', 'cypress-test-key'));
    cy.reload();
    cy.visit('/workspace');
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'Alpha content');
  });

  /** Selects "Alpha" and right-clicks it to open the selection menu. */
  function rightClickFirstWord() {
    cy.get('.tiptap[contenteditable="true"]').click();
    cy.get('.tiptap[contenteditable="true"] p').first().then(($paragraph) => {
      const doc = $paragraph[0].ownerDocument;
      const range = doc.createRange();
      range.setStart($paragraph[0].firstChild as Text, 0);
      range.setEnd($paragraph[0].firstChild as Text, 5);
      const selection = doc.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      doc.dispatchEvent(new Event('selectionchange'));
    });
    cy.get('.tiptap[contenteditable="true"] p').first().trigger('contextmenu');
  }

  it('lists only switched-on actions, and a rewrite changes the scene only on Confirm', () => {
    cy.intercept('POST', ANTHROPIC_STREAM, anthropicReply('Omega')).as('actionRequest');
    rightClickFirstWord();
    cy.contains('button', 'Ask AI about this').should('be.visible');
    cy.contains('button', 'Switched off').should('not.exist');
    cy.contains('button', 'Tighten').click();
    cy.wait('@actionRequest').then(({request}) => {
      const body = JSON.stringify(request.body);
      expect(body).to.contain('Tighten instructions.');
      expect(body).to.contain('Alpha');
      expect(body).not.to.contain('Beta content');
    });
    cy.contains('strong', 'Replace selected scene text').should('be.visible');
    cy.get('.tiptap[contenteditable="true"]').should('have.text', 'Alpha content');

    cy.contains('button', 'Dismiss').click();
    cy.get('.tiptap[contenteditable="true"]').should('have.text', 'Alpha content');

    rightClickFirstWord();
    cy.contains('button', 'Tighten').click();
    cy.contains('button', 'Confirm action').click();
    cy.get('.tiptap[contenteditable="true"]').should('have.text', 'Omega content');
    cy.get('.tiptap [data-ai-text="ai-action"]').should('have.text', 'Omega');
  });

  it('opens a note in the reading view and never edits the scene', () => {
    cy.intercept('POST', ANTHROPIC_STREAM, anthropicReply('Nothing here contradicts accepted facts.'));
    rightClickFirstWord();
    cy.contains('button', 'Check against canon').click();
    cy.get('[role="dialog"][aria-labelledby="assistant-reply-reader-title"]')
      .should('contain.text', 'Nothing here contradicts accepted facts.');
    cy.get('.tiptap[contenteditable="true"]').should('have.text', 'Alpha content');
    cy.contains('strong', 'Replace selected scene text').should('not.exist');
  });

  it('hides rewrites when AI prose is off and notes when AI coaching is off', () => {
    cy.setSeededAISwitches({coaching: true, prose: false});
    cy.reload();
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'Alpha content');
    rightClickFirstWord();
    cy.contains('button', 'Check against canon').should('be.visible');
    cy.contains('button', 'Tighten').should('not.exist');

    cy.setSeededAISwitches({coaching: false, prose: true});
    cy.reload();
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'Alpha content');
    rightClickFirstWord();
    cy.contains('button', 'Tighten').should('be.visible');
    cy.contains('button', 'Check against canon').should('not.exist');
  });
});
