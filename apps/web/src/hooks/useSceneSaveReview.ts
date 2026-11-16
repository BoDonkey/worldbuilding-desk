import {useCallback} from 'react';
import type {Dispatch, MutableRefObject, SetStateAction} from 'react';
import type {
  StateMutationEvent,
  StoredRuleset,
  WritingDocument
} from '../entityTypes';
import type {StateSubject} from '../services/state/stateSubjects';
import {
  saveWritingDocument,
  sortWritingDocuments
} from '../services/storage';
import {replaceSceneStateChangesBySource} from '../services/state/stateChangeSave';
import type {RAGProvider} from '../services/rag/RAGService';
import type {GuardrailIssue, KnownEntityRef} from '../services/consistency';
import type {WorldEngine} from '../services/worldEngine';
import type {ShodhMemoryProvider} from '../services/shodh/ShodhMemoryService';
import {htmlToPlainText} from '../utils/textHelpers';
import type {ActorResolution} from '../services/characters/characterIdentity';
import {buildDerivedStateMutationEvents} from '../services/state/stateMutationDerivation';
import type {ConsistencyReviewItem} from '../services/consistency/reviewReadiness';
import {
  reviewScene,
  type SceneContinuityContext
} from '../services/consistency/sceneReview';
import {survivesSceneRereview} from '../services/consistency/modelCanonCheck';
import {downgradeUnknownIssuesToWarnings} from '../services/consistency/sceneReviewHelpers';
import {hashString} from '../utils/hashString';

/**
 * Saving a scene: review it (strict saves can refuse), derive its state
 * changes, persist it, and index it for search and memory. Its review items
 * come from `reviewScene`, the same as the draft refreshes.
 */
