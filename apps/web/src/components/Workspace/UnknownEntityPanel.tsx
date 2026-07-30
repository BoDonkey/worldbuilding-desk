import styles from '../../styles/WorkspaceRoute.module.css';

interface UnknownEntityPanelProps {
  hiddenReviewSurfaceCount: number;
  issueCount: number;
  onDismissAll: () => void;
  onDismissNotice: () => void;
  onResolveAll: () => Promise<void>;
  reviewBannerBody: string;
  reviewBannerTitle: string;
  reviewCreateAllLabel: string;
  reviewDismissAllLabel: string;
  visibleReviewSurfaces: string[];
}

export function UnknownEntityPanel({
  hiddenReviewSurfaceCount,
  issueCount,
  onDismissAll,
  onDismissNotice,
  onResolveAll,
  reviewBannerBody,
  reviewBannerTitle,
  reviewCreateAllLabel,
  reviewDismissAllLabel,
  visibleReviewSurfaces
}: UnknownEntityPanelProps) {
  return (
    <div className={styles.unknownPanel}>
      <div className={styles.unknownPanelHeader}>
        <strong>{reviewBannerTitle}</strong>
        <button
          type='button'
          onClick={onDismissNotice}
          className={styles.unknownPanelDismissButton}
          aria-label='Dismiss review notice'
        >
          Dismiss
        </button>
      </div>
      <div className={styles.unknownSummary}>
        {issueCount} item
        {issueCount === 1 ? '' : 's'} highlighted. {reviewBannerBody}
      </div>
      {visibleReviewSurfaces.length > 0 && (
        <div className={styles.unknownSurfaceList}>
          {visibleReviewSurfaces.map((surface) => (
            <span key={surface} className={styles.unknownSurfaceChip}>
              {surface}
            </span>
          ))}
          {hiddenReviewSurfaceCount > 0 && (
            <span className={styles.unknownSurfaceChipMuted}>
              +{hiddenReviewSurfaceCount} more
            </span>
          )}
        </div>
      )}
      <div className={styles.unknownBulkActions}>
        <button
          type='button'
          onClick={() => void onResolveAll()}
          className={styles.unknownActionButton}
        >
          {reviewCreateAllLabel}
        </button>
        <button
          type='button'
          onClick={onDismissAll}
          className={styles.unknownActionButtonSpaced}
        >
          {reviewDismissAllLabel}
        </button>
      </div>
    </div>
  );
}
