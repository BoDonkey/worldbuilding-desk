import {openDb, PROJECT_REVIEW_RUN_STORE_NAME} from '../../db';
import type {ReviewIssueAnnotation} from '../worldEngine/types';
import type {ConsistencyReviewItem} from './reviewReadiness';
import type {GuardrailIssue} from './types';

/**
 * The last project review per project (roadmap slice 4.25). One record per
 * project, keyed by project id. Stores the per-scene deterministic results
 * keyed by content hash so an unchanged scene is not re-reviewed, and the
 * combined item list so the review queue restores after a reload. Not part
 * of project backups: the snapshot carries accepted canon (aliases, facts,
 * state), not review output, and a restored project re-runs review.
 */

export interface StoredSceneReview {
  sceneId: string;
  contentHash: string;
  issues: GuardrailIssue[];
  issueAnnotations: ReviewIssueAnnotation[];
  reviewedAt: number;
}

export interface ProjectReviewRun {
  /** Equals `projectId`; one run per project. */
  id: string;
  projectId: string;
  /** Hash of the non-text review inputs (known entities, action cues, engine). */
  inputsHash: string;
  /** 0 when no project review has run yet and the record only holds model-assisted items. */
  reviewedAt: number;
  scenes: StoredSceneReview[];
  items: ConsistencyReviewItem[];
  /**
   * Model-assisted canon check items the author added to review (4.38/4.53).
   * Kept apart from `items` because they come from an explicit check, not
   * from the review run, and survive re-reviews while their quote remains.
   */
  modelCheckItems?: ConsistencyReviewItem[];
}

export async function getProjectReviewRun(projectId: string): Promise<ProjectReviewRun | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_REVIEW_RUN_STORE_NAME, 'readonly');
    const request = tx.objectStore(PROJECT_REVIEW_RUN_STORE_NAME).get(projectId);
    request.onsuccess = () => resolve((request.result as ProjectReviewRun | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProjectReviewRun(run: ProjectReviewRun): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_REVIEW_RUN_STORE_NAME, 'readwrite');
    const request = tx.objectStore(PROJECT_REVIEW_RUN_STORE_NAME).put(run);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteProjectReviewRun(projectId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECT_REVIEW_RUN_STORE_NAME, 'readwrite');
    const request = tx.objectStore(PROJECT_REVIEW_RUN_STORE_NAME).delete(projectId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