export function useSceneSaveReview({
  documents,
  setDocuments,
  stateSubjects,
  actorResolutions,
  ruleset,
  stateMutationEvents,
  resolvedActionCues,
  worldEngine,
  ragService,
  shodhService,
  refreshMemories,
  setSelectedCreatedAt,
  setSaveStatus,
  setLastSavedAt,
  lastAutosaveErrorRef,
  knownConsistencyEntities,
  filterDismissedUnknownIssues,
  setGuardrailIssues,
  setConsistencyReviewItems,
  continuityContext,
  dismissedContinuityItemIdsRef
}: {
  documents: WritingDocument[];
  setDocuments: Dispatch<SetStateAction<WritingDocument[]>>;
  stateSubjects: StateSubject[];
  actorResolutions: ActorResolution[];
  ruleset: StoredRuleset | null;
  stateMutationEvents: StateMutationEvent[];
  resolvedActionCues: string[];
  worldEngine: WorldEngine;
  ragService: RAGProvider | null;
  shodhService: ShodhMemoryProvider | null;
  refreshMemories: () => Promise<void>;
  setSelectedCreatedAt: Dispatch<SetStateAction<number | null>>;
  setSaveStatus: Dispatch<SetStateAction<'idle' | 'saving' | 'saved'>>;
  setLastSavedAt: Dispatch<SetStateAction<number | null>>;
  lastAutosaveErrorRef: MutableRefObject<string | null>;
  knownConsistencyEntities: KnownEntityRef[];
  filterDismissedUnknownIssues: (docId: string, issues: GuardrailIssue[]) => GuardrailIssue[];
  setGuardrailIssues: Dispatch<SetStateAction<GuardrailIssue[]>>;
  setConsistencyReviewItems: Dispatch<SetStateAction<ConsistencyReviewItem[]>>;
  /** Project records the canon and state continuity checks read. */
  continuityContext: SceneContinuityContext;
  /** Continuity items dismissed this session; shared with the review runs. */
  dismissedContinuityItemIdsRef: MutableRefObject<Set<string>>;
}) {
  const persistDoc = useCallback(
    async (
      doc: WritingDocument,
      options?: {
        source?: 'workspace-save' | 'workspace-autosave' | 'import';
        consistencyMode?: 'strict' | 'balanced' | 'lenient';
      }
    ): Promise<{unresolvedCount: number; consistencyRun: boolean}> => {
      const source = options?.source ?? 'workspace-save';
      const consistencyMode = options?.consistencyMode ?? 'strict';
      const isImport = source === 'import';
      let unresolvedCount = 0;
      let continuityItems: ConsistencyReviewItem[] = [];

      if (isImport) {
        await saveWritingDocument(doc);
      }

      if (consistencyMode !== 'lenient') {
        try {
          const {proposal, validation, observations, issueAnnotations} =
            await worldEngine.reviewText({
              projectId: doc.projectId,
              text: htmlToPlainText(doc.content),
              source,
              knownEntities: knownConsistencyEntities,
              actionCues: resolvedActionCues
            });
          const presentedIssues =
            consistencyMode === 'strict'
              ? validation.issues
              : downgradeUnknownIssuesToWarnings(validation.issues);
          const dismissedPresentedIssues = filterDismissedUnknownIssues(
            doc.id,
            presentedIssues
          );
          // 3.53: the save used to add name items only, dropping the scene's
          // canon and state continuity items until another refresh ran.
          const review = reviewScene({
            scene: doc,
            sceneOrderDocuments: documents,
            issues: validation.issues,
            issueAnnotations,
            presentedIssues: dismissedPresentedIssues,
            context: continuityContext,
            isDismissed: (id) => dismissedContinuityItemIdsRef.current.has(id)
          });
          continuityItems = review.continuityItems;
          setGuardrailIssues(dismissedPresentedIssues);
          setConsistencyReviewItems((prev) => [
            ...prev.filter((item) => survivesSceneRereview(item, doc)),
            ...review.issueItems,
            ...review.continuityItems
          ]);
          unresolvedCount = validation.issues.filter(
            (issue) => issue.code === 'UNKNOWN_ENTITY'
          ).length;

          if (!validation.allowCommit && consistencyMode === 'strict' && !isImport) {
            const visibleUnknowns = validation.issues
              .map((issue) => issue.surface)
              .filter((surface): surface is string => Boolean(surface))
              .slice(0, 3);
            const suffix =
              validation.issues.length > 3
                ? ` (+${validation.issues.length - 3} more)`
                : '';
            const summary = visibleUnknowns.join(', ');
            throw new Error(
              `Scene save needs review first: ${validation.issues.length} unknown ${validation.issues.length === 1 ? 'name or world term' : 'names or world terms'} (${summary}${suffix}).`
            );
          }

          if (validation.allowCommit) {
            await worldEngine.applyAcceptedProposal(proposal, validation);
            const orderedDocuments = sortWritingDocuments(documents);
            const sceneOrder =
              orderedDocuments.findIndex((entry) => entry.id === doc.id) + 1;
            if (sceneOrder > 0) {
              try {
                const nextDerivedEvents = buildDerivedStateMutationEvents({
                  projectId: doc.projectId,
                  sceneId: doc.id,
                  sceneTitle: doc.title,
                  sceneOrder,
                  sourceRevision: doc.updatedAt,
                  sourceHash: hashString(doc.content),
                  observations,
                  stateSubjects,
                  actorResolutions,
                  ruleset,
                  existingEvents: stateMutationEvents
                });
                await replaceSceneStateChangesBySource({
                  projectId: doc.projectId,
                  sceneId: doc.id,
                  sourceType: 'deterministic-review',
                  nextEvents: nextDerivedEvents,
                  invalidationReason:
                    'Replaced deterministic review-derived state changes after scene save.'
                });
              } catch (error) {
                console.warn('State mutation derivation failed for scene', doc.id, error);
              }
            }
          }
        } catch (error) {
          if (!isImport) {
            throw error;
          }
          console.warn('Import review failed after scene persistence', doc.id, error);
        }
      }

      if (!isImport) {
        await saveWritingDocument(doc);
      }

      try {
        if (ragService) {
          await ragService.indexDocument(
            doc.id,
            doc.title || 'Untitled scene',
            doc.content,
            'scene'
          );
        }
      } catch (error) {
        console.warn('Indexing failed for scene', doc.id, error);
      }

      try {
        if (shodhService) {
          await shodhService.captureAutoMemory({
            projectId: doc.projectId,
            documentId: doc.id,
            title: doc.title || 'Untitled scene',
            content: doc.content,
            tags: ['scene']
          });
          await refreshMemories();
        }
      } catch (error) {
        console.warn('Auto-memory capture failed for scene', doc.id, error);
      }

      setDocuments((prev) => {
        const index = prev.findIndex((entry) => entry.id === doc.id);
        if (index === -1) {
          return sortWritingDocuments([...prev, doc]);
        }
        const copy = [...prev];
        copy[index] = doc;
        return sortWritingDocuments(copy);
      });

      setSelectedCreatedAt(doc.createdAt);
      setSaveStatus('saved');
      setLastSavedAt(Date.now());
      if (consistencyMode === 'strict' && !isImport) {
        // A strict save clears the scene's name items; continuity findings stay.
        setGuardrailIssues([]);
        setConsistencyReviewItems((prev) => [
          ...prev.filter((item) => survivesSceneRereview(item, doc)),
          ...continuityItems
        ]);
      }
      lastAutosaveErrorRef.current = null;
      return {
        unresolvedCount,
        consistencyRun: consistencyMode !== 'lenient'
      };
    },
    [
      setConsistencyReviewItems,
      setGuardrailIssues,
      filterDismissedUnknownIssues,
      continuityContext,
      dismissedContinuityItemIdsRef,
      documents,
      stateSubjects,
      actorResolutions,
      knownConsistencyEntities,
      ruleset,
      resolvedActionCues,
      ragService,
      shodhService,
      refreshMemories,
      stateMutationEvents,
      setDocuments,
      setLastSavedAt,
      setSaveStatus,
      setSelectedCreatedAt,
      lastAutosaveErrorRef,
      worldEngine
    ]
  );

  return persistDoc;
}
