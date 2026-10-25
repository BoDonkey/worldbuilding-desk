/**
 * Retrieval and memory data for protected projects (slice 5.15b).
 *
 * A protected project keeps this data only in memory. When the project locks,
 * its cached services are closed so nothing derived from it stays reachable.
 * When it unlocks, the data is rebuilt in the background from the project's
 * own records, the same rebuild the Lore page offers.
 */
import {getProjectById, getProjectVaultState, subscribeVaultChanges} from '../storage';
import {closeRAGServices, getRAGService} from '../rag/getRAGService';
import {closeShodhServices, getShodhService} from '../shodh/getShodhService';
import {rebuildProjectContextHealth} from './contextHealthRebuild';

const lastState = new Map<string, string | null>();

const warn = (error: unknown) =>
  console.warn('Rebuilding project context failed; the Lore page can rebuild it.', error);
let started = false;

async function rebuild(projectId: string): Promise<void> {
  const project = await getProjectById(projectId);
  const state = await getProjectVaultState(projectId);
  if (!project || state === 'locked' || state === 'migrating') return;
  const [ragService, shodhService] = await Promise.all([getRAGService(projectId), getShodhService(projectId)]);
  await rebuildProjectContextHealth({project, ragService, shodhService});
}

/** Starts watching vault changes. Safe to call more than once. */
export function startVaultContextLifecycle(): () => void {
  if (started) return () => undefined;
  started = true;
  const unsubscribe = subscribeVaultChanges((projectId) => {
    void getProjectVaultState(projectId).then((state) => {
      const previous = lastState.get(projectId) ?? null;
      lastState.set(projectId, state);
      if (state === 'locked') {
        void Promise.all([closeRAGServices(projectId), closeShodhServices(projectId)]);
      } else if (state === null && previous !== null) {
        // Protection removed: the in-memory data goes, and the on-disk copy is rebuilt.
        void Promise.all([closeRAGServices(projectId), closeShodhServices(projectId)])
          .then(() => rebuild(projectId))
          .catch(warn);
      } else if (state === 'unlocked' && previous !== 'unlocked') {
        // Unlocked, or just protected (enabling deleted the on-disk copy).
        rebuild(projectId).catch(warn);
      }
    });
  });
  return () => {
    started = false;
    unsubscribe();
  };
}
