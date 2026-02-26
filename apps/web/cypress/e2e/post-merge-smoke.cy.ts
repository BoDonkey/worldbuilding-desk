const TOOL_NAMES = {
  litrpg: 'LitRPG Focus Tool',
  game: 'Game Balance Tool',
  general: 'General Clarity Tool'
} as const;

function addPromptTool(name: string, instructions: string): void {
  // Use placeholders instead of label nesting to avoid DOM-structure brittleness.
  cy.get('input[placeholder="e.g., Literary Critic Persona"]').first().clear().type(name);
  cy.get('textarea[placeholder*="Describe the voice"]').first().clear().type(instructions);
  cy.contains('button', 'Add Prompt Tool').click();
  cy.contains('strong', name).should('be.visible');
}

function selectDefaultsMode(modeLabel: 'LitRPG' | 'Game' | 'General'): void {
  cy.contains('label', 'Configure Default Active tools for mode')
    .find('select')
    .select(modeLabel);
}

function setDefaultActiveForTool(
  _modeLabel: 'LitRPG' | 'Game' | 'General',
  toolName: string,
  enabled: boolean
): void {
  cy.contains('li', toolName).within(() => {
    // Each tool row renders two checkboxes in order: Enabled, then Default Active.
    const checkbox = cy.get('input[type="checkbox"]').eq(1);

    if (enabled) {
      checkbox.check({force: true});
    } else {
      checkbox.uncheck({force: true});
    }
  });
}

function assertDefaultActiveForTool(
  _modeLabel: 'LitRPG' | 'Game' | 'General',
  toolName: string,
  expectedChecked: boolean
): void {
  cy.contains('li', toolName).within(() => {
    const assertion = expectedChecked ? 'be.checked' : 'not.be.checked';
    cy.get('input[type="checkbox"]').eq(1).should(assertion);
  });
}

function setProjectMode(modeValue: 'litrpg' | 'game' | 'general'): void {
  cy.contains('h2', 'Project Mode')
    .closest('div')
    .within(() => {
      // Settings route uses mode values, while labels are "LitRPG Author", etc.
      cy.get('select').first().select(modeValue);
    });
}

function openAssistantAndAssertSelectedTool(
  selectedToolName: string
): void {
  cy.contains('button', 'AI Assistant').click();
  cy.contains('div', 'Prompt Tools').should('be.visible');

  // We verify one selected tool per mode to confirm project-mode defaults apply.
  cy.contains('label', TOOL_NAMES.litrpg)
    .find('input')
    .should(
      selectedToolName === TOOL_NAMES.litrpg ? 'be.checked' : 'not.be.checked'
    );
  cy.contains('label', TOOL_NAMES.game)
    .find('input')
    .should(
      selectedToolName === TOOL_NAMES.game ? 'be.checked' : 'not.be.checked'
    );
  cy.contains('label', TOOL_NAMES.general)
    .find('input')
    .should(
      selectedToolName === TOOL_NAMES.general ? 'be.checked' : 'not.be.checked'
    );
}

