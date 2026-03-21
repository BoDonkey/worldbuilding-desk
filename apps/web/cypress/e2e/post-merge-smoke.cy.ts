import {buildSingleFileZip} from '../../src/utils/zip';

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

function importWorkspaceFiles(
  files: Array<{contents: Cypress.FileReferenceObject['contents']; fileName: string; mimeType: string}>
): void {
  cy.get('input[type="file"][accept*=".txt"]').first().selectFile(files, {
    force: true
  });
}

function buildDocxFile(text: string): Cypress.FileReferenceObject {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    '<w:body>',
    `  <w:p><w:r><w:t>${text}</w:t></w:r></w:p>`,
    '</w:body>',
    '</w:document>'
  ].join('');

  const bytes = buildSingleFileZip({
    fileName: 'word/document.xml',
    fileData: new TextEncoder().encode(xml)
  });

  return {
    contents: Cypress.Buffer.from(bytes),
    fileName: 'field-report.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
}

function buildPagesWithoutPreviewFile(): Cypress.FileReferenceObject {
  const bytes = buildSingleFileZip({
    fileName: 'Metadata/BuildVersionHistory.plist',
    fileData: new TextEncoder().encode('<plist><dict><key>version</key><string>1</string></dict></plist>')
  });

  return {
    contents: Cypress.Buffer.from(bytes),
    fileName: 'lost-notes.pages',
    mimeType: 'application/zip'
  };
}

