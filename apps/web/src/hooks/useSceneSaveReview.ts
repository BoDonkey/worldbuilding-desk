import {useCallback} from 'react';
import type {Dispatch, MutableRefObject, SetStateAction} from 'react';
import type {
  CharacterSheet,
  StateMutationEvent,
  StoredRuleset,
  WritingDocument
} from '../entityTypes';
import {saveWritingDocument, sortWritingDocuments} from '../writingStorage';
import type {RAGProvider} from '../services/rag/RAGService';
import type {GuardrailIssue, KnownEntityRef} from '../services/consistency';
import type {WorldEngine} from '../services/worldEngine';
import type {ShodhMemoryProvider} from '../services/shodh/ShodhMemoryService';
import {htmlToPlainText} from '../utils/textHelpers';
import type {ActorResolution} from '../services/characters/characterIdentity';
import {buildDerivedStateMutationEvents} from '../services/state/stateMutationDerivation';
import {replaceSceneStateMutationEventsBySourceType} from '../services/state/stateMutationLedger';
import {
  getReviewIssueKey,
  makeReviewItemId,
  mapReviewAnnotationsByIssueKey,
  type ConsistencyReviewItem
} from '../services/consistency/reviewReadiness';
import {downgradeUnknownIssuesToWarnings, hashString} from '../services/consistency/sceneReviewHelpers';

/**
 * Saving a scene: review it (strict saves can refuse), derive its state
 * changes, persist it, and index it for search and memory.
 */
export function useSceneSaveReview({
  documents,
  setDocuments,
  characterSheets,
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
  setConsistencyReviewItems
}: {
  documents: WritingDocument[];
  setDocuments: Dispatch<SetStateAction<WritingDocument[]>>;
  characterSheets: CharacterSheet[];
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
          const annotationsByIssueKey = mapReviewAnnotationsByIssueKey(
            validation.issues,
            issueAnnotations
          );
          const dismissedPresentedIssues = filterDismissedUnknownIssues(
            doc.id,
            presentedIssues
          );
          setGuardrailIssues(dismissedPresentedIssues);
          setConsistencyReviewItems((prev) => [
            ...prev.filter((item) => item.sceneId !== doc.id),
            ...dismissedPresentedIssues.map((issue) => ({
              id: makeReviewItemId(doc.id, issue),
              sceneId: doc.id,
              sceneTitle: doc.title || 'Untitled scene',
              issue,
              reviewAnnotation: annotationsByIssueKey.get(getReviewIssueKey(issue))
            }))
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
                  characterSheets,
                  actorResolutions,
                  ruleset,
                  existingEvents: stateMutationEvents
                });
                await replaceSceneStateMutationEventsBySourceType({
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
        setGuardrailIssues([]);
        setConsistencyReviewItems((prev) =>
          prev.filter((item) => item.sceneId !== doc.id)
        );
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
      documents,
      characterSheets,
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
