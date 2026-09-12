import type { Project } from './entityTypes';
import {
  openDb,
  PROJECT_MIGRATION_BACKUP_STORE_NAME,
  PROJECT_SCOPED_STORE_NAMES,
  PROJECT_STORE_NAME,
} from './db';
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  ensureProjectStorageCurrent,
  type ProjectMigrationReport
} from './services/storage/projectSchemaMigrations';
import {announceStatus} from './store/notificationStore';

const announceProjectMigration = (project: Project) => (report: ProjectMigrationReport) => {
  announceStatus(
    `Project "${project.name}" was updated to the current storage format` +
      (report.backupId ? ' and a pre-update backup was kept.' : '.')
  );
};

const PROJECT_LOCAL_STORAGE_PREFIXES = [
  'systemHistory',
  'loreSynopsis',
  'inspectorBudget',
  'workspaceReviewPrefs',
  'progressionContinuityReview'
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
  const storesToClear = [
    ...PROJECT_SCOPED_STORE_NAMES,
    PROJECT_MIGRATION_BACKUP_STORE_NAME
  ] as const;
  const tx = db.transaction([...storesToClear], 'readwrite');

  storesToClear.forEach((storeName) => {
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

    request.onsuccess = async () => {
      try {
        resolve(
          await Promise.all(
            (request.result as Project[]).map((project) =>
              ensureProjectStorageCurrent(db, project, {onMigrated: announceProjectMigration(project)})
            )
          )
        );
      } catch (error) {
        reject(error);
      }
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

    request.onsuccess = async () => {
      try {
        const project = (request.result as Project | undefined) ?? null;
        resolve(project ? await ensureProjectStorageCurrent(db, project, {onMigrated: announceProjectMigration(project)}) : null);
      } catch (error) {
        reject(error);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function saveProject(project: Project): Promise<void> {
  const db = await openDb();
  const versionedProject = {
    ...project,
    storageSchemaVersion:
      project.storageSchemaVersion ?? CURRENT_PROJECT_SCHEMA_VERSION
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(PROJECT_STORE_NAME);
    const request = store.put(versionedProject);

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
