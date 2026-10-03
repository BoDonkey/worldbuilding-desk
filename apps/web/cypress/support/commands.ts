import {
  ACTOR_RESOLUTION_STORE_NAME,
  CHARACTER_IDENTITY_REPORT_STORE_NAME,
  DB_NAME,
  DB_VERSION,
  upgradeDatabase,
  PROJECT_MIGRATION_BACKUP_STORE_NAME
} from '../../src/db';

const STORE_NAMES = [
  'entities',
  'entityCategories',
  'projects',
  'writingDocuments',
  'scratchpads',
  'world_canvases',
  'corkboard_chapter_cards',
  'projectSettings',
  'lore_documents',
  'lore_document_links',
  'lore_fact_proposals',
  'lore_entity_proposals',
  'canonical_facts',
  'canon_decision_clusters',
  'canon_decision_suppressions',
  'characters',
  'character_sheets',
  'compendium_entries',
  'compendium_milestones',
  'compendium_recipes',
  'compendium_progress',
  'compendium_action_logs',
  'zone_affinity_profiles',
  'zone_affinity_progress',
  'settlement_modules',
  'settlement_state',
  'consistency_proposals',
  'consistency_events',
  'consistency_aliases',
  'state_mutation_events',
  PROJECT_MIGRATION_BACKUP_STORE_NAME,
  ACTOR_RESOLUTION_STORE_NAME,
  CHARACTER_IDENTITY_REPORT_STORE_NAME
] as const;

// Keep equal to CURRENT_PROJECT_SCHEMA_VERSION in
// src/services/storage/projectSchemaMigrations.ts (guarded by
// src/test/cypressSeedSchema.test.ts). Seeding at the current version means
// the app runs no load-time migrations, whose project writes otherwise race
// any IndexedDB mutation a spec performs right after reload.
const SEED_PROJECT_STORAGE_SCHEMA_VERSION = 7;

interface SeedProject {
  id: string;
  name: string;
  inheritRag: boolean;
  inheritShodh: boolean;
  storageSchemaVersion: number;
  createdAt: number;
  updatedAt: number;
}

interface SeedWritingDocument {
  id: string;
  projectId: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

interface SeedSettings {
  id: string;
  projectId: string;
  characterStyles: unknown[];
  aiSettings: {
    provider: 'anthropic';
    configs: {
      anthropic: {model: string};
      openai: {model: string};
      gemini: {model: string};
      ollama: {model: string; baseUrl: string};
    };
    promptTools: unknown[];
    defaultToolIds: string[];
    defaultToolIdsByMode: {
      litrpg: string[];
      game: string[];
      general: string[];
    };
  };
  activeSkills: string[];
  projectMode: 'litrpg';
  featureToggles: {
    enableGameSystems: boolean;
    enableRuntimeModifiers: boolean;
    enableSettlementAndZoneSystems: boolean;
    enableRuleAuthoring: boolean;
  };
  createdAt: number;
  updatedAt: number;
}

interface SeedEntity {
  id: string;
  projectId: string;
  categoryId: string;
  name: string;
  fields: Record<string, unknown>;
  links: string[];
  createdAt: number;
  updatedAt: number;
}

interface SeedCharacterSheet {
  id: string;
  projectId: string;
  name: string;
  level: number;
  experience: number;
  stats: Array<{
    definitionId: string;
    value: number;
  }>;
  resources: Array<{
    definitionId: string;
    current: number;
    max: number;
  }>;
  inventory: string[];
  createdAt: number;
  updatedAt: number;
}

function resetDatabase(win: Window): Promise<void> {
  return new Promise((resolve, reject) => {
    const deleteRequest = win.indexedDB.deleteDatabase(DB_NAME);
    deleteRequest.onsuccess = () => resolve();
    deleteRequest.onerror = () => reject(deleteRequest.error);
    deleteRequest.onblocked = () => resolve();
  });
}

function openDatabase(win: Window): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const openRequest = win.indexedDB.open(DB_NAME, DB_VERSION);

    openRequest.onupgradeneeded = () => {
      // Use the app's own upgrade routine so every store and index exists,
      // including ones added after this seed list was written.
      upgradeDatabase(openRequest.result);
    };

    openRequest.onsuccess = () => resolve(openRequest.result);
    openRequest.onerror = () => reject(openRequest.error);
  });
}

