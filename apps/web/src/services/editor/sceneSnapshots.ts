import type {SceneSnapshot, SceneSnapshotKind} from '../../entityTypes';
import {getSceneSnapshots, saveSceneSnapshot} from '../storage';
import {manuscriptPlainText} from '../state/manuscriptCustody';
import {countWords} from '../../utils/textHelpers';
import {countWordChanges, diffWords, tokenizeWords, type WordDiffOp} from './wordDiff';


/*
 * Scene snapshots (slice 4.95): saved copies of a scene's text to compare
 * and restore, modelled on Scrivener's. They are the author's own text:
 * never canon, never sent to a model, never read by review or retrieval.
 * Manual snapshots are kept until deleted; automatic ones are pruned to the
 * newest AUTOMATIC_SNAPSHOTS_KEPT_PER_SCENE per scene.
 */

export const AUTOMATIC_SNAPSHOTS_KEPT_PER_SCENE = 20;

/**
 * A request to replace the open scene's text (Restore). The editor applies
 * it once per token as an ordinary, undoable edit, so it saves and is
 * re-reviewed like typing.
 */
export interface SceneContentReplacement {
  documentId: string;
  html: string;
  token: number;
}

/** Automatic snapshots are pruned; the author's own, milestones', and alternatives never are. */
export const isAutomaticSnapshot = (snapshot: Pick<SceneSnapshot, 'kind'>): boolean =>
  snapshot.kind !== 'manual' && snapshot.kind !== 'milestone' && snapshot.kind !== 'alternative';

/** A saved rewrite of one passage (4.97), not a copy of the whole scene. */
export const isPassageAlternative = (snapshot: Pick<SceneSnapshot, 'kind'>): boolean =>
  snapshot.kind === 'alternative';

const KIND_LABELS: Record<SceneSnapshotKind, string> = {
  manual: 'Snapshot',
  'before-ai': 'Automatic: before an AI revision',
  'before-restore': 'Automatic: before a restore',
  daily: 'Automatic: first edit of the day',
  'before-delete': 'Automatic: before the scene was deleted',
  milestone: 'Draft milestone',
  'before-rewrite': 'Automatic: before a rewrite was used',
  alternative: 'Passage alternative'
};

export const describeSnapshotKind = (kind: SceneSnapshotKind): string => KIND_LABELS[kind];

/** The list title: the author's name, or what kind of snapshot it is. */
export const snapshotTitle = (snapshot: SceneSnapshot): string =>
  snapshot.name?.trim() || describeSnapshotKind(snapshot.kind);

/** The automatic snapshots past the newest `keep` in `snapshots` (one scene's). */
export function selectSnapshotsToPrune(
  snapshots: readonly SceneSnapshot[],
  keep = AUTOMATIC_SNAPSHOTS_KEPT_PER_SCENE
): string[] {
  return snapshots
    .filter(isAutomaticSnapshot)
    .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
    .slice(keep)
    .map((snapshot) => snapshot.id);
}

/** A calendar day in the author's time zone, for "first edit of the day". */
export function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export interface TakeSceneSnapshotParams {
  projectId: string;
  sceneId: string;
  content: string;
  kind: SceneSnapshotKind;
  name?: string;
  sceneTitle?: string;
  now?: number;
}

/**
 * Saves a snapshot and prunes the scene's automatic ones in the same write.
 * An automatic snapshot of text identical to the newest snapshot is not
 * repeated: the newest one is returned instead. Manual and before-delete
 * snapshots are always taken.
 */
export async function takeSceneSnapshot(params: TakeSceneSnapshotParams): Promise<SceneSnapshot> {
  const existing = await getSceneSnapshots(params.projectId, params.sceneId);
  const alwaysTaken = params.kind === 'manual' || params.kind === 'before-delete';
  const newestOfScene = existing.find((snapshot) => !isPassageAlternative(snapshot));
  if (!alwaysTaken && newestOfScene?.content === params.content) return newestOfScene;
  const name = params.name?.trim();
  const sceneTitle = params.sceneTitle?.trim();
  const snapshot: SceneSnapshot = {
    id: crypto.randomUUID(),
    projectId: params.projectId,
    sceneId: params.sceneId,
    ...(sceneTitle ? {sceneTitle} : {}),
    content: params.content,
    ...(name ? {name} : {}),
    kind: params.kind,
    wordCount: countWords(params.content),
    createdAt: params.now ?? Date.now()
  };
  await saveSceneSnapshot(snapshot, selectSnapshotsToPrune([snapshot, ...existing]));
  return snapshot;
}