describe('Post-merge smoke checklist', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('exports markdown with selected scenes in chosen order', () => {
    cy.visit('/workspace');

    // Capture the blob that the app prepares for download.
    cy.window().then((win) => {
      cy.stub(win.URL, 'createObjectURL')
        .callsFake((blob: Blob) => {
          (win as any).__lastExportBlob = blob;
          return 'blob:cypress-markdown-export';
        })
        .as('createObjectURL');
    });

    cy.contains('button', 'Export MD').click();

    cy.get('[role="dialog"]').within(() => {
      cy.contains('li', 'Beta Scene').find('input[type="checkbox"]').first().uncheck();
      // Re-query after each move so we do not keep stale row references.
      cy.contains('li', '3. Gamma Scene').contains('button', 'Up').click();
      cy.contains('li', '2. Gamma Scene').contains('button', 'Up').click();
      cy.contains('button', 'Export').click();
    });

    cy.contains('[role="status"]', 'Exported 2 scene(s) to Markdown.').should('be.visible');
    cy.get('@createObjectURL').should('have.been.calledOnce');

    cy.window().then(async (win) => {
      const markdownBlob = (win as any).__lastExportBlob as Blob;
      const markdown = await markdownBlob.text();

      expect(markdown).to.contain('## 1. Gamma Scene');
      expect(markdown).to.contain('## 2. Alpha Scene');
      expect(markdown).not.to.contain('Beta Scene');
      expect(markdown.indexOf('## 1. Gamma Scene')).to.be.lessThan(
        markdown.indexOf('## 2. Alpha Scene')
      );
    });
  });

  it('exports docx as a non-empty zip payload', () => {
    cy.visit('/workspace');

    cy.window().then((win) => {
      cy.stub(win.URL, 'createObjectURL')
        .callsFake((blob: Blob) => {
          (win as any).__lastDocxBlob = blob;
          return 'blob:cypress-docx-export';
        })
        .as('createObjectURL');
    });

    cy.contains('button', 'Export DOCX').click();
    cy.get('[role="dialog"]').within(() => {
      cy.contains('button', 'Export').click();
    });

    cy.contains('[role="status"]', 'Exported 3 scene(s) to DOCX.').should('be.visible');
    cy.get('@createObjectURL').should('have.been.calledOnce');

    cy.window().then(async (win) => {
      const docxBlob = (win as any).__lastDocxBlob as Blob;
      const bytes = new Uint8Array(await docxBlob.arrayBuffer());
      const zipText = new TextDecoder().decode(bytes);

      expect(docxBlob.size).to.be.greaterThan(300);
      expect(bytes[0]).to.equal(0x50);
      expect(bytes[1]).to.equal(0x4b);
      expect(zipText).to.contain('word/document.xml');
    });
  });

  it('keeps mode defaults isolated and applies them in the assistant', () => {
    cy.visit('/settings');

    addPromptTool(TOOL_NAMES.litrpg, 'Prioritize LitRPG progression, stats, and systems coherence.');
    addPromptTool(TOOL_NAMES.game, 'Prioritize gameplay loops, balance pressure, and tuning clarity.');
    addPromptTool(TOOL_NAMES.general, 'Prioritize general readability, flow, and sentence-level clarity.');

    selectDefaultsMode('LitRPG');
    setDefaultActiveForTool('LitRPG', TOOL_NAMES.litrpg, true);
    setDefaultActiveForTool('LitRPG', TOOL_NAMES.game, false);
    setDefaultActiveForTool('LitRPG', TOOL_NAMES.general, false);

    selectDefaultsMode('Game');
    setDefaultActiveForTool('Game', TOOL_NAMES.litrpg, false);
    setDefaultActiveForTool('Game', TOOL_NAMES.game, true);
    setDefaultActiveForTool('Game', TOOL_NAMES.general, false);

    selectDefaultsMode('General');
    setDefaultActiveForTool('General', TOOL_NAMES.litrpg, false);
    setDefaultActiveForTool('General', TOOL_NAMES.game, false);
    setDefaultActiveForTool('General', TOOL_NAMES.general, true);

    // Re-read each mode to prove defaults persist across selector changes.
    selectDefaultsMode('LitRPG');
    assertDefaultActiveForTool('LitRPG', TOOL_NAMES.litrpg, true);
    assertDefaultActiveForTool('LitRPG', TOOL_NAMES.game, false);
    assertDefaultActiveForTool('LitRPG', TOOL_NAMES.general, false);

    selectDefaultsMode('Game');
    assertDefaultActiveForTool('Game', TOOL_NAMES.litrpg, false);
    assertDefaultActiveForTool('Game', TOOL_NAMES.game, true);
    assertDefaultActiveForTool('Game', TOOL_NAMES.general, false);

    selectDefaultsMode('General');
    assertDefaultActiveForTool('General', TOOL_NAMES.litrpg, false);
    assertDefaultActiveForTool('General', TOOL_NAMES.game, false);
    assertDefaultActiveForTool('General', TOOL_NAMES.general, true);

    setProjectMode('litrpg');
    cy.visit('/workspace');
    openAssistantAndAssertSelectedTool(TOOL_NAMES.litrpg);

    cy.visit('/settings');
    setProjectMode('game');
    cy.visit('/workspace');
    openAssistantAndAssertSelectedTool(TOOL_NAMES.game);

    cy.visit('/settings');
    setProjectMode('general');
    cy.visit('/workspace');
    openAssistantAndAssertSelectedTool(TOOL_NAMES.general);
  });

  it('round-trips tool pack with replace and append without breaking defaults', () => {
    cy.visit('/settings');

    addPromptTool(TOOL_NAMES.litrpg, 'LitRPG default tool');
    addPromptTool(TOOL_NAMES.game, 'Game default tool');
    addPromptTool(TOOL_NAMES.general, 'General default tool');

    selectDefaultsMode('LitRPG');
    setDefaultActiveForTool('LitRPG', TOOL_NAMES.litrpg, true);
    setDefaultActiveForTool('LitRPG', TOOL_NAMES.game, false);
    setDefaultActiveForTool('LitRPG', TOOL_NAMES.general, false);

    selectDefaultsMode('Game');
    setDefaultActiveForTool('Game', TOOL_NAMES.litrpg, false);
    setDefaultActiveForTool('Game', TOOL_NAMES.game, true);
    setDefaultActiveForTool('Game', TOOL_NAMES.general, false);

    selectDefaultsMode('General');
    setDefaultActiveForTool('General', TOOL_NAMES.litrpg, false);
    setDefaultActiveForTool('General', TOOL_NAMES.game, false);
    setDefaultActiveForTool('General', TOOL_NAMES.general, true);

    cy.window().then((win) => {
      cy.stub(win.URL, 'createObjectURL')
        .callsFake((blob: Blob) => {
          (win as any).__lastToolPackBlob = blob;
          return 'blob:cypress-tool-pack';
        })
        .as('createObjectURL');
      cy.stub(win, 'confirm')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false)
        .as('confirmStub');
    });

    cy.contains('button', 'Export Tool Pack').click();
    cy.get('@createObjectURL').should('have.been.calledOnce');

    cy.window().then(async (win) => {
      const toolPackJson = await ((win as any).__lastToolPackBlob as Blob).text();
      cy.wrap(toolPackJson).as('toolPackJson');
    });

    cy.get('@toolPackJson').then((toolPackJson) => {
      const file = {
        contents: Cypress.Buffer.from(toolPackJson as string),
        fileName: 'prompt-tools-pack.json',
        mimeType: 'application/json'
      };

      cy.get('input[type="file"][accept*="application/json"]').first().selectFile(file, {
        force: true
      });

      cy.get('@confirmStub').should('have.been.calledOnce');

      // Defaults should still map one-to-one by mode after replace.
      selectDefaultsMode('LitRPG');
      assertDefaultActiveForTool('LitRPG', TOOL_NAMES.litrpg, true);
      selectDefaultsMode('Game');
      assertDefaultActiveForTool('Game', TOOL_NAMES.game, true);
      selectDefaultsMode('General');
      assertDefaultActiveForTool('General', TOOL_NAMES.general, true);

      cy.get('input[type="file"][accept*="application/json"]').first().selectFile(file, {
        force: true
      });
    });

    cy.get('@confirmStub').should('have.been.calledTwice');

    // Append intentionally duplicates tools by name with new IDs. We only assert this does not break defaults.
    cy.get('strong').then(($strongNodes) => {
      const litRpgNameCount = [...$strongNodes].filter(
        (node) => node.textContent?.trim() === TOOL_NAMES.litrpg
      ).length;
      expect(litRpgNameCount).to.be.greaterThan(1);
    });

    selectDefaultsMode('LitRPG');
    assertDefaultActiveForTool('LitRPG', TOOL_NAMES.litrpg, true);
    selectDefaultsMode('Game');
    assertDefaultActiveForTool('Game', TOOL_NAMES.game, true);
    selectDefaultsMode('General');
    assertDefaultActiveForTool('General', TOOL_NAMES.general, true);
  });

  it('inserts rendered character status blocks into the scene editor', () => {
    cy.visit('/settings');
    setProjectMode('general');
    cy.visit('/workspace');

    cy.contains('button', 'Insert Status Block').click();
    cy.get('[aria-label="Status Block Builder"]')
      .within(() => {
        cy.get('select').eq(0).select('Character');
        cy.get('select').eq(1).select('Aria');
        cy.get('select').eq(2).select('All stats');
        cy.get('select').eq(3).select('Live block now');
        cy.contains('button', 'Insert').click();
      });

    cy.contains('[role="status"]', 'Inserted status block into scene.').should(
      'be.visible'
    );
    cy.get('.tiptap-editor').should('contain.text', '[Character Status');
    cy.get('.tiptap-editor').should('contain.text', 'Aria');
    cy.get('.tiptap-editor').should('contain.text', 'Level 5');
  });

  it('inserts template tokens and refreshes them into live stat blocks', () => {
    cy.visit('/settings');
    setProjectMode('general');
    cy.visit('/workspace');

    cy.contains('button', 'Insert Status Block').click();
    cy.get('[aria-label="Status Block Builder"]')
      .within(() => {
        cy.get('select').eq(0).select('Character');
        cy.get('select').eq(1).select('Aria');
        cy.get('select').eq(2).select('Compact');
        cy.get('select').eq(3).select('Reusable placeholder');
        cy.contains('button', 'Insert').click();
      });

    cy.get('.tiptap-editor').should(
      'contain.text',
      '{{STAT_BLOCK:character:Aria:compact}}'
    );

    cy.contains('button', 'Refresh Placeholders').click();

    cy.contains('[role="status"]', 'Refreshed 1 stat block template(s).').should(
      'be.visible'
    );
    cy.get('.tiptap-editor').should('contain.text', '[Character Status');
    cy.get('.tiptap-editor').should('contain.text', 'Aria');
    cy.get('.tiptap-editor').should(
      'not.contain.text',
      '{{STAT_BLOCK:character:Aria:compact}}'
    );
  });
});
