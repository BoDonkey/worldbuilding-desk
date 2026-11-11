import {useLayoutEffect, useState} from 'react';
import type {useWorkspaceConsistency} from './useWorkspaceConsistency';
import type {useWorkspaceDocuments} from './useWorkspaceDocuments';
import type {useWorkspaceMemories} from './useWorkspaceMemories';
import type {useWorkspaceProjectData} from './useWorkspaceProjectData';

type DocumentsParams = Parameters<typeof useWorkspaceDocuments>[0];
type Consistency = ReturnType<typeof useWorkspaceConsistency>;

/**
 * The documents hook saves and deletes scenes, but review (from the
 * consistency hook, which needs the documents first) decides what a save
 * does. These refs let the documents hook call into review without the two
 * hooks depending on each other.
 */
export type DocumentReviewBridge = Pick<
  DocumentsParams,
  | 'persistDocRef'
  | 'refreshDeferredReviewRef'
  | 'setGuardrailIssuesRef'
  | 'setConsistencyPopoverRef'
  | 'deleteDocumentSideEffectsRef'
>;

/** Creates the empty bridge (stable across renders); pass it to `useWorkspaceDocuments`. */
export function useDocumentReviewBridge(): DocumentReviewBridge {
  const [bridge] = useState<DocumentReviewBridge>(() => ({
    persistDocRef: {current: null},
    refreshDeferredReviewRef: {current: null},
    setGuardrailIssuesRef: {current: null},
    setConsistencyPopoverRef: {current: null},
    deleteDocumentSideEffectsRef: {current: null}
  }));
  return bridge;
}

/**
 * Points the bridge at review once the consistency hook exists. Deleting a
 * scene also removes its search index entries and memories.
 */
export function useConnectDocumentReviewBridge(
  {
    persistDocRef,
    refreshDeferredReviewRef,
    setGuardrailIssuesRef,
    setConsistencyPopoverRef,
    deleteDocumentSideEffectsRef
  }: DocumentReviewBridge,
  {
    persistDoc,
    refreshDeferredReview,
    setGuardrailIssues,
    setConsistencyPopover,
    ragService,
    shodhService,
    refreshMemories
  }: {
    persistDoc: NonNullable<DocumentsParams['persistDocRef']['current']>;
    refreshDeferredReview: NonNullable<DocumentsParams['refreshDeferredReviewRef']['current']>;
    setGuardrailIssues: Consistency['setGuardrailIssues'];
    setConsistencyPopover: Consistency['setConsistencyPopover'];
    ragService: ReturnType<typeof useWorkspaceProjectData>['ragService'];
    shodhService: ReturnType<typeof useWorkspaceMemories>['shodhService'];
    refreshMemories: () => Promise<void>;
  }
) {
  useLayoutEffect(() => {
    persistDocRef.current = persistDoc;
    refreshDeferredReviewRef.current = refreshDeferredReview;
    setGuardrailIssuesRef.current =
      setGuardrailIssues as typeof setGuardrailIssuesRef.current;
    setConsistencyPopoverRef.current =
      setConsistencyPopover as typeof setConsistencyPopoverRef.current;
    deleteDocumentSideEffectsRef.current = async (docId: string) => {
      await Promise.all([
        ragService?.deleteDocument(docId) ?? Promise.resolve(),
        shodhService?.deleteMemoriesForDocument(docId) ?? Promise.resolve()
      ]);
      await refreshMemories();
    };
  }, [
    deleteDocumentSideEffectsRef,
    persistDoc,
    persistDocRef,
    ragService,
    refreshDeferredReview,
    refreshDeferredReviewRef,
    refreshMemories,
    setConsistencyPopover,
    setConsistencyPopoverRef,
    setGuardrailIssues,
    setGuardrailIssuesRef,
    shodhService
  ]);
}
