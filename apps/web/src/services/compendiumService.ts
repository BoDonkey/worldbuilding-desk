import type {
  CompendiumActionLog,
  CompendiumEntry,
  CompendiumDomain,
  CompendiumMilestone,
  CompendiumProgress,
  WorldEntity,
  UnlockableRecipe
} from '../entityTypes';
import {
  openDb,
  COMPENDIUM_ACTION_LOG_STORE_NAME,
  COMPENDIUM_ENTRY_STORE_NAME,
  COMPENDIUM_MILESTONE_STORE_NAME,
  COMPENDIUM_PROGRESS_STORE_NAME,
  COMPENDIUM_RECIPE_STORE_NAME
} from '../db';

type RecordActionParams = {
  projectId: string;
  entryId: string;
  actionId: string;
  quantity?: number;
  characterSheetId?: string;
};

export interface RecordActionResult {
  log: CompendiumActionLog | null;
  progress: CompendiumProgress;
  unlockedMilestoneIds: string[];
  unlockedRecipeIds: string[];
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function progressIdFor(projectId: string, characterSheetId?: string): string {
  return characterSheetId
    ? `compendium:${projectId}:sheet:${characterSheetId}`
    : `compendium:${projectId}:global`;
}

function normalizeQuantity(quantity?: number): number {
  if (quantity === undefined) return 1;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('quantity must be a positive number');
  }
  return quantity;
}

export async function getCompendiumEntriesByProject(
  projectId: string
): Promise<CompendiumEntry[]> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_ENTRY_STORE_NAME, 'readonly');
  const store = tx.objectStore(COMPENDIUM_ENTRY_STORE_NAME);
  const all = (await requestToPromise(store.getAll())) as CompendiumEntry[];
  return all
    .filter((entry) => entry.projectId === projectId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveCompendiumEntry(entry: CompendiumEntry): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_ENTRY_STORE_NAME, 'readwrite');
  const store = tx.objectStore(COMPENDIUM_ENTRY_STORE_NAME);
  await requestToPromise(store.put(entry));
}

export async function upsertCompendiumEntryFromEntity(params: {
  projectId: string;
  entity: WorldEntity;
  domain: CompendiumDomain;
  defaultActions?: CompendiumEntry['actions'];
}): Promise<CompendiumEntry> {
  const existing = (await getCompendiumEntriesByProject(params.projectId)).find(
    (entry) => entry.sourceEntityId === params.entity.id
  );
  const now = Date.now();
  const fallbackActions: CompendiumEntry['actions'] = [
    {id: 'discover', label: 'Discover', points: 1, repeatable: false}
  ];

  const entry: CompendiumEntry = {
    id: existing?.id ?? crypto.randomUUID(),
    projectId: params.projectId,
    name: params.entity.name,
    domain: params.domain,
    sourceEntityId: params.entity.id,
    description:
      typeof params.entity.fields.description === 'string'
        ? params.entity.fields.description
        : undefined,
    tags: existing?.tags ?? [],
    actions: existing?.actions ?? params.defaultActions ?? fallbackActions,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  await saveCompendiumEntry(entry);
  return entry;
}

export async function deleteCompendiumEntry(entryId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_ENTRY_STORE_NAME, 'readwrite');
  const store = tx.objectStore(COMPENDIUM_ENTRY_STORE_NAME);
  await requestToPromise(store.delete(entryId));
}

export async function getCompendiumMilestonesByProject(
  projectId: string
): Promise<CompendiumMilestone[]> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_MILESTONE_STORE_NAME, 'readonly');
  const store = tx.objectStore(COMPENDIUM_MILESTONE_STORE_NAME);
  const all = (await requestToPromise(store.getAll())) as CompendiumMilestone[];
  return all
    .filter((milestone) => milestone.projectId === projectId)
    .sort((a, b) => a.pointsRequired - b.pointsRequired);
}

export async function saveCompendiumMilestone(
  milestone: CompendiumMilestone
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_MILESTONE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(COMPENDIUM_MILESTONE_STORE_NAME);
  await requestToPromise(store.put(milestone));
}

export async function getRecipesByProject(
  projectId: string
): Promise<UnlockableRecipe[]> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_RECIPE_STORE_NAME, 'readonly');
  const store = tx.objectStore(COMPENDIUM_RECIPE_STORE_NAME);
  const all = (await requestToPromise(store.getAll())) as UnlockableRecipe[];
  return all
    .filter((recipe) => recipe.projectId === projectId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveUnlockableRecipe(recipe: UnlockableRecipe): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_RECIPE_STORE_NAME, 'readwrite');
  const store = tx.objectStore(COMPENDIUM_RECIPE_STORE_NAME);
  await requestToPromise(store.put(recipe));
}

export async function getCompendiumProgress(
  projectId: string,
  characterSheetId?: string
): Promise<CompendiumProgress> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_PROGRESS_STORE_NAME, 'readwrite');
  const store = tx.objectStore(COMPENDIUM_PROGRESS_STORE_NAME);
  const id = progressIdFor(projectId, characterSheetId);
  const existing = (await requestToPromise(
    store.get(id)
  )) as CompendiumProgress | undefined;

  if (existing) {
    return existing;
  }

  const created: CompendiumProgress = {
    id,
    projectId,
    characterSheetId,
    totalPoints: 0,
    unlockedMilestoneIds: [],
    unlockedRecipeIds: [],
    updatedAt: Date.now()
  };
  await requestToPromise(store.put(created));
  return created;
}