describe('Post-merge smoke checklist', () => {
  beforeEach(() => {
    cy.viewport(1400, 900);
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

  it('installs the writing critic persona preset for the selected mode', () => {
    cy.visit('/settings');

    selectDefaultsMode('General');
    setProjectMode('general');
    cy.contains('button', 'Install for General').click();
    cy.contains('strong', 'Writing Critic').should('be.visible');
    cy.contains('li', 'Writing Critic').within(() => {
      cy.get('input[type="checkbox"]').eq(0).should('be.checked');
      cy.get('input[type="checkbox"]').eq(1).should('be.checked');
    });

    cy.visit('/workspace');
    cy.contains('button', 'AI Assistant').click();
    cy.contains('div', 'Prompt Tools').should('be.visible');
    cy.contains('label', 'Writing Critic').find('input').should('be.checked');
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

  it('persists editor appearance choices across reloads', () => {
    cy.visit('/settings');

    cy.contains('h3', 'Editor Appearance')
      .parent()
      .within(() => {
        cy.contains('button', 'Mono').click();
        cy.contains('button', 'Wide').click();
        cy.contains('button', 'Mist').click();
        cy.contains('button', 'Airy').click();
      });

    cy.get('html')
      .should('have.attr', 'data-editor-font', 'mono')
      .and('have.attr', 'data-editor-width', 'wide')
      .and('have.attr', 'data-editor-surface', 'mist')
      .and('have.attr', 'data-editor-line-height', 'airy');

    cy.reload();

    cy.get('html')
      .should('have.attr', 'data-editor-font', 'mono')
      .and('have.attr', 'data-editor-width', 'wide')
      .and('have.attr', 'data-editor-surface', 'mist')
      .and('have.attr', 'data-editor-line-height', 'airy');

    cy.contains('h3', 'Editor Appearance')
      .parent()
      .within(() => {
        cy.contains('button', 'Mono').should('have.attr', 'aria-pressed', 'true');
        cy.contains('button', 'Wide').should('have.attr', 'aria-pressed', 'true');
        cy.contains('button', 'Mist').should('have.attr', 'aria-pressed', 'true');
        cy.contains('button', 'Airy').should('have.attr', 'aria-pressed', 'true');
      });
  });

  it('persists workspace drawer visibility across reloads', () => {
    cy.visit('/workspace');

    cy.contains('button', 'Hide scenes').click();
    cy.contains('button', 'Hide context').click();
    cy.contains('button', 'Show scenes').should('be.visible');
    cy.contains('button', 'Show context').should('be.visible');

    cy.window().then((win) => {
      const raw = win.localStorage.getItem('workspaceDrawers:cypress-project-1');
      expect(raw).to.not.equal(null);
      expect(JSON.parse(raw as string)).to.deep.include({
        leftDrawerOpen: false,
        rightDrawerOpen: false
      });
    });

    cy.reload();

    cy.contains('button', 'Show scenes').should('be.visible');
    cy.contains('button', 'Show context').should('be.visible');
  });

  it('imports text, markdown, and html into deferred review mode', () => {
    cy.visit('/workspace');

    cy.contains('label', 'Import mode').find('select').select('Lenient');

    importWorkspaceFiles([
      {
        contents: Cypress.Buffer.from('Captain Rowan met Xalor beside the storm gate.'),
        fileName: 'storm-log.txt',
        mimeType: 'text/plain'
      },
      {
        contents: Cypress.Buffer.from('# Ritual Notes\nMira cataloged the Ember Sigil.'),
        fileName: 'ritual-notes.md',
        mimeType: 'text/markdown'
      },
      {
        contents: Cypress.Buffer.from(
          '<html><body><h1>Archive Draft</h1><p>Seren entered the glass archive.</p></body></html>'
        ),
        fileName: 'archive-draft.html',
        mimeType: 'text/html'
      }
    ]);

    cy.contains('[role="status"]', 'Imported 3 document(s). Consistency suggestions skipped for this import.')
      .should('be.visible');
    cy.contains('strong', 'Import Summary')
      .parent()
      .should('contain.text', 'Imported 3')
      .and('contain.text', 'Mode lenient');
    cy.contains('li', 'storm-log').should('be.visible');
    cy.contains('li', 'ritual-notes').should('be.visible');
    cy.contains('li', 'archive-draft').should('be.visible');

    cy.contains('strong', 'Review later is active.').should('be.visible');
    cy.contains('button', 'Refresh review').should('be.visible');
    cy.contains('button', 'Resume strict review').click();
    cy.contains('[role="status"]', 'Scene set to strict consistency review.').should(
      'be.visible'
    );
    cy.contains('strong', 'Review later is active.').should('not.exist');
  });

  it('imports docx scene text through the real archive parser', () => {
    cy.visit('/workspace');

    importWorkspaceFiles([buildDocxFile('Marshal Tovin cataloged the ember vault.')]);

    cy.contains('[role="status"]', 'Imported 1 document(s). Unresolved entities:')
      .should('be.visible');
    cy.contains('li', 'field-report').should('be.visible');
    cy.get('.tiptap-editor').should('contain.text', 'Marshal Tovin cataloged the ember vault.');
  });

  it('shows pages fallback guidance when no readable preview is available', () => {
    cy.visit('/workspace');

    importWorkspaceFiles([buildPagesWithoutPreviewFile()]);

    cy.contains(
      '[role="status"]',
      'Imported 0 document(s); 1 failed. For Apple Pages files, export as .docx or .txt from Pages, then import.'
    ).should('be.visible');
    cy.contains('strong', 'Import Summary')
      .parent()
      .should('contain.text', 'Imported 0')
      .and('contain.text', 'Failed 1');
    cy.contains('li', 'lost-notes.pages: No readable text preview found in .pages package.')
      .should('be.visible');
    cy.contains('button', 'Retry failed files only').should('be.visible');
  });

  it('inserts rendered character status blocks into the scene editor', () => {
    cy.visit('/settings');
    setProjectMode('general');
    cy.visit('/workspace');

    cy.contains('button', 'Insert Status Block').click();
    cy.get('[aria-label="Status Block Builder"]')
      .within(() => {
        cy.get('#stat-block-source-type').select('Character');
        cy.get('#stat-block-character').select('Aria');
        cy.get('#stat-block-detail').select('All stats');
        cy.get('#stat-block-insert-as').select('Live block now');
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
        cy.get('#stat-block-source-type').select('Character');
        cy.get('#stat-block-character').select('Aria');
        cy.get('#stat-block-detail').select('Compact');
        cy.get('#stat-block-insert-as').select('Reusable placeholder');
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
