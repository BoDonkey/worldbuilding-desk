import {useCallback, useEffect, useRef, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {
  CanonicalFact,
  Character,
  CharacterSheet,
  Project,
  StateMutationEvent,
  StoredRuleset,
  WorldEntity,
  WritingDocument
} from '../entityTypes';
import type {GuardrailIssue, KnownEntityRef} from '../services/consistency';
import {findCanonContradictions} from '../services/consistency';
import {
  hashReviewInputs,
  markStaleReviewItems,
  planIncrementalReview
} from '../services/consistency/incrementalReview';
import {
  getProjectReviewRun,
  saveProjectReviewRun,
  type ProjectReviewRun,
  type StoredSceneReview
} from '../services/consistency/projectReviewRunStorage';
import type {WorldEngine, WorldEngineStatus} from '../services/worldEngine';
import {htmlToPlainText} from '../utils/textHelpers';
import type {ActorResolution} from '../services/characters/characterIdentity';
import {findStateContinuityReviewItems} from '../services/state/stateContinuityReview';
import {
  getReviewIssueKey,
  makeReviewItemId,
  mapReviewAnnotationsByIssueKey,
  type ConsistencyReviewItem
} from '../services/consistency/reviewReadiness';
import {
  downgradeUnknownIssuesToWarnings,
  getReviewSourceForDocument
} from '../services/consistency/sceneReviewHelpers';
import {
  isModelCheckItem,
  pruneModelCheckItems,
  survivesSceneRereview
} from '../services/consistency/modelCanonCheck';
import {describeError} from '../services/errors';
import {useStatusAnnouncement} from './useStatusAnnouncement';

export type ConsistencyFeedbackState = {
  tone: 'success' | 'error';
  message: string;
} | null;

export type ConsistencyFeedback = Dispatch<SetStateAction<ConsistencyFeedbackState>>;

export type ConsistencySystemHistory = (input: {
  category: 'scene' | 'consistency' | 'resource' | 'quest' | 'system';
  message: string;
  insertText?: string;
  sceneId?: string;
}) => void;

/**
 * Review runs: the deferred and active-draft refreshes for one scene, the
 * project review across all scenes (incremental, persisted, restored on
 * load with stale marking, 4.25), and dismissing a review item.
 */
export function useConsistencyReviewRuns({
  activeProject,
  documents,
  entities,
  characters,
  canonicalFacts,
  characterSheets,
  actorResolutions,
  ruleset,
  stateMutationEvents,
  resolvedActionCues,
  worldEngine,
  setFeedback,
  addSystemHistory,
  knownConsistencyEntities,
  filterDismissedUnknownIssues,
  setGuardrailIssues,
  consistencyReviewItems,
  setConsistencyReviewItems
}: {
  activeProject: Project | null;
  documents: WritingDocument[];
  entities: WorldEntity[];
  characters: Character[];
  canonicalFacts: CanonicalFact[];
  characterSheets: CharacterSheet[];
  actorResolutions: ActorResolution[];
  ruleset: StoredRuleset | null;
  stateMutationEvents: StateMutationEvent[];
  resolvedActionCues: string[];
  worldEngine: WorldEngine;
  setFeedback: ConsistencyFeedback;
  addSystemHistory: ConsistencySystemHistory;
  knownConsistencyEntities: KnownEntityRef[];
  filterDismissedUnknownIssues: (docId: string, issues: GuardrailIssue[]) => GuardrailIssue[];
  setGuardrailIssues: Dispatch<SetStateAction<GuardrailIssue[]>>;
  consistencyReviewItems: ConsistencyReviewItem[];
  setConsistencyReviewItems: Dispatch<SetStateAction<ConsistencyReviewItem[]>>;
}) {
  const [isRunningConsistencyReview, setIsRunningConsistencyReview] = useState(false);
  const announceStatus = useStatusAnnouncement();
  const documentsRef = useRef(documents);
  const dismissedContinuityItemIdsRef = useRef(new Set<string>());
  const [lastConsistencyReviewAt, setLastConsistencyReviewAt] = useState<number | null>(
    null
  );
  const [storedReviewScenes, setStoredReviewScenes] = useState<StoredSceneReview[]>([]);
  const storedReviewRunRef = useRef<ProjectReviewRun | null>(null);
  const [worldEngineStatus, setWorldEngineStatus] =
    useState<WorldEngineStatus | null>(null);

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  useEffect(() => {
    let cancelled = false;
    void worldEngine
      .getStatus()
      .then((status) => {
        if (!cancelled) {
          setWorldEngineStatus(status);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setWorldEngineStatus({
            state: 'installedUnavailable',
            reason:
              describeError(error, 'Review engine status could not be checked.')
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [worldEngine]);

  // 4.25: restore the last project review for this project so the queue
  // survives a reload; stale marking happens as scenes load or change.
  useEffect(() => {
    if (!activeProject) {
      storedReviewRunRef.current = null;
      setStoredReviewScenes([]);
      setConsistencyReviewItems([]);
      setLastConsistencyReviewAt(null);
      return;
    }
    let cancelled = false;
    void getProjectReviewRun(activeProject.id)
      .then((run) => {
        if (cancelled) return;
        storedReviewRunRef.current = run;
        if (!run) {
          setStoredReviewScenes([]);
          return;
        }
        setStoredReviewScenes(run.scenes);
        setConsistencyReviewItems([...run.items, ...(run.modelCheckItems ?? [])]);
        setLastConsistencyReviewAt(run.reviewedAt || null);
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('Could not restore the last project review.', error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [setConsistencyReviewItems, activeProject]);

  useEffect(() => {
    if (storedReviewScenes.length === 0) return;
    setConsistencyReviewItems((prev) =>
      // Model-assisted items are not tied to a review run; they expire by quote instead.
      prev.length === 0
        ? prev
        : [
            ...markStaleReviewItems({
              items: prev.filter((item) => !isModelCheckItem(item)),
              documents,
              storedScenes: storedReviewScenes
            }),
            ...prev.filter(isModelCheckItem)
          ]
    );
  }, [setConsistencyReviewItems, documents, storedReviewScenes]);

  // Read at the end of an async project review, so items added during it are kept.
  const consistencyReviewItemsRef = useRef(consistencyReviewItems);
  useEffect(() => {
    consistencyReviewItemsRef.current = consistencyReviewItems;
  }, [consistencyReviewItems]);

  // A saved scene that no longer contains a model-assisted item's quote drops it.
  useEffect(() => {
    if (documents.length === 0) return;
    setConsistencyReviewItems((prev) => {
      const next = pruneModelCheckItems(prev, documents);
      return next.length === prev.length ? prev : next;
    });
  }, [documents, setConsistencyReviewItems]);

  const refreshDeferredReview = useCallback(
    async (doc: WritingDocument) => {
      const {validation, issueAnnotations} = await worldEngine.reviewText({
        projectId: doc.projectId,
        text: htmlToPlainText(doc.content),
        source: getReviewSourceForDocument(doc),
        knownEntities: knownConsistencyEntities,
        actionCues: resolvedActionCues
      });
      const annotationsByIssueKey = mapReviewAnnotationsByIssueKey(
        validation.issues,
        issueAnnotations
      );
      const presentedIssues = filterDismissedUnknownIssues(
        doc.id,
        downgradeUnknownIssuesToWarnings(validation.issues)
      );
      const contradictionItems = findCanonContradictions({
        documents: [doc],
        sceneOrderDocuments: documentsRef.current,
        entities,
        characters,
        canonicalFacts,
        knownEntities: knownConsistencyEntities
      });
      const stateContinuityItems = findStateContinuityReviewItems({
        documents: [doc],
        sceneOrderDocuments: documentsRef.current,
        knownEntities: knownConsistencyEntities,
        characterSheets,
        actorResolutions,
        ruleset,
        stateMutationEvents
      });
      setGuardrailIssues(presentedIssues);
      setConsistencyReviewItems((prev) => [
        ...prev.filter((item) => survivesSceneRereview(item, doc)),
        ...presentedIssues.map((issue) => ({
          id: makeReviewItemId(doc.id, issue),
          sceneId: doc.id,
          sceneTitle: doc.title || 'Untitled scene',
          issue,
          reviewAnnotation: annotationsByIssueKey.get(getReviewIssueKey(issue))
        })),
        ...contradictionItems.filter(
          (item) => !dismissedContinuityItemIdsRef.current.has(item.id)
        ),
        ...stateContinuityItems.filter(
          (item) => !dismissedContinuityItemIdsRef.current.has(item.id)
        )
      ]);
    },
    [
      setConsistencyReviewItems,
      setGuardrailIssues,
      filterDismissedUnknownIssues,
      canonicalFacts,
      characterSheets,
      characters,
      entities,
      knownConsistencyEntities,
      actorResolutions,
      resolvedActionCues,
      ruleset,
      stateMutationEvents,
      worldEngine
    ]
  );

  const refreshActiveDraftReview = useCallback(
    async (doc: WritingDocument) => {
      setIsRunningConsistencyReview(true);
      announceStatus('Refreshing consistency review.');
      try {
        const {validation, issueAnnotations} = await worldEngine.reviewText({
          projectId: doc.projectId,
          text: htmlToPlainText(doc.content),
          source: 'workspace-autosave',
          knownEntities: knownConsistencyEntities,
          actionCues: resolvedActionCues
        });
        const presentedIssues = filterDismissedUnknownIssues(
          doc.id,
          downgradeUnknownIssuesToWarnings(validation.issues)
        );
        const annotationsByIssueKey = mapReviewAnnotationsByIssueKey(
          validation.issues,
          issueAnnotations
        );
        const contradictionItems = findCanonContradictions({
          documents: [doc],
          sceneOrderDocuments: documentsRef.current,
          entities,
          characters,
          canonicalFacts,
          knownEntities: knownConsistencyEntities
        });
        const stateContinuityItems = findStateContinuityReviewItems({
          documents: [doc],
          sceneOrderDocuments: documentsRef.current,
          knownEntities: knownConsistencyEntities,
          characterSheets,
          actorResolutions,
          ruleset,
          stateMutationEvents
        });
        setGuardrailIssues(presentedIssues);
        setConsistencyReviewItems((prev) => [
          ...prev.filter((item) => survivesSceneRereview(item, doc)),
          ...presentedIssues.map((issue) => ({
            id: makeReviewItemId(doc.id, issue),
            sceneId: doc.id,
            sceneTitle: doc.title || 'Untitled scene',
            issue,
            reviewAnnotation: annotationsByIssueKey.get(getReviewIssueKey(issue))
          })),
          ...contradictionItems.filter(
            (item) => !dismissedContinuityItemIdsRef.current.has(item.id)
          ),
          ...stateContinuityItems.filter(
            (item) => !dismissedContinuityItemIdsRef.current.has(item.id)
          )
        ]);
        announceStatus('Consistency review refreshed.');
      } finally {
        setIsRunningConsistencyReview(false);
      }
    },
    [
      setConsistencyReviewItems,
      setGuardrailIssues,
      announceStatus,
      filterDismissedUnknownIssues,
      canonicalFacts,
      characterSheets,
      characters,
      entities,
      knownConsistencyEntities,
      actorResolutions,
      resolvedActionCues,
      ruleset,
      stateMutationEvents,
      worldEngine
    ]
  );

  const handleRunConsistencyReview = useCallback(async () => {
    if (!activeProject) return;
    if (documents.length === 0) {
      setConsistencyReviewItems([]);
      setLastConsistencyReviewAt(Date.now());
      setFeedback({tone: 'error', message: 'No scenes available to review.'});
      addSystemHistory({
        category: 'consistency',
        message: 'Consistency review skipped: no scenes available.'
      });
      return;
    }

    setIsRunningConsistencyReview(true);
    dismissedContinuityItemIdsRef.current.clear();
    setFeedback(null);
    announceStatus('Running consistency review.');
    try {
      const items: ConsistencyReviewItem[] = [];
      const inputsHash = hashReviewInputs({
        knownEntities: knownConsistencyEntities,
        actionCues: resolvedActionCues,
        engineLabel:
          worldEngineStatus?.state === 'available'
            ? `local-ai:${worldEngineStatus.modelLabel}`
            : 'deterministic'
      });
      const plan = planIncrementalReview({
        documents,
        storedRun: storedReviewRunRef.current,
        inputsHash
      });
      const reviewedAt = Date.now();
      const nextStoredScenes: StoredSceneReview[] = [];
      for (const doc of documents) {
        const reused = plan.reusable.get(doc.id);
        let issues: GuardrailIssue[];
        let issueAnnotations: StoredSceneReview['issueAnnotations'];
        if (reused) {
          issues = reused.issues;
          issueAnnotations = reused.issueAnnotations;
          nextStoredScenes.push(reused);
        } else {
          const result = await worldEngine.reviewText({
            projectId: activeProject.id,
            text: htmlToPlainText(doc.content),
            source: getReviewSourceForDocument(doc),
            knownEntities: knownConsistencyEntities,
            actionCues: resolvedActionCues
          });
          issues = result.validation.issues;
          issueAnnotations = result.issueAnnotations;
          nextStoredScenes.push({
            sceneId: doc.id,
            contentHash: plan.contentHashById.get(doc.id) ?? '',
            issues,
            issueAnnotations,
            reviewedAt
          });
        }
        const annotationsByIssueKey = mapReviewAnnotationsByIssueKey(
          issues,
          issueAnnotations
        );
        const presentedIssues = filterDismissedUnknownIssues(doc.id, issues);
        presentedIssues.forEach((issue) => {
          items.push({
            id: makeReviewItemId(doc.id, issue),
            sceneId: doc.id,
            sceneTitle: doc.title || 'Untitled scene',
            issue,
            reviewAnnotation: annotationsByIssueKey.get(getReviewIssueKey(issue))
          });
        });
      }

      const contradictionItems = findCanonContradictions({
        documents,
        entities,
        characters,
        canonicalFacts,
        knownEntities: knownConsistencyEntities
      });
      const stateContinuityItems = findStateContinuityReviewItems({
        documents,
        knownEntities: knownConsistencyEntities,
        characterSheets,
        actorResolutions,
        ruleset,
        stateMutationEvents
      });
      const continuityItems = [...contradictionItems, ...stateContinuityItems];
      const combinedItems = [...items, ...continuityItems];

      // Model-assisted items come from explicit checks, not this run: keep the live ones.
      const modelCheckItems = pruneModelCheckItems(
        consistencyReviewItemsRef.current.filter(isModelCheckItem),
        documents
      );
      setConsistencyReviewItems([...combinedItems, ...modelCheckItems]);
      setLastConsistencyReviewAt(reviewedAt);
      const nextRun: ProjectReviewRun = {
        id: activeProject.id,
        projectId: activeProject.id,
        inputsHash,
        reviewedAt,
        scenes: nextStoredScenes,
        items: combinedItems,
        modelCheckItems
      };
      storedReviewRunRef.current = nextRun;
      setStoredReviewScenes(nextStoredScenes);
      void saveProjectReviewRun(nextRun).catch((error) => {
        console.warn('Could not persist the project review.', error);
      });
      if (combinedItems.length === 0) {
        setFeedback({
          tone: 'success',
          message: `Consistency review complete: no issues across ${documents.length} scene(s).`
        });
        addSystemHistory({
          category: 'consistency',
          message: `Consistency review complete with no issues across ${documents.length} scene(s).`
        });
      } else {
        const continuityCount = continuityItems.length;
        const firstSceneId = combinedItems[0]?.sceneId;
        const message =
          `Project review found ${combinedItems.length} item(s) across ${documents.length} scene(s).` +
          (continuityCount > 0
            ? ` ${continuityCount} accepted canon/state continuity finding${continuityCount === 1 ? '' : 's'}.`
            : '');
        setFeedback({tone: 'error', message});
        addSystemHistory({
          category: 'consistency',
          message,
          sceneId: firstSceneId
        });
      }
    } catch (error) {
      const message =
        describeError(error, 'Unable to run consistency review.');
      setFeedback({tone: 'error', message});
    } finally {
      setIsRunningConsistencyReview(false);
      announceStatus('Consistency review finished.');
    }
  }, [
    setConsistencyReviewItems,
    announceStatus,
    activeProject,
    addSystemHistory,
    canonicalFacts,
    characterSheets,
    characters,
    documents,
    entities,
    actorResolutions,
    worldEngineStatus,
    filterDismissedUnknownIssues,
    knownConsistencyEntities,
    resolvedActionCues,
    ruleset,
    setFeedback,
    stateMutationEvents,
    worldEngine
  ]);

  const dismissConsistencyReviewItem = useCallback((itemId: string) => {
    const item = consistencyReviewItems.find((entry) => entry.id === itemId);
    if (item?.issue.code === 'STATE_CONFLICT' || item?.issue.code === 'INVALID_MUTATION') {
      dismissedContinuityItemIdsRef.current.add(itemId);
    }
    setConsistencyReviewItems((prev) =>
      prev.filter((item) => item.id !== itemId)
    );
    const storedRun = storedReviewRunRef.current;
    if (storedRun) {
      const nextRun = {
        ...storedRun,
        items: storedRun.items.filter((entry) => entry.id !== itemId),
        modelCheckItems: (storedRun.modelCheckItems ?? []).filter((entry) => entry.id !== itemId)
      };
      storedReviewRunRef.current = nextRun;
      void saveProjectReviewRun(nextRun).catch((error) => {
        console.warn('Could not persist the dismissed review item.', error);
      });
    }
  }, [setConsistencyReviewItems, consistencyReviewItems]);

  /**
   * Adds a confirmed canon check's items for a scene, replacing that scene's
   * earlier model-assisted items, and saves them with the project review run
   * (creating a run record that holds only them if no review has run yet).
   */
  const addModelCheckItems = useCallback(
    (sceneId: string, items: ConsistencyReviewItem[]) => {
      if (!activeProject) return;
      const keep = (entry: ConsistencyReviewItem) => !(isModelCheckItem(entry) && entry.sceneId === sceneId);
      setConsistencyReviewItems((prev) => [...prev.filter(keep), ...items]);
      const base: ProjectReviewRun = storedReviewRunRef.current ?? {
        id: activeProject.id,
        projectId: activeProject.id,
        inputsHash: '',
        reviewedAt: 0,
        scenes: [],
        items: []
      };
      const nextRun: ProjectReviewRun = {
        ...base,
        modelCheckItems: [...(base.modelCheckItems ?? []).filter(keep), ...items]
      };
      storedReviewRunRef.current = nextRun;
      void saveProjectReviewRun(nextRun).catch((error) => {
        console.warn('Could not persist the canon check results.', error);
      });
    },
    [activeProject, setConsistencyReviewItems]
  );

  return {
    isRunningConsistencyReview,
    lastConsistencyReviewAt,
    worldEngineStatus,
    refreshDeferredReview,
    refreshActiveDraftReview,
    handleRunConsistencyReview,
    dismissConsistencyReviewItem,
    addModelCheckItems
  };
}