export async function getCompendiumActionLogs(
  projectId: string,
  characterSheetId?: string
): Promise<CompendiumActionLog[]> {
  const db = await openDb();
  const tx = db.transaction(COMPENDIUM_ACTION_LOG_STORE_NAME, 'readonly');
  const store = tx.objectStore(COMPENDIUM_ACTION_LOG_STORE_NAME);
  const all = (await requestToPromise(store.getAll())) as CompendiumActionLog[];
  const targetProgressId = progressIdFor(projectId, characterSheetId);
  return all
    .filter(
      (log) => log.projectId === projectId && log.progressId === targetProgressId
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function recordCompendiumAction(
  params: RecordActionParams
): Promise<RecordActionResult> {
  const quantity = normalizeQuantity(params.quantity);
  const progressId = progressIdFor(params.projectId, params.characterSheetId);
  const db = await openDb();
  const tx = db.transaction(
    [
      COMPENDIUM_ENTRY_STORE_NAME,
      COMPENDIUM_PROGRESS_STORE_NAME,
      COMPENDIUM_MILESTONE_STORE_NAME,
      COMPENDIUM_ACTION_LOG_STORE_NAME
    ],
    'readwrite'
  );

  const entryStore = tx.objectStore(COMPENDIUM_ENTRY_STORE_NAME);
  const progressStore = tx.objectStore(COMPENDIUM_PROGRESS_STORE_NAME);
  const milestoneStore = tx.objectStore(COMPENDIUM_MILESTONE_STORE_NAME);
  const actionLogStore = tx.objectStore(COMPENDIUM_ACTION_LOG_STORE_NAME);

  const entry = (await requestToPromise(
    entryStore.get(params.entryId)
  )) as CompendiumEntry | undefined;
  if (!entry || entry.projectId !== params.projectId) {
    throw new Error('Compendium entry not found for project');
  }

  const action = entry.actions.find((item) => item.id === params.actionId);
  if (!action) {
    throw new Error('Action is not defined for this entry');
  }

  const existingProgress = (await requestToPromise(
    progressStore.get(progressId)
  )) as CompendiumProgress | undefined;
  const progress: CompendiumProgress =
    existingProgress ??
    {
      id: progressId,
      projectId: params.projectId,
      characterSheetId: params.characterSheetId,
      totalPoints: 0,
      unlockedMilestoneIds: [],
      unlockedRecipeIds: [],
      updatedAt: Date.now()
    };

  if (!action.repeatable) {
    const logs = (await requestToPromise(
      actionLogStore.getAll()
    )) as CompendiumActionLog[];
    const alreadyRecorded = logs.some(
      (log) =>
        log.progressId === progress.id &&
        log.entryId === params.entryId &&
        log.actionId === params.actionId
    );
    if (alreadyRecorded) {
      progress.updatedAt = Date.now();
      await requestToPromise(progressStore.put(progress));
      return {
        log: null,
        progress,
        unlockedMilestoneIds: [],
        unlockedRecipeIds: []
      };
    }
  }

  const pointsAwarded = action.points * quantity;
  progress.totalPoints += pointsAwarded;

  const milestones = (await requestToPromise(
    milestoneStore.getAll()
  )) as CompendiumMilestone[];
  const projectMilestones = milestones
    .filter((milestone) => milestone.projectId === params.projectId)
    .sort((a, b) => a.pointsRequired - b.pointsRequired);
  const unlockedMilestoneSet = new Set(progress.unlockedMilestoneIds);
  const unlockedRecipeSet = new Set(progress.unlockedRecipeIds);
  const unlockedMilestoneIds: string[] = [];
  const unlockedRecipeIds: string[] = [];

  for (const milestone of projectMilestones) {
    if (milestone.pointsRequired > progress.totalPoints) {
      continue;
    }
    if (unlockedMilestoneSet.has(milestone.id)) {
      continue;
    }
    unlockedMilestoneSet.add(milestone.id);
    unlockedMilestoneIds.push(milestone.id);
    for (const recipeId of milestone.unlockRecipeIds ?? []) {
      if (!unlockedRecipeSet.has(recipeId)) {
        unlockedRecipeSet.add(recipeId);
        unlockedRecipeIds.push(recipeId);
      }
    }
  }

  progress.unlockedMilestoneIds = Array.from(unlockedMilestoneSet);
  progress.unlockedRecipeIds = Array.from(unlockedRecipeSet);
  progress.updatedAt = Date.now();

  const log: CompendiumActionLog = {
    id: crypto.randomUUID(),
    projectId: params.projectId,
    progressId,
    entryId: params.entryId,
    actionId: params.actionId,
    quantity,
    pointsAwarded,
    createdAt: Date.now()
  };

  await requestToPromise(actionLogStore.put(log));
  await requestToPromise(progressStore.put(progress));

  return {
    log,
    progress,
    unlockedMilestoneIds,
    unlockedRecipeIds
  };
}
