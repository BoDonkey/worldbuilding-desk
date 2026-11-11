import type {WritingDocument} from '../../entityTypes';
import type {
  StateMutationReviewItem,
  useWorkspaceConsistency
} from '../../hooks/useWorkspaceConsistency';
import styles from '../../styles/WorkspaceRoute.module.css';

interface WorkspaceStateChangeReviewProps {
  consistency: ReturnType<typeof useWorkspaceConsistency>;
  documents: WritingDocument[];
  handleSelectDocument: (doc: WritingDocument) => void;
  editStateMutationReviewItem: (item: StateMutationReviewItem) => void;
}

/**
 * Suggested state changes waiting for review, grouped by scene (first 24
 * scenes): accept the valid ones in order, reject, hide, or review one in the
 * editor. Each shows whether it is ready, waits on earlier steps, or is
 * blocked, and why.
 */
export function WorkspaceStateChangeReview({
  consistency,
  documents,
  handleSelectDocument,
  editStateMutationReviewItem
}: WorkspaceStateChangeReviewProps) {
  const {
    stateMutationReviewItems,
    hiddenStateMutationReviewCountBySceneId,
    applyingStateMutationReviewId,
    acceptStateMutationReviewItem,
    rejectStateMutationReviewItem,
    acceptSceneStateMutationReviewItems,
    rejectSceneStateMutationReviewItems,
    hideStateMutationReviewItem,
    restoreHiddenStateMutationReviewItems
  } = consistency;
  const stateMutationReviewGroups = stateMutationReviewItems.reduce<
    Array<{sceneId: string; sceneTitle: string; items: StateMutationReviewItem[]}>
  >((groups, item) => {
    const existing = groups.find((group) => group.sceneId === item.sceneId);
    if (existing) {
      existing.items.push(item);
      return groups;
    }
    groups.push({
      sceneId: item.sceneId,
      sceneTitle: item.sceneTitle,
      items: [item]
    });
    return groups;
  }, []);

  return (
    <>
      <div className={styles.consistencyDescription}>
        <strong>Suggested state changes</strong>
      </div>
      {stateMutationReviewGroups.slice(0, 24).map((group) => {
        const batchAcceptId = `scene:${group.sceneId}:accept`;
        const batchRejectId = `scene:${group.sceneId}:reject`;
        const validCount = group.items.filter((item) => item.canAcceptInBatch).length;
        const hiddenCount =
          hiddenStateMutationReviewCountBySceneId[group.sceneId] ?? 0;
        return (
          <div key={group.sceneId}>
            <div className={styles.consistencyPanelHeader}>
              <button
                type='button'
                onClick={() => {
                  const doc = documents.find((entry) => entry.id === group.sceneId);
                  if (doc) handleSelectDocument(doc);
                }}
                className={styles.consistencySceneButton}
                title={`Open ${group.sceneTitle}`}
              >
                {group.sceneTitle}
              </button>
              <button
                type='button'
                onClick={() => void acceptSceneStateMutationReviewItems(group.sceneId)}
                disabled={validCount === 0 || applyingStateMutationReviewId === batchAcceptId}
                className={styles.consistencyRelatedButton}
              >
                {applyingStateMutationReviewId === batchAcceptId ? 'Applying...' : `Accept valid (${validCount})`}
              </button>
              <button
                type='button'
                onClick={() => void rejectSceneStateMutationReviewItems(group.sceneId)}
                disabled={applyingStateMutationReviewId === batchRejectId}
                className={styles.consistencyRelatedButton}
              >
                {applyingStateMutationReviewId === batchRejectId ? 'Rejecting...' : 'Reject all'}
              </button>
              {hiddenCount > 0 ? (
                <button
                  type='button'
                  onClick={() => restoreHiddenStateMutationReviewItems(group.sceneId)}
                  className={styles.consistencyRelatedButton}
                >
                  {`Restore hidden (${hiddenCount})`}
                </button>
              ) : null}
            </div>
            <ul className={styles.consistencyList}>
              {group.items.map((item) => (
                <li key={item.id} className={styles.consistencyListItem}>
                  <strong>{item.actorLabel}</strong>
                  {item.sceneSequence ? ` · Step ${item.sceneSequence}` : ''}
                  <div className={styles.consistencyRelated}>
                    {item.canAccept ? (
                      <span className={styles.consistencyBadgeReady}>Ready</span>
                    ) : item.canAcceptInBatch ? (
                      <span className={styles.consistencyBadgeBatch}>After earlier steps</span>
                    ) : (
                      <span className={styles.consistencyBadgeBlocked}>Blocked</span>
                    )}
                  </div>
                  {item.summaryLines.map((line) => (
                    <div key={`${item.id}-${line}`} className={styles.consistencyDescription}>
                      {line}
                    </div>
                  ))}
                  {item.effectLines.map((line) => (
                    <div key={`${item.id}:effect:${line}`} className={styles.consistencyDescription}>
                      {line}
                    </div>
                  ))}
                  {item.acceptanceHint && (
                    <div className={styles.consistencyDescription}>
                      {item.acceptanceHint}
                    </div>
                  )}
                  {item.validationIssues.map((issue) => (
                    <div key={`${item.id}:issue:${issue}`} className={styles.consistencyDescription}>
                      {issue}
                    </div>
                  ))}
                  <div className={styles.consistencyRelated}>
                    {item.canEditInWorkspace && (
                      <button
                        type='button'
                        onClick={() => editStateMutationReviewItem(item)}
                        disabled={applyingStateMutationReviewId === item.id}
                        className={styles.consistencyRelatedButton}
                      >
                        Review here
                      </button>
                    )}
                    <button
                      type='button'
                      onClick={() => void acceptStateMutationReviewItem(item.id)}
                      disabled={!item.canAccept || applyingStateMutationReviewId === item.id}
                      className={styles.consistencyRelatedButton}
                    >
                      {applyingStateMutationReviewId === item.id ? 'Applying...' : 'Accept'}
                    </button>
                    <button
                      type='button'
                      onClick={() => void rejectStateMutationReviewItem(item.id)}
                      disabled={applyingStateMutationReviewId === item.id}
                      className={styles.consistencyRelatedButton}
                    >
                      Reject
                    </button>
                    <button
                      type='button'
                      onClick={() => hideStateMutationReviewItem(item.id)}
                      disabled={applyingStateMutationReviewId === item.id}
                      className={styles.consistencyRelatedButton}
                    >
                      Hide for now
                    </button>
                  </div>
                  <span className={styles.consistencyReason}>Deterministic state review</span>
                  {item.staleLabel && (
                    <span className={styles.consistencyReason}>
                      {item.isStale ? `Stale: ${item.staleLabel}` : item.staleLabel}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}
