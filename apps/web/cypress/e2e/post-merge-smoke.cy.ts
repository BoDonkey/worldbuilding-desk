const TOOL_NAMES = {
  litrpg: 'LitRPG Focus Tool',
  game: 'Game Balance Tool',
  general: 'General Clarity Tool'
} as const;

import {DB_NAME, DB_VERSION} from '../../src/db';

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

function getAllRecords<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Cypress.Promise<T[]>((resolve, reject) => {
    const tx = db.transaction([storeName], 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
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
  cy.contains('h1', 'Writing Workspace').should('be.visible');
  cy.get('body').type('{ctrl}k');
  cy.get('[role="dialog"][aria-label="Command palette"]').should('be.visible');
  cy.contains('button', 'Workspace: Toggle AI Panel').click();
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

  it('restores project assistant history after navigating away from Workspace', () => {
    cy.visit('/workspace');
    cy.window().then((win) => {
      win.sessionStorage.setItem(
        'wbd:assistant-conversation:cypress-project-1',
        JSON.stringify([
          {role: 'user', content: "What color are Sera's eyes?"},
          {
            role: 'assistant',
            content: "Sera's eyes are gray.",
            contextSources: ['Accepted canon: World Bible record - Sera Kestrel']
          }
        ])
      );
    });
    cy.contains('button', 'Context').click();
    cy.contains('button', /^AI$/).click();
    cy.contains("Sera's eyes are gray.").should('be.visible');

    cy.visit('/world-bible');
    cy.contains('h1', 'World Bible').should('be.visible');
    cy.visit('/workspace');

    cy.contains("What color are Sera's eyes?").should('be.visible');
    cy.contains("Sera's eyes are gray.").should('be.visible');
  });

  it('grounds custody answers in ordered saved scenes instead of retrieval rank', () => {
    const now = Date.now();
    mutateSmokeDb(async (db) => {
      const settings = await getRecord<{
        id: string;
        aiSettings: {
          configs: {anthropic: Record<string, unknown>};
          [key: string]: unknown;
        };
        [key: string]: unknown;
      }>(db, 'projectSettings', 'settings-cypress-project-1');
      await putRecord(db, 'projectSettings', {
        ...settings,
        aiSettings: {
          ...settings.aiSettings,
          configs: {
            ...settings.aiSettings.configs,
            anthropic: {
              ...settings.aiSettings.configs.anthropic,
              apiKey: 'cypress-not-used'
            }
          }
        }
      });
      await putRecord(db, 'writingDocuments', {
        id: 'custody-chapter-three',
        projectId: 'cypress-project-1',
        title: 'Chapter Three — The Weighing House',
        content: 'Odessa tapped the desk. "The Key goes into my deep vault."',
        order: 3,
        createdAt: now + 3,
        updatedAt: now + 3
      });
      await putRecord(db, 'writingDocuments', {
        id: 'custody-chapter-four',
        projectId: 'cypress-project-1',
        title: 'Chapter Four — Sorrowsteel',
        content:
          "Signed out of Odessa's deep vault that morning, the Key had gone back into Brannic's breast pocket after.",
        order: 4,
        createdAt: now + 4,
        updatedAt: now + 4
      });
      await putRecord(db, 'writingDocuments', {
        id: 'custody-chapter-five',
        projectId: 'cypress-project-1',
        title: 'Chapter Five — The Hollow Court',
        content:
          'Sera came down the antechamber slowly.\n\nShe stopped at the gate. She pressed the Emberglass Key into the lock.',
        order: 5,
        createdAt: now + 5,
        updatedAt: now + 5
      });
    });

    cy.visit('/workspace');
    cy.contains('button', 'Context').click();
    cy.contains('button', /^AI$/).click();
    cy.contains('[role="status"]', 'Project context ready.').should('be.visible');
    cy.get('textarea[placeholder^="Ask for help"]')
      .type('Where is the Emberglass Key kept?');
    cy.contains('button', 'Send').click();

    cy.contains(/designated storage.*Odessa's deep vault/i).should('be.visible');
    cy.contains(/Brannic has it in a pocket/i).should('be.visible');
    cy.contains(/Sera uses it/i).should('be.visible');
    cy.contains(/current custody is uncertain/i).should('be.visible');
    cy.contains('summary', 'Sources used').click();
    cy.contains('Scene draft - Chapter Three — The Weighing House').should('be.visible');
    cy.contains('Scene draft - Chapter Four — Sorrowsteel').should('be.visible');
    cy.contains('Scene draft - Chapter Five — The Hollow Court').should('be.visible');
  });

  it('routes character capabilities from World Bible without descriptive editing', () => {
    const now = Date.now();
    mutateSmokeDb(async (db) => {
      const [project, settings] = await Promise.all([
        getRecord<{id: string; [key: string]: unknown}>(db, 'projects', 'cypress-project-1'),
        getRecord<{id: string; [key: string]: unknown}>(
          db,
          'projectSettings',
          'settings-cypress-project-1'
        )
      ]);
      await putRecord(db, 'projects', {...project, rulesetId: 'ruleset-capabilities'});
      await putRecord(db, 'projectSettings', {
        ...settings,
        characterStyles: [
          {
            id: 'style-quiet',
            name: 'Quiet Voice',
            styles: {fontStyle: 'italic'}
          }
        ],
        updatedAt: now
      });
      await putRecord(db, 'entityCategories', {
        id: 'characters', projectId: 'cypress-project-1', kind: 'character',
        name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: now
      });
      await putRecord(db, 'entities', {
        id: 'entity-mira', projectId: 'cypress-project-1', categoryId: 'characters',
        name: 'Mira Voss', fields: {description: 'Canonical description'}, links: [],
        createdAt: now, updatedAt: now
      });
      await putRecord(db, 'characters', {
        id: 'character-mira', projectId: 'cypress-project-1', entityId: 'entity-mira',
        name: 'Stale legacy name', description: 'Frozen legacy description', fields: {},
        createdAt: now, updatedAt: now
      });
    });
    cy.window().then((win) => {
      const activeProject = JSON.parse(win.localStorage.getItem('activeProject') ?? '{}');
      const nextProject = {...activeProject, rulesetId: 'ruleset-capabilities'};
      win.localStorage.setItem('activeProject', JSON.stringify(nextProject));
      const shell = JSON.parse(win.localStorage.getItem('wbd-app-shell') ?? '{}');
      win.localStorage.setItem(
        'wbd-app-shell',
        JSON.stringify({
          ...shell,
          state: {...shell.state, activeProject: nextProject}
        })
      );
      return new Cypress.Promise<void>((resolve, reject) => {
        const request = win.indexedDB.open('worldbuilding-desk', 2);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('rulesets')) {
            const store = db.createObjectStore('rulesets', {keyPath: 'id'});
            store.createIndex('projectId', 'projectId', {unique: false});
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['rulesets'], 'readwrite');
          tx.objectStore('rulesets').put({
            id: 'ruleset-capabilities', projectId: 'cypress-project-1',
            name: 'Capability Rules', version: '1',
            statDefinitions: [], resourceDefinitions: [], rules: [], itemTemplates: [],
            statusTemplates: [], createdAt: now, updatedAt: now
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        };
      });
    });
    cy.reload();

    const openMira = () => {
      cy.visit('/world-bible');
      cy.contains('button', 'Characters').click();
      cy.contains('[class*="entityName"]', /^Mira Voss$/)
        .parents('li')
        .first()
        .within(() => cy.contains('button', 'Edit').click());
    };

    openMira();
    cy.contains('span', 'One character, one home').should('be.visible');
    cy.contains('[role="tab"]', 'Canon').should('have.attr', 'aria-selected', 'true');
    cy.contains('[role="tab"]', 'Writing aids').click();
    cy.location('pathname').should('eq', '/world-bible');
    cy.contains('label', 'Dialogue style').find('select').select('style-quiet');
    cy.contains('label', 'Name').should('not.exist');
    cy.contains('label', 'Description').should('not.exist');
    cy.contains('button', 'Add Tool Profile').should('not.exist');
    cy.contains('button', 'Save dialogue style').click();
    cy.contains('[role="status"]', 'Dialogue style assigned').should('be.visible');

    mutateSmokeDb(async (db) => {
      const [character, entity] = await Promise.all([
        getRecord<{name: string; characterStyleId?: string}>(
          db,
          'characters',
          'character-mira'
        ),
        getRecord<{name: string; fields: {description: string}}>(
          db,
          'entities',
          'entity-mira'
        )
      ]);
      expect(character.name).to.equal('Mira Voss');
      expect(character.characterStyleId).to.equal('style-quiet');
      expect(entity.name).to.equal('Mira Voss');
      expect(entity.fields.description).to.equal('Canonical description');
    });

    openMira();
    cy.contains('[role="tab"]', 'Writing aids').click();
    cy.contains('button', 'Export character').click();
    cy.contains('[role="status"]', 'Exported "Mira Voss"').should('be.visible');

    openMira();
    cy.contains('[role="tab"]', 'Mechanics').click();
    cy.contains('button', 'Add mechanics to this character').click();
    cy.location('pathname').should('eq', '/sheets');
    cy.contains('Mira Voss').should('be.visible');
  });

  it('enables one tracked value from a World Bible character without advanced setup', () => {
    cy.visit('/projects');
    cy.contains('label', 'Project Name').find('input').type('First Mechanics Journey');
    cy.contains('label', 'Project Type').find('select').select('litrpg');
    cy.contains('button', 'Create Project').click();
    cy.location('pathname').should('eq', '/workspace');
    cy.visit('/world-bible');
    cy.contains('button', 'Characters').should('be.visible');

    mutateSmokeDb(async (db) => {
      const projects = await getAllRecords<{id: string; name: string}>(db, 'projects');
      const project = projects.find((entry) => entry.name === 'First Mechanics Journey');
      expect(project).to.not.equal(undefined);
      const categories = await getAllRecords<{id: string; projectId: string; kind: string}>(db, 'entityCategories');
      const category = categories.find((entry) => entry.projectId === project!.id && entry.kind === 'character');
      expect(category).to.not.equal(undefined);
      await putRecord(db, 'entities', {
        id: 'entity-first-mechanics', projectId: project!.id, categoryId: category!.id,
        name: 'Tamsin Vale', fields: {}, links: [], createdAt: Date.now(), updatedAt: Date.now()
      });
    });
    cy.reload();
    cy.contains('button', 'Characters').click();
    cy.contains('[class*="entityName"]', 'Tamsin Vale')
      .parents('li').first().within(() => cy.contains('button', 'Edit').click());
    cy.contains('[role="tab"]', 'Mechanics').click();
    cy.contains('button', 'Add mechanics').click();
    cy.contains('label', 'Value name').find('input').should('have.value', 'Health');
    cy.viewport(390, 844);
    cy.contains('button', 'Cancel').should('be.visible');
    cy.contains('button', 'Enable tracking').should('be.visible');
    cy.document().then((document) => {
      expect(document.documentElement.scrollWidth).to.be.at.most(390);
    });
    cy.contains('button', 'Enable tracking').click();
    cy.location('pathname').should('eq', '/world-bible');
    cy.contains('[role="status"]', 'Health is now tracked for Tamsin Vale.').should('be.visible');
    cy.contains('strong', '100 / 100').should('be.visible');
    cy.contains('button', 'Record a scene change').should('be.visible');

    mutateSmokeDb(async (db) => {
      const projects = await getAllRecords<{id: string; name: string; rulesetId?: string}>(db, 'projects');
      const project = projects.find((entry) => entry.name === 'First Mechanics Journey');
      expect(project?.rulesetId).to.be.a('string');
      const sheets = await getAllRecords<{projectId: string; characterEntityId?: string}>(db, 'character_sheets');
      expect(sheets.filter((sheet) => sheet.projectId === project!.id && sheet.characterEntityId === 'entity-first-mechanics')).to.have.length(1);
    });
  });

  it('builds a scene roster from canonical mentions and supports manual overrides', () => {
    cy.visit('/workspace');
    cy.get('.tiptap-editor')
      .click()
      .type('{selectall}Aria carries the Iron Sword through the Ember Archive.', {
        delay: 0
      });
    cy.contains('button', 'Save now').click();
    cy.contains('[role="status"]', /Scene (saved|already saved)\./).should('be.visible');

    cy.contains('button', 'Context').click();
    cy.contains('button', /^Scene$/).click();

    cy.contains('article', 'Aria').within(() => {
      cy.contains('Level 5').should('be.visible');
      cy.contains('32 / 40').should('be.visible');
    });
    cy.contains('article', 'Iron Sword').scrollIntoView().within(() => {
      cy.contains('Mentioned as “Iron Sword”').should('be.visible');
      cy.contains(/damage/i).should('be.visible');
      cy.contains('12').should('be.visible');
      cy.contains(/rarity/i).should('be.visible');
      cy.contains('Common').should('be.visible');
      cy.get('button[aria-label="Hide Iron Sword from this scene roster"]').click();
    });
    cy.contains('article', 'Iron Sword').should('not.exist');

    cy.get('select[aria-label="Add a character or item to this scene"]')
      .select('Iron Sword');
    cy.contains('button', /^Add$/).click();
    cy.contains('article', 'Iron Sword').should('be.visible');
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
    const scratchpadNote =
      'Loose planning note: Kaelor should discover the Ember Archive map fragment here.';

    mutateSmokeDb((db) =>
      putRecord(db, 'consistency_aliases', {
        id: 'alias-backup-smoke',
        projectId: 'cypress-project-1',
        targetType: 'entity',
        targetId: 'entity-ember-archive',
        entityId: 'entity-ember-archive',
        alias: 'The Archive of Embers',
        createdAt: 1,
        updatedAt: 1
      })
    );

    cy.visit('/workspace');
    cy.contains('button', /^Scratchpad$/).first().click();
    cy.get('[aria-label="Project scratchpad"] .tiptap-editor').clear().type(scratchpadNote);
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

    mutateSmokeDb(async (db) => {
      const aliases = await getAllRecords<{
        id: string;
        projectId: string;
        targetId: string;
        alias: string;
      }>(db, 'consistency_aliases');
      const importedAlias = aliases.find(
        (record) =>
          record.alias === 'The Archive of Embers' &&
          record.projectId !== 'cypress-project-1'
      );
      expect(importedAlias).to.exist;
      expect(importedAlias?.targetId).to.equal('entity-ember-archive');
    });

    cy.visit('/workspace');
    cy.contains('button', /^Scratchpad$/).first().click();
    cy.get('[aria-label="Project scratchpad"] .tiptap-editor').should(
      'contain.text',
      scratchpadNote
    );
  });

  it('blocks world bible JSON import on duplicate-name conflicts until a resolution is chosen', () => {
    cy.visit('/world-bible');

    cy.contains('button', 'Create Manually').click();
    cy.get('input[type="text"]').first().clear().type('Conflict Entry');
    cy.get('.tiptap-editor').first().click().type('Original description');
    cy.contains('button', /Create (Entry|Canon Record)|Save Item/).click();
    cy.contains('[role="status"]', /Entry created\.|Item saved\./).should('be.visible');

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
    cy.contains('p', 'Imported replacement description').should('be.visible');
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

      // The importer offers a Replace/Append choice via the shared confirm
      // dialog instead of a native confirm() — choose Replace here.
      cy.contains('[role="dialog"]', 'Replace existing prompt tools with imported tools?')
        .should('be.visible')
        .within(() => {
          cy.contains('button', 'Replace').click();
        });

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

      // Second import: choose Append instead of Replace.
      cy.contains('[role="dialog"]', 'Replace existing prompt tools with imported tools?')
        .should('be.visible')
        .within(() => {
          cy.contains('button', 'Append').click();
        });
    });

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