function seedRecords(params: {
  db: IDBDatabase;
  project: SeedProject;
  settings: SeedSettings;
  documents: SeedWritingDocument[];
  entities: SeedEntity[];
  characterSheets: SeedCharacterSheet[];
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = params.db.transaction(
      ['projects', 'projectSettings', 'writingDocuments', 'entities', 'character_sheets'],
      'readwrite'
    );

    tx.objectStore('projects').put(params.project);
    tx.objectStore('projectSettings').put(params.settings);

    for (const doc of params.documents) {
      tx.objectStore('writingDocuments').put(doc);
    }
    for (const entity of params.entities) {
      tx.objectStore('entities').put(entity);
    }
    for (const sheet of params.characterSheets) {
      tx.objectStore('character_sheets').put(sheet);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

Cypress.Commands.add('seedSmokeProjectData', () => {
  return cy.window({log: false}).then((win) => {
    const now = Date.now();

    const project: SeedProject = {
      id: 'cypress-project-1',
      name: 'Cypress Smoke Project',
      inheritRag: true,
      inheritShodh: true,
      storageSchemaVersion: SEED_PROJECT_STORAGE_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now
    };

    const documents: SeedWritingDocument[] = [
      {
        id: 'scene-alpha',
        projectId: project.id,
        title: 'Alpha Scene',
        content: '<p>Alpha content</p>',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'scene-beta',
        projectId: project.id,
        title: 'Beta Scene',
        content: '<p>Beta content</p>',
        createdAt: now + 1,
        updatedAt: now + 1
      },
      {
        id: 'scene-gamma',
        projectId: project.id,
        title: 'Gamma Scene',
        content: '<p>Gamma content</p>',
        createdAt: now + 2,
        updatedAt: now + 2
      }
    ];

    const settings: SeedSettings = {
      id: 'settings-cypress-project-1',
      projectId: project.id,
      characterStyles: [],
      aiSettings: {
        provider: 'anthropic',
        configs: {
          anthropic: {model: 'claude-sonnet-4-20250514'},
          openai: {model: 'gpt-4o-mini'},
          gemini: {model: 'gemini-2.0-flash'},
          ollama: {model: 'llama3.1', baseUrl: 'http://localhost:11434'}
        },
        promptTools: [],
        defaultToolIds: [],
        defaultToolIdsByMode: {
          litrpg: [],
          game: [],
          general: []
        }
      },
      activeSkills: [],
      projectMode: 'litrpg',
      featureToggles: {
        enableGameSystems: true,
        enableRuntimeModifiers: true,
        enableSettlementAndZoneSystems: true,
        enableRuleAuthoring: true
      },
      createdAt: now,
      updatedAt: now
    };
    const entities: SeedEntity[] = [
      {
        id: 'entity-sword-1',
        projectId: project.id,
        categoryId: 'items',
        name: 'Iron Sword',
        fields: {
          damage: '12',
          buffAttack: '+2',
          rarity: 'Common'
        },
        links: [],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'entity-ember-archive',
        projectId: project.id,
        categoryId: 'locations',
        name: 'Ember Archive',
        fields: {
          description: 'A known lore location used by review smoke tests.'
        },
        links: [],
        createdAt: now + 1,
        updatedAt: now + 1
      }
    ];
    const characterSheets: SeedCharacterSheet[] = [
      {
        id: 'sheet-aria-1',
        projectId: project.id,
        name: 'Aria',
        level: 5,
        experience: 2300,
        stats: [
          {definitionId: 'strength', value: 14},
          {definitionId: 'agility', value: 11}
        ],
        resources: [{definitionId: 'hp', current: 32, max: 40}],
        inventory: [],
        createdAt: now,
        updatedAt: now
      }
    ];

    // Seed by API shape instead of UI clicks to keep e2e flows deterministic and fast.
    win.localStorage.clear();

    return resetDatabase(win)
      .then(() => openDatabase(win))
      .then((db) =>
        seedRecords({
          db,
          project,
          settings,
          documents,
          entities,
          characterSheets
        }).finally(() => db.close())
      )
      .then(() => {
        // App.tsx reads this key to restore active project on load.
        win.localStorage.setItem('activeProject', JSON.stringify(project));
        win.localStorage.setItem(
          'wbd-app-shell',
          JSON.stringify({
            state: {
              activeProject: project,
              isRailCollapsed: false
            },
            version: 0
          })
        );
      });
  });
});

Cypress.Commands.add('ensureSettingsSectionOpen', (sectionTitle: string) => {
  cy.contains('summary', sectionTitle)
    .closest('details')
    .then(($details) => {
      if (!$details.attr('open')) {
        cy.wrap($details).find('summary').click();
      }
    });
});

Cypress.Commands.add('setSeededProjectProvider', (provider: 'anthropic' | 'ollama') => {
  return cy.window().then(
    (win) =>
      new Cypress.Promise<void>((resolve, reject) => {
        const openRequest = win.indexedDB.open(DB_NAME, DB_VERSION);
        openRequest.onerror = () => reject(openRequest.error);
        openRequest.onsuccess = () => {
          const db = openRequest.result;
          const tx = db.transaction(['projectSettings'], 'readwrite');
          const store = tx.objectStore('projectSettings');
          const getRequest = store.get('settings-cypress-project-1');

          getRequest.onerror = () => reject(getRequest.error);
          getRequest.onsuccess = () => {
            const existing = getRequest.result;
            store.put({
              ...existing,
              aiSettings: {...existing.aiSettings, provider}
            });
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      })
  );
});

declare global {
  namespace Cypress {
    interface Chainable {
      // Creates one active project with 3 scenes and baseline settings in IndexedDB.
      seedSmokeProjectData(): Chainable<void>;
      // Expands a collapsed <details> section on the Settings page; a no-op when already open.
      ensureSettingsSectionOpen(sectionTitle: string): Chainable<void>;
      // Switches the seeded smoke project's AI provider in IndexedDB; reload afterwards.
      setSeededProjectProvider(provider: 'anthropic' | 'ollama'): Chainable<void>;
    }
  }
}

export {};
