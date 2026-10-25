import type { Project } from '../../../entityTypes';
import {
  openDb,
  PROJECT_MIGRATION_BACKUP_STORE_NAME,
  PROJECT_SCOPED_STORE_NAMES,
  PROJECT_STORE_NAME,
} from '../db';
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  ensureProjectStorageCurrent,
  type ProjectMigrationReport
} from '../projectSchemaMigrations';
import {announceStatus} from '../../../store/notificationStore';
import {runProjectWriteTransaction} from '../projectWriteTransaction';
import {closeRAGServices} from '../../rag/getRAGService';
import {closeShodhServices} from '../../shodh/getShodhService';
import {getRulesetByProjectId, replaceRulesetSnapshot} from './rulesetStorage';
import {forgetVault} from '../vault/vaultRegistry';

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
  'progressionContinuityReview',
  // Pre-3.23c mechanics drafts not yet moved into project storage.
  'wbd:first-mechanics'
] as const;

async function deleteProjectPrimaryRecords(projectId: string): Promise<void> {
  const storesToClear = [...PROJECT_SCOPED_STORE_NAMES, PROJECT_MIGRATION_BACKUP_STORE_NAME];
  await runProjectWriteTransaction([PROJECT_STORE_NAME, ...storesToClear], async (tx) => {
    for (const storeName of storesToClear) {
      const records = await tx.getAll<{id: string; projectId?: string}>(storeName);
      for (const record of records) {
        if (record.projectId === projectId) await tx.delete(storeName, record.id);
      }
    }
    await tx.delete(PROJECT_STORE_NAME, projectId);
  });
}

function deleteDatabaseIfPresent(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Unable to remove project context data.'));
    request.onblocked = () => reject(new Error(
      'Project deletion is blocked. Close other windows using this project and retry.'
    ));
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
        statPinsByProjectId?: Record<string, unknown>;
      };
    };
    delete parsed.state?.drawerPreferencesByProjectId?.[projectId];
    delete parsed.state?.selectedDocumentIdByProjectId?.[projectId];
    delete parsed.state?.statPinsByProjectId?.[projectId];
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

/**
 * Closes and deletes a project's on-disk retrieval and memory databases. They
 * are rebuildable; a blocked deletion rejects so callers can stop first.
 */
export async function deleteProjectAuxiliaryStorage(projectId: string): Promise<void> {
  await Promise.all([closeRAGServices(projectId), closeShodhServices(projectId)]);
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
  const ruleset = await getRulesetByProjectId(id);
  // Derived context is rebuildable. A blocked deletion must leave primary data
  // intact so the author can close another window and retry.
  await deleteProjectAuxiliaryStorage(id);
  // Rulesets live in a separate legacy database. Compensate on primary-write
  // failure rather than letting a failed deletion destroy a live ruleset.
  await replaceRulesetSnapshot(id, null);
  try {
    await deleteProjectPrimaryRecords(id);
  } catch (error) {
    if (ruleset) {
      try {
        await replaceRulesetSnapshot(id, ruleset);
      } catch (restoreError) {
        throw new AggregateError([error, restoreError],
          'Project deletion failed and its ruleset could not be restored. Restore a project backup before continuing.',
          {cause: restoreError});
      }
    }
    throw error;
  }
  deleteProjectLocalStorage(id);
  forgetVault(id);
}