/**
 * The first edit of a scene each day saves the text as it was before it.
 * Nothing is saved for an empty scene or when a daily snapshot already
 * exists for today.
 */
export async function takeDailySceneSnapshotIfNeeded(params: {
  projectId: string;
  sceneId: string;
  sceneTitle?: string;
  savedContent: string;
  now?: number;
}): Promise<SceneSnapshot | null> {
  if (!manuscriptPlainText(params.savedContent)) return null;
  const now = params.now ?? Date.now();
  const today = localDayKey(now);
  const existing = await getSceneSnapshots(params.projectId, params.sceneId);
  if (existing.some((snapshot) => snapshot.kind === 'daily' && localDayKey(snapshot.createdAt) === today)) {
    return null;
  }
  return takeSceneSnapshot({...params, content: params.savedContent, kind: 'daily', now});
}

/**
 * Deleting a scene keeps its snapshots and first saves its last text, so the
 * deletion can be undone from a snapshot (author decision 2026-11-22). An
 * empty scene has nothing to keep.
 */
export async function takeSnapshotBeforeSceneDeletion(params: {
  projectId: string;
  sceneId: string;
  sceneTitle: string;
  content: string;
}): Promise<SceneSnapshot | null> {
  if (!manuscriptPlainText(params.content)) return null;
  return takeSceneSnapshot({...params, kind: 'before-delete'});
}

/**
 * Restoring first saves the current text as a snapshot, so a restore can
 * itself be restored away. Returns the text to put in the scene, or null
 * when the scene already matches the snapshot.
 */
export async function prepareSnapshotRestore(params: {
  projectId: string;
  sceneId: string;
  sceneTitle?: string;
  currentContent: string;
  snapshot: SceneSnapshot;
  now?: number;
}): Promise<string | null> {
  if (params.snapshot.sceneId !== params.sceneId) throw new Error('That snapshot belongs to another scene.');
  if (params.currentContent === params.snapshot.content) return null;
  await takeSceneSnapshot({
    projectId: params.projectId,
    sceneId: params.sceneId,
    sceneTitle: params.sceneTitle,
    content: params.currentContent,
    kind: 'before-restore',
    now: params.now
  });
  return params.snapshot.content;
}

export interface SnapshotComparison {
  /** The snapshot's words, with those since removed marked. */
  snapshot: WordDiffOp[];
  /** The current words, with those added since the snapshot marked. */
  current: WordDiffOp[];
  added: number;
  removed: number;
}

/** Words added and removed since the snapshot. */
export function compareSnapshotWithCurrent(snapshotHtml: string, currentHtml: string): SnapshotComparison {
  const ops = diffWords(
    tokenizeWords(manuscriptPlainText(snapshotHtml)),
    tokenizeWords(manuscriptPlainText(currentHtml))
  );
  return {
    snapshot: ops.filter((op) => op.kind !== 'added'),
    current: ops.filter((op) => op.kind !== 'removed'),
    ...countWordChanges(ops)
  };
}

/** The snapshot as plain text with paragraph breaks, for Copy. */
export const snapshotPlainText = (snapshot: Pick<SceneSnapshot, 'content'>): string =>
  manuscriptPlainText(snapshot.content);

/** A text's words, all unmarked, for showing without Compare. */
export const plainWordOps = (html: string): WordDiffOp[] =>
  tokenizeWords(manuscriptPlainText(html)).map((token) => ({kind: 'same', token}));

export const formatSnapshotTime = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'});

export const wordLabel = (count: number) => `${count.toLocaleString()} ${count === 1 ? 'word' : 'words'}`;
