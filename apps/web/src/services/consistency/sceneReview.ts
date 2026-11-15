import type {
  CanonicalFact,
  Character,
  StateMutationEvent,
  StoredRuleset,
  WorldEntity,
  WritingDocument
} from '../../entityTypes';
import type {ActorResolution} from '../characters/characterIdentity';
import type {StateSubject} from '../state/stateSubjects';
import {findStateContinuityReviewItems} from '../state/stateContinuityReview';
import type {PlaceNameIndex} from '../worldBible/placePositions';
import type {ReviewIssueAnnotation} from '../worldEngine';
import {findCanonContradictions} from './contradictionReview';
import {
  getReviewIssueKey,
  makeReviewItemId,
  mapReviewAnnotationsByIssueKey,
  type ConsistencyReviewItem
} from './reviewReadiness';
import type {GuardrailIssue, KnownEntityRef} from './types';

/**
 * The single-scene review (3.53): the name issues the review engine found,
 * plus the accepted-canon contradiction and state-continuity findings, as one
 * list of review items. The draft refreshes, the scene save, and the project
 * review all build their items here.
 */

/** Project records the canon and state continuity checks read. */
export type SceneContinuityContext = {
  entities: WorldEntity[];
  characters: Character[];
  canonicalFacts: CanonicalFact[];
  knownEntities: KnownEntityRef[];
  stateSubjects: StateSubject[];
  actorResolutions: ActorResolution[];
  ruleset: StoredRuleset | null;
  stateMutationEvents: StateMutationEvent[];
  places: PlaceNameIndex;
  placeNamesKeptAsText?: string[];
};

/**
 * One review item per presented issue. Annotations pair with the engine's
 * raw `issues` by position, then are looked up by issue key, so issues the
 * caller filtered or downgraded keep their annotation.
 */
export function buildSceneIssueItems(params: {
  scene: WritingDocument;
  issues: GuardrailIssue[];
  issueAnnotations: ReviewIssueAnnotation[];
  presentedIssues: GuardrailIssue[];
}): ConsistencyReviewItem[] {
  const {scene, issues, issueAnnotations, presentedIssues} = params;
  const annotationsByIssueKey = mapReviewAnnotationsByIssueKey(issues, issueAnnotations);
  return presentedIssues.map((issue) => ({
    id: makeReviewItemId(scene.id, issue),
    sceneId: scene.id,
    sceneTitle: scene.title || 'Untitled scene',
    issue,
    reviewAnnotation: annotationsByIssueKey.get(getReviewIssueKey(issue))
  }));
}

/**
 * Contradiction then state-continuity items for `scenes`.
 * `sceneOrderDocuments` is the full manuscript order when `scenes` is a subset.
 */
export function findContinuityItems(params: {
  scenes: WritingDocument[];
  sceneOrderDocuments?: WritingDocument[];
  context: SceneContinuityContext;
}): ConsistencyReviewItem[] {
  const {scenes, sceneOrderDocuments, context} = params;
  return [
    ...findCanonContradictions({
      documents: scenes,
      sceneOrderDocuments,
      entities: context.entities,
      characters: context.characters,
      canonicalFacts: context.canonicalFacts,
      knownEntities: context.knownEntities
    }),
    ...findStateContinuityReviewItems({
      documents: scenes,
      sceneOrderDocuments,
      knownEntities: context.knownEntities,
      stateSubjects: context.stateSubjects,
      actorResolutions: context.actorResolutions,
      ruleset: context.ruleset,
      stateMutationEvents: context.stateMutationEvents,
      places: context.places,
      placeNamesKeptAsText: context.placeNamesKeptAsText
    })
  ];
}

export type SceneReview = {
  /** Name-review items from the engine's issues. */
  issueItems: ConsistencyReviewItem[];
  /** Canon contradiction and state-continuity items, without dismissed ones. */
  continuityItems: ConsistencyReviewItem[];
};

/** The full review of one scene. */
export function reviewScene(params: {
  scene: WritingDocument;
  sceneOrderDocuments: WritingDocument[];
  issues: GuardrailIssue[];
  issueAnnotations: ReviewIssueAnnotation[];
  presentedIssues: GuardrailIssue[];
  context: SceneContinuityContext;
  /** Continuity items the author dismissed this session. */
  isDismissed?: (itemId: string) => boolean;
}): SceneReview {
  const {scene, sceneOrderDocuments, context, isDismissed} = params;
  const continuityItems = findContinuityItems({
    scenes: [scene],
    sceneOrderDocuments,
    context
  });
  return {
    issueItems: buildSceneIssueItems(params),
    continuityItems: isDismissed
      ? continuityItems.filter((item) => !isDismissed(item.id))
      : continuityItems
  };
}
