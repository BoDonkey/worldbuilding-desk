import type { Project } from './entityTypes';
import {
  openDb,
  CANON_DECISION_CLUSTER_STORE_NAME,
  CANON_DECISION_SUPPRESSION_STORE_NAME,
  CANONICAL_FACT_STORE_NAME,
  CATEGORY_STORE_NAME,
  CHARACTER_SHEET_STORE_NAME,
  CHARACTER_STORE_NAME,
  COMPENDIUM_ACTION_LOG_STORE_NAME,
  COMPENDIUM_ENTRY_STORE_NAME,
  COMPENDIUM_MILESTONE_STORE_NAME,
  COMPENDIUM_PROGRESS_STORE_NAME,
  COMPENDIUM_RECIPE_STORE_NAME,
  CONSISTENCY_ALIAS_STORE_NAME,
  CONSISTENCY_EVENT_STORE_NAME,
  CONSISTENCY_PROPOSAL_STORE_NAME,
  CORKBOARD_CHAPTER_CARD_STORE_NAME,
  ENTITY_STORE_NAME,
  LORE_DOCUMENT_LINK_STORE_NAME,
  LORE_DOCUMENT_STORE_NAME,
  LORE_ENTITY_PROPOSAL_STORE_NAME,
  LORE_FACT_PROPOSAL_STORE_NAME,
  PROJECT_STORE_NAME,
  SCRATCHPAD_STORE_NAME,
  SETTINGS_STORE_NAME,
  SETTLEMENT_MODULE_STORE_NAME,
  SETTLEMENT_STATE_STORE_NAME,
  STATE_MUTATION_EVENT_STORE_NAME,
  WRITING_STORE_NAME,
  ZONE_AFFINITY_PROFILE_STORE_NAME,
  ZONE_AFFINITY_PROGRESS_STORE_NAME
} from './db';

const PROJECT_SCOPED_STORES = [
  CATEGORY_STORE_NAME,
  ENTITY_STORE_NAME,
  WRITING_STORE_NAME,
  SCRATCHPAD_STORE_NAME,
  CORKBOARD_CHAPTER_CARD_STORE_NAME,
  SETTINGS_STORE_NAME,
  CHARACTER_STORE_NAME,
  CHARACTER_SHEET_STORE_NAME,
  LORE_DOCUMENT_STORE_NAME,
  LORE_DOCUMENT_LINK_STORE_NAME,
  LORE_ENTITY_PROPOSAL_STORE_NAME,
  LORE_FACT_PROPOSAL_STORE_NAME,
  CANONICAL_FACT_STORE_NAME,
  CANON_DECISION_CLUSTER_STORE_NAME,
  CANON_DECISION_SUPPRESSION_STORE_NAME,
  COMPENDIUM_ENTRY_STORE_NAME,
  COMPENDIUM_MILESTONE_STORE_NAME,
  COMPENDIUM_RECIPE_STORE_NAME,
  COMPENDIUM_PROGRESS_STORE_NAME,
  COMPENDIUM_ACTION_LOG_STORE_NAME,
  ZONE_AFFINITY_PROFILE_STORE_NAME,
  ZONE_AFFINITY_PROGRESS_STORE_NAME,
  SETTLEMENT_MODULE_STORE_NAME,
  SETTLEMENT_STATE_STORE_NAME,
  CONSISTENCY_PROPOSAL_STORE_NAME,
  CONSISTENCY_EVENT_STORE_NAME,
  CONSISTENCY_ALIAS_STORE_NAME,
  STATE_MUTATION_EVENT_STORE_NAME
] as const;

const PROJECT_LOCAL_STORAGE_PREFIXES = [
  'systemHistory',
  'loreSynopsis',
  'inspectorBudget',
  'workspaceReviewPrefs'
] as const;

function transactionToPromise(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function deleteProjectScopedRecords(projectId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([...PROJECT_SCOPED_STORES], 'readwrite');

  PROJECT_SCOPED_STORES.forEach((storeName) => {
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result as Array<{
        id?: string;
        projectId?: string;
      }>;

      records
        .filter(
          (record): record is {id: string; projectId?: string} =>
            record.projectId === projectId && typeof record.id === 'string'
        )
        .forEach((record) => {
          store.delete(record.id);
        });
    };
  });

  await transactionToPromise(tx);
}

function deleteDatabaseIfPresent(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

function removeProjectFromWorkspaceUi(projectId: string): void {
  const raw = localStorage.getItem('wbd-workspace-ui');
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as {
      state?: {
        drawerPreferencesByProjectId?: Record<string, unknown>;
        selectedDocumentIdByProjectId?: Record<string, unknown>;
      };
    };
    delete parsed.state?.drawerPreferencesByProjectId?.[projectId];
    delete parsed.state?.selectedDocumentIdByProjectId?.[projectId];
    localStorage.setItem('wbd-workspace-ui', JSON.stringify(parsed));
  } catch {
    // Leave malformed persisted UI state alone; it is non-critical cleanup.
  }
}

function deleteProjectLocalStorage(projectId: string): void {
  if (typeof localStorage === 'undefined') return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (
      PROJECT_LOCAL_STORAGE_PREFIXES.some(
        (prefix) =>
          key === `${prefix}:${projectId}` ||
          key.startsWith(`${prefix}:${projectId}:`)
      )
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  removeProjectFromWorkspaceUi(projectId);
}

async function deleteProjectAuxiliaryStorage(projectId: string): Promise<void> {
  deleteProjectLocalStorage(projectId);
  await Promise.all([
    deleteDatabaseIfPresent(`rag-${projectId}`),
    deleteDatabaseIfPresent(`shodh-memory-${projectId}`)
  ]);
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE_NAME, 'readonly');
    const store = tx.objectStore(PROJECT_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as Project[]);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getProjectById(id: string): Promise<Project | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE_NAME, 'readonly');
    const store = tx.objectStore(PROJECT_STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve((request.result as Project) ?? null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveProject(project: Project): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PROJECT_STORE_NAME);
    const request = store.put(project);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PROJECT_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      Promise.all([
        deleteProjectScopedRecords(id),
        deleteProjectAuxiliaryStorage(id)
      ])
        .then(() => resolve())
        .catch((error: unknown) => reject(error));
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
