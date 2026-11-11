import {useEffect, useMemo, useRef} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {EntityCategory, WritingDocument} from '../../entityTypes';
import type {useModelCanonCheck} from '../../hooks/useModelCanonCheck';
import type {
  StateMutationReviewItem,
  useWorkspaceConsistency
} from '../../hooks/useWorkspaceConsistency';
import type {ConsistencyReviewItem} from '../../services/consistency/reviewReadiness';
import styles from '../../styles/WorkspaceRoute.module.css';
import {CanonCheckPanel} from './CanonCheckPanel';
import {WorkspaceReviewIssueItem} from './WorkspaceReviewIssueItem';
import {WorkspaceStateChangeReview} from './WorkspaceStateChangeReview';

/** What the Workspace route gives the Review tab. */
export interface WorkspaceReviewInputs {
  consistency: ReturnType<typeof useWorkspaceConsistency>;
  /** Runs a project review and shows the review banner again. */
  onRunReview: () => Promise<void>;
  editStateMutationReviewItem: (item: StateMutationReviewItem) => void;
  onFocusReviewItem: (item: ConsistencyReviewItem) => void;
  activeReviewItemId: string | null;
  createLabel: string;
  linkLabel: string;
  /** Shared with the editor's review popover, so a draft name follows the item. */
  worldCaptureDrafts: Record<string, string>;
  setWorldCaptureDrafts: Dispatch<SetStateAction<Record<string, string>>>;
}

/** Kept by the drawer so it survives switching tabs. */
export interface WorkspaceReviewTabState {
  canonCheck: ReturnType<typeof useModelCanonCheck>;
  expandedReviewActionId: string | null;
  setExpandedReviewActionId: Dispatch<SetStateAction<string | null>>;
  rejectedAliasSuggestions: Record<string, string[]>;
  setRejectedAliasSuggestions: Dispatch<SetStateAction<Record<string, string[]>>>;
}

interface WorkspaceReviewTabProps {
  review: WorkspaceReviewInputs;
  tabState: WorkspaceReviewTabState;
  categories: EntityCategory[];
  documents: WritingDocument[];
  selectedId: string | null;
  currentDocument: WritingDocument | null;
  handleSelectDocument: (doc: WritingDocument) => void;
  openWorldRecord: (target: {id: string; type: 'character' | 'entity'}) => void;
}

/**
 * The context drawer's Review tab: run a project review, the model-assisted
 * canon check for the open scene, review issues (the open scene's first,
 * the active one on top and scrolled into view), and suggested state changes.
 */
