// Per-project AI switches (Slice 5.18): one smoke per switch combination.
describe('Per-project AI switches', () => {
  function open(switches: {coaching: boolean; prose: boolean}) {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.setSeededAISwitches(switches);
    cy.reload();
    cy.visit('/workspace');
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'Alpha content');
    cy.window().then((win) => {
      win.sessionStorage.setItem('wbd:assistant-conversation:cypress-project-1', JSON.stringify([
        {role: 'assistant', content: 'Revised opening'}
      ]));
    });
  }

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

  function openContextTabs() {
    cy.contains('button', 'Context').click();
    cy.contains('button', 'Scene').should('be.visible');
  }

  it('with both off, hides every AI entry and collapses AI Settings', () => {
    open({coaching: false, prose: false});
    rightClickFirstWord();
    cy.contains('button', 'Ask AI about this').should('not.exist');
    openContextTabs();
    cy.contains('button', /^AI$/).should('not.exist');

    cy.visit('/ask');
    cy.contains('AI coaching is off for this project').should('be.visible');
    cy.get('textarea').should('not.exist');

    cy.visit('/settings');
    cy.ensureSettingsSectionOpen('AI Settings');
    cy.contains('label', 'AI coaching').find('input').should('not.be.checked');
    cy.contains('label', 'AI prose').find('input').should('not.be.checked');
    cy.contains('AI is off for this project').should('be.visible');
    cy.contains('label', 'Provider').should('not.exist');
    cy.contains('Enable AI consultation actions').should('not.exist');
  });

  it('with coaching only, offers chat and the writing coach but no scene revision', () => {
    open({coaching: true, prose: false});
    rightClickFirstWord();
    cy.contains('button', 'Ask AI about this').click();
    cy.contains('button', 'Ask the writing coach').should('be.visible');
    cy.contains('button', 'Send').should('be.visible');
    cy.contains('button', 'Preview scene revision').should('not.exist');

    cy.visit('/ask');
    cy.contains('AI coaching is off for this project').should('not.exist');
    cy.get('textarea').should('be.visible');
  });

  it('with prose only, offers a reviewed scene revision and no coaching', () => {
    open({coaching: false, prose: true});
    rightClickFirstWord();
    cy.contains('button', 'Ask AI about this').click();
    cy.contains('button', 'Ask the writing coach').should('not.exist');
    cy.contains('button', 'Save as Source Note').should('not.exist');
    cy.get('textarea[placeholder="Describe the revision you want, then preview it."]').should('be.visible');
    cy.contains('button', 'Preview scene revision').click();
    cy.contains('strong', 'Replace selected scene text').should('be.visible');

    cy.visit('/ask');
    cy.contains('AI coaching is off for this project').should('be.visible');
  });

  it('with both on, offers coaching and prose together, and turning one off hides it', () => {
    open({coaching: true, prose: true});
    rightClickFirstWord();
    cy.contains('button', 'Ask AI about this').click();
    cy.contains('button', 'Ask the writing coach').should('be.visible');
    cy.contains('button', 'Preview scene revision').should('be.visible');

    cy.visit('/settings');
    cy.ensureSettingsSectionOpen('AI Settings');
    cy.contains('label', 'AI prose').find('input').uncheck();
    cy.visit('/workspace');
    cy.get('.tiptap[contenteditable="true"]').should('contain.text', 'Alpha content');
    rightClickFirstWord();
    cy.contains('button', 'Ask AI about this').click();
    cy.contains('button', 'Ask the writing coach').should('be.visible');
    cy.contains('button', 'Preview scene revision').should('not.exist');
  });
});
