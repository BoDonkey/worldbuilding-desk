import type {SceneSnapshot, WritingDocument} from '../../entityTypes';
import {
  deleteSceneSnapshots,
  getDocumentsByProject,
  getProjectSceneSnapshots,
  saveSceneSnapshots
} from '../storage';
import {countWords} from '../../utils/textHelpers';

/*
 * Draft milestones (slice 4.96): "Draft 1 complete" saves a named snapshot of
 * every scene at once. A milestone is not a record of its own: it is the set
 * of `milestone` snapshots that share `milestone.id`, so it travels in backups
 * with the 4.95 snapshots and its scenes can be restored one by one from each
 * scene's Snapshots. Restoring a whole milestone is not offered, so a draft
 * can never silently overwrite later work. Milestone snapshots are never
 * pruned.
 */

export interface DraftMilestoneScene {
  snapshot: SceneSnapshot;
  sceneId: string;
  title: string;
}

export interface DraftMilestone {
  id: string;
  name: string;
  createdAt: number;
  /** In manuscript order as it was when the milestone was saved. */
  scenes: DraftMilestoneScene[];
  wordCount: number;
}

export interface DeletedScene {
  sceneId: string;
  /** The title as of its newest snapshot that recorded one. */
  title: string;
  /** Newest first. */
  snapshots: SceneSnapshot[];
}

const byNewest = (a: SceneSnapshot, b: SceneSnapshot) => b.createdAt - a.createdAt || b.id.localeCompare(a.id);

/** The default name, when the author gives none. */
export const defaultMilestoneName = (now: number) =>
  `Draft of ${new Date(now).toLocaleDateString(undefined, {dateStyle: 'medium'})}`;

/** One milestone snapshot per scene, in the order given. */
export function buildDraftMilestoneSnapshots(params: {
  projectId: string;
  name: string;
  scenes: ReadonlyArray<Pick<WritingDocument, 'id' | 'title' | 'content'>>;
  now: number;
  milestoneId?: string;
}): SceneSnapshot[] {
  const milestoneId = params.milestoneId ?? crypto.randomUUID();
  const name = params.name.trim() || defaultMilestoneName(params.now);
  return params.scenes.map((scene, order) => ({
    id: crypto.randomUUID(),
    projectId: params.projectId,
    sceneId: scene.id,
    ...(scene.title.trim() ? {sceneTitle: scene.title.trim()} : {}),
    content: scene.content,
    name,
    kind: 'milestone',
    milestone: {id: milestoneId, order},
    wordCount: countWords(scene.content),
    createdAt: params.now
  }));
}

/**
 * Saves a milestone of every scene in manuscript order. `openScene` is the
 * scene open in the Workspace as edited, which can be ahead of its last save.
 */
export async function saveDraftMilestone(params: {
  projectId: string;
  name: string;
  openScene?: Pick<WritingDocument, 'id' | 'title' | 'content'> | null;
  now?: number;
}): Promise<DraftMilestone> {
  const documents = await getDocumentsByProject(params.projectId);
  if (documents.length === 0) throw new Error('This project has no scenes to save as a draft.');
  const open = params.openScene;
  const scenes = documents.map((doc) => (open && doc.id === open.id ? {...doc, title: open.title, content: open.content} : doc));
  const snapshots = buildDraftMilestoneSnapshots({
    projectId: params.projectId,
    name: params.name,
    scenes,
    now: params.now ?? Date.now()
  });
  await saveSceneSnapshots(snapshots);
  return groupDraftMilestones(snapshots)[0];
}

/** Milestones in `snapshots`, newest first. */
export function groupDraftMilestones(snapshots: readonly SceneSnapshot[]): DraftMilestone[] {
  const groups = new Map<string, SceneSnapshot[]>();
  for (const snapshot of snapshots) {
    if (snapshot.kind !== 'milestone' || !snapshot.milestone) continue;
    const group = groups.get(snapshot.milestone.id) ?? [];
    group.push(snapshot);
    groups.set(snapshot.milestone.id, group);
  }
  return [...groups.entries()]
    .map(([id, group]): DraftMilestone => {
      const ordered = group.slice().sort((a, b) => (a.milestone?.order ?? 0) - (b.milestone?.order ?? 0));
      return {
        id,
        name: ordered[0].name ?? 'Draft milestone',
        createdAt: Math.min(...ordered.map((snapshot) => snapshot.createdAt)),
        scenes: ordered.map((snapshot) => ({
          snapshot,
          sceneId: snapshot.sceneId,
          title: snapshot.sceneTitle || 'Untitled scene'
        })),
        wordCount: ordered.reduce((sum, snapshot) => sum + snapshot.wordCount, 0)
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
}

/** Scenes that have snapshots but no longer exist, most recently snapshotted first. */
export function findDeletedScenes(
  snapshots: readonly SceneSnapshot[],
  documents: ReadonlyArray<Pick<WritingDocument, 'id'>>
): DeletedScene[] {
  const live = new Set(documents.map((doc) => doc.id));
  const bySceneId = new Map<string, SceneSnapshot[]>();
  for (const snapshot of snapshots) {
    if (live.has(snapshot.sceneId)) continue;
    const group = bySceneId.get(snapshot.sceneId) ?? [];
    group.push(snapshot);
    bySceneId.set(snapshot.sceneId, group);
  }
  return [...bySceneId.entries()]
    .map(([sceneId, group]) => {
      const newestFirst = group.slice().sort(byNewest);
      const titled = newestFirst.find((snapshot) => snapshot.sceneTitle?.trim());
      return {sceneId, title: titled?.sceneTitle?.trim() || 'Untitled scene', snapshots: newestFirst};
    })
    .sort((a, b) => byNewest(a.snapshots[0], b.snapshots[0]));
}

/** The milestone's scenes as documents, for the existing manuscript export. */
export function milestoneAsDocuments(milestone: DraftMilestone, projectId: string): WritingDocument[] {
  return milestone.scenes.map(({snapshot, title}, order) => ({
    id: snapshot.sceneId,
    projectId,
    title,
    content: snapshot.content,
    order,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.createdAt
  }));
}

export async function deleteDraftMilestone(projectId: string, milestoneId: string): Promise<void> {
  const ids = (await getProjectSceneSnapshots(projectId))
    .filter((snapshot) => snapshot.milestone?.id === milestoneId)
    .map((snapshot) => snapshot.id);
  await deleteSceneSnapshots(ids);
}
