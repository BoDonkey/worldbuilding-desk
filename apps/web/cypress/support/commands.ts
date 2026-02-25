const DB_NAME = 'worldbuilding-db';
const DB_VERSION = 11;

const STORE_NAMES = [
  'entities',
  'entityCategories',
  'projects',
  'writingDocuments',
  'projectSettings',
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
  'settlement_state'
] as const;

interface SeedProject {
  id: string;
  name: string;
  inheritRag: boolean;
  inheritShodh: boolean;
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
      const db = openRequest.result;
      for (const storeName of STORE_NAMES) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, {keyPath: 'id'});
        }
      }
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
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = params.db.transaction(
      ['projects', 'projectSettings', 'writingDocuments'],
      'readwrite'
    );

    tx.objectStore('projects').put(params.project);
    tx.objectStore('projectSettings').put(params.settings);

    for (const doc of params.documents) {
      tx.objectStore('writingDocuments').put(doc);
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

    // Seed by API shape instead of UI clicks to keep e2e flows deterministic and fast.
    win.localStorage.clear();

    return resetDatabase(win)
      .then(() => openDatabase(win))
      .then((db) =>
        seedRecords({
          db,
          project,
          settings,
          documents
        }).finally(() => db.close())
      )
      .then(() => {
        // App.tsx reads this key to restore active project on load.
        win.localStorage.setItem('activeProject', JSON.stringify(project));
      });
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      // Creates one active project with 3 scenes and baseline settings in IndexedDB.
      seedSmokeProjectData(): Chainable<void>;
    }
  }
}

export {};
