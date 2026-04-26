const TOOL_NAMES = {
  litrpg: 'LitRPG Focus Tool',
  game: 'Game Balance Tool',
  general: 'General Clarity Tool'
} as const;

const DB_NAME = 'worldbuilding-db';
const DB_VERSION = 18;

function mutateSmokeDb(
  mutator: (db: IDBDatabase) => void | Promise<void>
): Cypress.Chainable<void> {
  return cy.window().then(
    (win) =>
      new Cypress.Promise<void>((resolve, reject) => {
        const openRequest = win.indexedDB.open(DB_NAME, DB_VERSION);
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = async () => {
          const db = openRequest.result;
          try {
            await mutator(db);
            resolve();
          } catch (error) {
            reject(error);
          } finally {
            db.close();
          }
        };
      })
  );
}

function putRecord<T extends {id: string}>(
  db: IDBDatabase,
  storeName: string,
  record: T
): Promise<void> {
  return new Cypress.Promise<void>((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function getRecord<T>(db: IDBDatabase, storeName: string, id: string): Promise<T> {
  return new Cypress.Promise<T>((resolve, reject) => {
    const tx = db.transaction([storeName], 'readonly');
    const request = tx.objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });
}

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
  cy.contains('summary', 'Project Mode')
    .closest('details')
    .within(() => {
      // Settings route uses mode values, while labels are "LitRPG Author", etc.
      cy.get('select').first().select(modeValue);
    });
}

function openAssistantAndAssertSelectedTool(
  selectedToolName: string
): void {
  cy.window().then((win) => {
    win.localStorage.setItem(
      'workspaceDrawers:cypress-project-1',
      JSON.stringify({
        leftDrawerOpen: false,
        rightDrawerOpen: true,
        activeContextView: 'ai'
      })
    );
  });
  cy.reload();
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

function ensureSettingsSectionOpen(sectionTitle: string): void {
  cy.contains('summary', sectionTitle)
    .closest('details')
    .then(($details) => {
      if (!$details.attr('open')) {
        cy.wrap($details).find('summary').click();
      }
    });
}

function openScenesDrawer(): void {
  cy.contains('button', /^Scenes$/).first().click();
}

describe('Post-merge smoke checklist', () => {
  beforeEach(() => {
    cy.viewport(1400, 1000);
    cy.visit('/');
    cy.seedSmokeProjectData();
    cy.reload();
    cy.contains('strong', 'Cypress Smoke Project').should('be.visible');
  });

  it('exports markdown with selected scenes in chosen order', () => {
    cy.visit('/workspace');
    openScenesDrawer();

    // Capture the blob that the app prepares for download.
    cy.window().then((win) => {
      cy.stub(win.URL, 'createObjectURL')
        .callsFake((blob: Blob) => {
          (win as any).__lastExportBlob = blob;
          return 'blob:cypress-markdown-export';
        })
        .as('createObjectURL');
    });

    cy.contains('button', 'Export MD').click({force: true});

    cy.contains('[role="dialog"] h3', 'Export scenes as Markdown')
      .closest('[role="dialog"]')
      .within(() => {
      cy.contains('li', 'Beta Scene').find('label').first().click();
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
    openScenesDrawer();

    cy.window().then((win) => {
      cy.stub(win.URL, 'createObjectURL')
        .callsFake((blob: Blob) => {
          (win as any).__lastDocxBlob = blob;
          return 'blob:cypress-docx-export';
        })
        .as('createObjectURL');
    });

    cy.contains('button', 'Export DOCX').click({force: true});
    cy.contains('[role="dialog"] h3', 'Export scenes as DOCX')
      .closest('[role="dialog"]')
      .within(() => {
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

  it('exports epub as a valid ebook-shaped zip payload', () => {
    cy.visit('/workspace');
    openScenesDrawer();

    cy.window().then((win) => {
      cy.stub(win.URL, 'createObjectURL')
        .callsFake((blob: Blob) => {
          (win as any).__lastEpubBlob = blob;
          return 'blob:cypress-epub-export';
        })
        .as('createObjectURL');
    });

    cy.contains('button', 'Export EPUB').click({force: true});
    cy.contains('[role="dialog"] h3', 'Export scenes as EPUB')
      .closest('[role="dialog"]')
      .within(() => {
        cy.contains('button', 'Export').click();
      });

    cy.contains('[role="status"]', 'Exported 3 scene(s) to EPUB.').should('be.visible');
    cy.get('@createObjectURL').should('have.been.calledOnce');

    cy.window().then(async (win) => {
      const epubBlob = (win as any).__lastEpubBlob as Blob;
      const bytes = new Uint8Array(await epubBlob.arrayBuffer());
      const zipText = new TextDecoder().decode(bytes);

      expect(epubBlob.size).to.be.greaterThan(500);
      expect(bytes[0]).to.equal(0x50);
      expect(bytes[1]).to.equal(0x4b);
      expect(zipText).to.contain('application/epub+zip');
      expect(zipText).to.contain('META-INF/container.xml');
      expect(zipText).to.contain('OEBPS/content.opf');
      expect(zipText).to.contain('OEBPS/nav.xhtml');
      expect(zipText).to.contain('OEBPS/text/001-alpha-scene.xhtml');
      expect(zipText).to.contain('OEBPS/text/002-beta-scene.xhtml');
      expect(zipText).to.contain('OEBPS/text/003-gamma-scene.xhtml');
      expect(zipText).to.contain('1. Alpha Scene');
      expect(zipText).to.contain('2. Beta Scene');
      expect(zipText).to.contain('3. Gamma Scene');
    });
  });

  it('keeps mode defaults isolated and applies them in the assistant', () => {
    cy.visit('/settings');
    ensureSettingsSectionOpen('AI Settings');
    ensureSettingsSectionOpen('Project Mode');

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
    cy.reload();
    openAssistantAndAssertSelectedTool(TOOL_NAMES.litrpg);

    cy.visit('/settings');
    setProjectMode('game');
    cy.visit('/workspace');
    cy.reload();
    openAssistantAndAssertSelectedTool(TOOL_NAMES.game);

    cy.visit('/settings');
    setProjectMode('general');
    cy.visit('/workspace');
    cy.reload();
    openAssistantAndAssertSelectedTool(TOOL_NAMES.general);
  });

  it('runs ollama diagnostics and applies a detected local model', () => {
    cy.visit('/settings');
    ensureSettingsSectionOpen('AI Settings');

    cy.window().then((win) => {
      const originalFetch = win.fetch.bind(win);
      cy.stub(win, 'fetch')
        .callsFake((input: RequestInfo | URL, init?: RequestInit) => {
          const url =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.toString()
                : input.url;
          if (url.includes('/api/tags')) {
            return Promise.resolve(
              new win.Response(
                JSON.stringify({
                  models: [{name: 'llama3.2:latest'}, {name: 'mistral:latest'}]
                }),
                {
                  status: 200,
                  headers: {'Content-Type': 'application/json'}
                }
              )
            );
          }
          return originalFetch(input, init);
        })
        .as('fetchStub');
    });

    cy.contains('label', 'Active Provider').parent().find('select').select('Ollama (Local)');
    cy.contains('label', 'Default Model').parent().find('input').clear();
    cy.contains('button', 'Run Provider Diagnostics').click();

    cy.contains('strong', 'Ollama diagnostics passed.').should('be.visible');
    cy.contains('Connected to http://localhost:11434.').should('be.visible');
    cy.contains('Detected 2 installed model(s).').should('be.visible');
    cy.contains('No explicit model configured. Runtime will auto-detect "llama3.2:latest".').should(
      'be.visible'
    );

    cy.contains('button', 'Use llama3.2:latest').click();
    cy.contains('label', 'Default Model').parent().find('input').should('have.value', 'llama3.2:latest');
  });

  it('exports, validates, and imports a project backup with count check success', () => {
    const scratchpadNote = [
      'Loose planning note: Kaelor should discover the Ember Archive map fragment here.',
      '',
      '- Revisit opening tension',
      '- Confirm Glass Harbor timeline'
    ].join('\n');

    cy.visit('/workspace');
    cy.contains('button', /^Scratchpad$/).first().click();
    cy.get('textarea[aria-label="Project scratchpad"]').clear().type(scratchpadNote);
    cy.contains('[role="status"]', 'Scratchpad saved').should('be.visible');
    cy.contains('button', 'Done').click();

    cy.visit('/projects');

    cy.window().then((win) => {
      cy.stub(win.URL, 'createObjectURL')
        .callsFake((blob: Blob) => {
          (win as any).__lastBackupBlob = blob;
          return 'blob:cypress-backup-export';
        })
        .as('createBackupObjectURL');
    });

    cy.get('li')
      .filter(':contains("Cypress Smoke Project")')
      .first()
      .within(() => {
      cy.contains('button', 'Export Backup (.zip)').click();
    });

    cy.contains('[role="status"]', 'Backup exported for "Cypress Smoke Project".').should(
      'be.visible'
    );
    cy.get('@createBackupObjectURL').should('have.been.calledOnce');

    cy.window().then(async (win) => {
      const backupBlob = (win as any).__lastBackupBlob as Blob;
      const backupBuffer = Cypress.Buffer.from(await backupBlob.arrayBuffer());
      const backupFile = {
        contents: backupBuffer,
        fileName: 'cypress-smoke-backup.zip',
        mimeType: 'application/zip',
        lastModified: Date.now()
      };

      cy.contains('button', 'Validate Backup (.zip)')
        .next('input[type="file"]')
        .selectFile(backupFile, {force: true});
      cy.contains('[role="status"]', 'passed integrity checks').should('be.visible');

      cy.contains('button', 'Import Backup (.zip)')
        .next('input[type="file"]')
        .selectFile(backupFile, {force: true});
    });

    cy.contains('h2', 'Backup Import Preview').should('be.visible');
    cy.contains('button', 'Apply Import').click();
    cy.contains('[role="status"]', 'Count check passed.').should('be.visible');
    cy.contains('strong', 'Cypress Smoke Project (Imported)').should('be.visible');

    cy.visit('/workspace');
    cy.contains('button', /^Scratchpad$/).first().click();
    cy.get('textarea[aria-label="Project scratchpad"]').should('have.value', scratchpadNote);
  });

  it('blocks world bible JSON import on duplicate-name conflicts until a resolution is chosen', () => {
    cy.visit('/world-bible');

    cy.get('input[type="text"]').first().clear().type('Conflict Entry');
    cy.contains('label', 'Description').find('textarea').first().clear().type('Original description');
    cy.contains('button', 'Create Entry').click();
    cy.contains('[role="status"]', 'Entry created.').should('be.visible');

    const jsonPayload = JSON.stringify({
      entries: [
        {
          name: 'Conflict Entry',
          description: 'Imported replacement description'
        }
      ]
    });

    cy.get('input[type="file"][accept*="application/json"]').first().selectFile(
      {
        contents: Cypress.Buffer.from(jsonPayload),
        fileName: 'world-bible-conflict.json',
        mimeType: 'application/json'
      },
      {force: true}
    );

    cy.contains('h2', 'JSON Import Mapping').should('be.visible');
    cy.contains('button', 'Apply JSON Import').click();
    cy.contains('[role="status"]', 'Review 1 conflicting JSON row(s) before importing.').should(
      'be.visible'
    );

    cy.contains('li', 'Conflict Entry').within(() => {
      cy.contains('Conflict resolution')
        .parent()
        .find('select')
        .select('Update by Name');
    });

    cy.contains('button', 'Apply JSON Import').click();
    cy.contains('[role="status"]', 'JSON import created 0 entries and updated 1.').should(
      'be.visible'
    );
    cy.contains('Conflict Entry').should('be.visible');
    cy.contains('strong', 'description:').parent().should(
      'contain.text',
      'Imported replacement description'
    );
  });

  it('round-trips tool pack with replace and append without breaking defaults', () => {
    cy.visit('/settings');
    ensureSettingsSectionOpen('AI Settings');

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
    ensureSettingsSectionOpen('Project Mode');
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
    ensureSettingsSectionOpen('Project Mode');
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

    cy.get('.tiptap-editor').should('contain.text', 'Stat Block: Aria · Compact');
    cy.get('.tiptap-editor').should('not.contain.text', '{{STAT_BLOCK:character:Aria:compact}}');

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

  it('rebinds an ambiguous legacy stat block token in place', () => {
    cy.visit('/workspace');

    mutateSmokeDb(async (db) => {
      const alphaScene = await getRecord<{
        id: string;
        projectId: string;
        title: string;
        content: string;
        createdAt: number;
        updatedAt: number;
      }>(db, 'writingDocuments', 'scene-alpha');
      await putRecord(db, 'writingDocuments', {
        ...alphaScene,
        content: '<p>{{STAT_BLOCK:character:Aria:compact}}</p>',
        updatedAt: Date.now()
      });

      await putRecord(db, 'character_sheets', {
        id: 'sheet-aria-2',
        projectId: 'cypress-project-1',
        name: 'Aria',
        level: 7,
        experience: 4100,
        stats: [
          {definitionId: 'strength', value: 18},
          {definitionId: 'agility', value: 16}
        ],
        resources: [{definitionId: 'hp', current: 55, max: 60}],
        inventory: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    });

    cy.reload();

    cy.get('.tiptap-editor .stat-block-token-chip--ambiguous')
      .should('contain.text', 'Needs rebind')
      .click();
    cy.contains('button', 'Rebind Token').click();

    cy.get('[aria-label="Status Block Builder"]').within(() => {
      cy.contains('h3', 'Rebind Status Block').should('be.visible');
      cy.get('#stat-block-character').select('sheet-aria-2');
      cy.contains('button', 'Rebind token').click();
    });

    cy.contains('[role="status"]', 'Rebound stat block placeholder.').should('be.visible');
    cy.get('.tiptap-editor .stat-block-token-chip--ambiguous').should('not.exist');
    cy.get('.tiptap-editor [data-stat-block-token]')
      .should('have.attr', 'data-stat-block-token')
      .and('include', 'sheet-aria-2');
  });

  it('rebinds a missing stat block token in place', () => {
    cy.visit('/workspace');

    mutateSmokeDb(async (db) => {
      const alphaScene = await getRecord<{
        id: string;
        projectId: string;
        title: string;
        content: string;
        createdAt: number;
        updatedAt: number;
      }>(db, 'writingDocuments', 'scene-alpha');
      await putRecord(db, 'writingDocuments', {
        ...alphaScene,
        content: '<p>{{STAT_BLOCK:item:missing-entity:compact:l=Ghost%20Sword}}</p>',
        updatedAt: Date.now()
      });
    });

    cy.reload();

    cy.get('.tiptap-editor .stat-block-token-chip--missing')
      .should('contain.text', 'Missing source')
      .click();
    cy.contains('button', 'Rebind Token').click();

    cy.get('[aria-label="Status Block Builder"]').within(() => {
      cy.contains('h3', 'Rebind Status Block').should('be.visible');
      cy.get('#stat-block-source-type').should('have.value', 'item');
      cy.get('#stat-block-entity').select('entity-sword-1');
      cy.contains('button', 'Rebind token').click();
    });

    cy.contains('[role="status"]', 'Rebound stat block placeholder.').should('be.visible');
    cy.get('.tiptap-editor .stat-block-token-chip--missing').should('not.exist');
    cy.get('.tiptap-editor [data-stat-block-token]')
      .should('have.attr', 'data-stat-block-token')
      .and('include', 'entity-sword-1');
  });
});