export function WorkspaceReviewTab({
  review,
  tabState,
  categories,
  documents,
  selectedId,
  currentDocument,
  handleSelectDocument,
  openWorldRecord
}: WorkspaceReviewTabProps) {
  const {consistency, activeReviewItemId, onFocusReviewItem} = review;
  const {
    isRunningConsistencyReview,
    lastConsistencyReviewAt,
    consistencyReviewItems,
    stateMutationReviewItems,
    hiddenStateMutationReviewCount,
    reviewReadiness,
    restoreAllHiddenStateMutationReviewItems
  } = consistency;
  const {canonCheck, expandedReviewActionId, setExpandedReviewActionId} = tabState;
  const activeReviewItemRef = useRef<HTMLLIElement | null>(null);

  const orderedConsistencyReviewItems = useMemo(() => {
    const activeItem = activeReviewItemId
      ? consistencyReviewItems.find((item) => item.id === activeReviewItemId) ?? null
      : null;
    return activeItem
      ? [
          activeItem,
          ...consistencyReviewItems.filter((item) => item.id !== activeItem.id)
        ]
      : consistencyReviewItems;
  }, [activeReviewItemId, consistencyReviewItems]);
  const staleReviewItemCount = useMemo(
    () => consistencyReviewItems.filter((item) => item.staleSinceReview).length,
    [consistencyReviewItems]
  );
  const currentDocumentReviewItems = useMemo(
    () =>
      selectedId
        ? orderedConsistencyReviewItems.filter((item) => item.sceneId === selectedId)
        : orderedConsistencyReviewItems,
    [orderedConsistencyReviewItems, selectedId]
  );
  const otherDocumentReviewItems = useMemo(
    () =>
      selectedId
        ? orderedConsistencyReviewItems.filter((item) => item.sceneId !== selectedId)
        : [],
    [orderedConsistencyReviewItems, selectedId]
  );
  useEffect(() => {
    if (!activeReviewItemId) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      activeReviewItemRef.current?.scrollIntoView({
        block: 'start',
        behavior: 'auto'
      });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeReviewItemId, currentDocumentReviewItems, otherDocumentReviewItems]);

  const renderIssue = (item: ConsistencyReviewItem) => {
    const isActive = activeReviewItemId === item.id;
    return (
      <WorkspaceReviewIssueItem
        key={item.id}
        item={item}
        consistency={consistency}
        categories={categories}
        isActive={isActive}
        isExpanded={expandedReviewActionId === item.id || isActive}
        activeItemRef={activeReviewItemRef}
        onShowContext={(target) => {
          onFocusReviewItem(target);
          setExpandedReviewActionId(target.id);
        }}
        createLabel={review.createLabel}
        linkLabel={review.linkLabel}
        worldCaptureDrafts={review.worldCaptureDrafts}
        setWorldCaptureDrafts={review.setWorldCaptureDrafts}
        rejectedAliasSuggestions={tabState.rejectedAliasSuggestions}
        setRejectedAliasSuggestions={tabState.setRejectedAliasSuggestions}
        openWorldRecord={openWorldRecord}
      />
    );
  };

  return (
    <div className={styles.contextSummary}>
      <div className={styles.contextSummaryText}>
        <strong>Project Review</strong>
        <div className={styles.consistencyDescription}>
          Scans every scene for names and canon references that are not already
          tracked. Known canon can underline while you type; new names appear here
          after review runs.
        </div>
      </div>
      <div className={styles.consistencyPanelHeader}>
        <button
          type='button'
          onClick={() => void review.onRunReview()}
          disabled={isRunningConsistencyReview}
        >
          {isRunningConsistencyReview ? 'Running project review...' : 'Run project review'}
        </button>
      </div>
      <CanonCheckPanel check={canonCheck} sceneTitle={currentDocument ? currentDocument.title : null} />
      {lastConsistencyReviewAt && (
        <div className={styles.consistencyLastRun}>
          Last run: {new Date(lastConsistencyReviewAt).toLocaleString()}
          {staleReviewItemCount > 0
            ? ` · ${staleReviewItemCount} item${staleReviewItemCount === 1 ? '' : 's'} from scenes changed since`
            : ''}
        </div>
      )}
      {hiddenStateMutationReviewCount > 0 && (
        <div className={styles.consistencyDescription}>
          {hiddenStateMutationReviewCount} hidden suggested state change
          {hiddenStateMutationReviewCount === 1 ? '' : 's'} kept out of the active queue.
          {' '}
          <button
            type='button'
            onClick={restoreAllHiddenStateMutationReviewItems}
            className={styles.consistencyRelatedButton}
          >
            Restore all
          </button>
        </div>
      )}
      {consistencyReviewItems.length > 0 && (
        <>
          <div className={styles.consistencyDescription}>
            <strong>Review issues</strong>
            {reviewReadiness.passiveCount > 0 && (
              <>
                {' '}
                {reviewReadiness.passiveCount} low-priority candidate
                {reviewReadiness.passiveCount === 1 ? '' : 's'} saved for later.
              </>
            )}
          </div>
          {currentDocumentReviewItems.length > 0 && (
            <section className={styles.reviewIssueSection}>
              <div className={styles.reviewIssueSectionHeader}>
                Current document
                {currentDocument ? ` · ${currentDocument.title || 'Untitled scene'}` : ''}
              </div>
              <ul className={styles.consistencyList}>
                {currentDocumentReviewItems.map(renderIssue)}
              </ul>
            </section>
          )}
          {otherDocumentReviewItems.length > 0 && (
            <section className={styles.reviewIssueSection}>
              <div className={styles.reviewIssueSectionHeader}>
                Other documents
              </div>
              <ul className={styles.consistencyList}>
                {otherDocumentReviewItems.map(renderIssue)}
              </ul>
            </section>
          )}
        </>
      )}
      {stateMutationReviewItems.length > 0 && (
        <WorkspaceStateChangeReview
          consistency={consistency}
          documents={documents}
          handleSelectDocument={handleSelectDocument}
          editStateMutationReviewItem={review.editStateMutationReviewItem}
        />
      )}
      {consistencyReviewItems.length === 0 && stateMutationReviewItems.length === 0 ? (
        <p className={styles.contextSummaryText}>No open review items.</p>
      ) : null}
    </div>
  );
}
