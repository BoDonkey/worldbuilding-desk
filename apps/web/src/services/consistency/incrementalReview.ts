import type {WritingDocument} from '../../entityTypes';
import {htmlToPlainText} from '../../utils/textHelpers';
import type {ProjectReviewRun, StoredSceneReview} from './projectReviewRunStorage';
import type {ConsistencyReviewItem} from './reviewReadiness';
import type {KnownEntityRef} from './types';

/**
 * Pure helpers for persisted, incremental project review (slice 4.25).
 * A scene is re-reviewed only when its text or the non-text inputs (known
 * entities, action cues, engine) changed since the stored run. Canon
 * contradictions are always recomputed by the caller because accepted
 * canon may have changed without any scene changing.
 */

export const hashReviewString = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return `h${(hash >>> 0).toString(16)}`;
};

export const hashSceneContent = (
  doc: Pick<WritingDocument, 'content' | 'consistencyReviewMode'>
): string => hashReviewString(`${doc.consistencyReviewMode ?? 'active'}|${htmlToPlainText(doc.content)}`);

export const hashReviewInputs = (params: {
  knownEntities: KnownEntityRef[];
  actionCues: string[];
  engineLabel: string;
}): string =>
  hashReviewString(
    JSON.stringify({
      engine: params.engineLabel,
      cues: [...params.actionCues].sort(),
      entities: [...params.knownEntities].map((entity) => `${entity.id} ${entity.name} ${entity.type}`).sort()
    })
  );

export interface IncrementalReviewPlan {
  reusable: Map<string, StoredSceneReview>;
  toReview: WritingDocument[];
  contentHashById: Map<string, string>;
}

export function planIncrementalReview(params: {
  documents: WritingDocument[];
  storedRun: ProjectReviewRun | null;
  inputsHash: string;
}): IncrementalReviewPlan {
  const reusable = new Map<string, StoredSceneReview>();
  const toReview: WritingDocument[] = [];
  const contentHashById = new Map<string, string>();
  const storedByScene = new Map(
    params.storedRun && params.storedRun.inputsHash === params.inputsHash
      ? params.storedRun.scenes.map((scene) => [scene.sceneId, scene] as const)
      : []
  );
  params.documents.forEach((doc) => {
    const contentHash = hashSceneContent(doc);
    contentHashById.set(doc.id, contentHash);
    const stored = storedByScene.get(doc.id);
    if (stored && stored.contentHash === contentHash) {
      reusable.set(doc.id, stored);
    } else {
      toReview.push(doc);
    }
  });
  return {reusable, toReview, contentHashById};
}

/** Flags items whose scene text no longer matches the stored hash, or whose scene is gone. */
export function markStaleReviewItems(params: {
  items: ConsistencyReviewItem[];
  documents: WritingDocument[];
  storedScenes: StoredSceneReview[];
}): ConsistencyReviewItem[] {
  const storedHashById = new Map(params.storedScenes.map((scene) => [scene.sceneId, scene.contentHash]));
  const currentHashById = new Map(params.documents.map((doc) => [doc.id, hashSceneContent(doc)]));
  return params.items.map((item) => {
    const stored = storedHashById.get(item.sceneId);
    const current = currentHashById.get(item.sceneId);
    const stale = stored === undefined || current === undefined || stored !== current;
    return stale === Boolean(item.staleSinceReview) ? item : {...item, staleSinceReview: stale};
  });
}

export function countStaleReviewItems(items: ConsistencyReviewItem[]): number {
  return items.reduce((count, item) => count + (item.staleSinceReview ? 1 : 0), 0);
}
