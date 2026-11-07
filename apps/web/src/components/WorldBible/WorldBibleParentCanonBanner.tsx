import styles from '../../assets/components/WorldBibleRoute.module.css';

interface WorldBibleParentCanonBannerProps {
  canonState: {
    parentCanonVersion?: string;
    childLastSynced?: string;
    parentName?: string;
  };
  isSyncing: boolean;
  onMarkSynced: () => void;
}

/** For a series book: which parent canon version this project follows, and whether it is behind. */
export function WorldBibleParentCanonBanner({
  canonState,
  isSyncing,
  onMarkSynced
}: WorldBibleParentCanonBannerProps) {
  return (
    <div className={styles.banner}>
      <strong>Parent canon:</strong> {canonState.parentName ?? 'Unknown'} ·
      Version {canonState.parentCanonVersion ?? 'n/a'}
      {canonState.parentCanonVersion &&
        canonState.childLastSynced &&
        canonState.parentCanonVersion !== canonState.childLastSynced && (
          <span className={styles.outOfSync}>Out of sync</span>
        )}
      <div className={styles.syncRow}>
        <span>
          Last synced:{' '}
          {canonState.childLastSynced ?? 'never'}
        </span>
        <button
          type='button'
          onClick={onMarkSynced}
          disabled={isSyncing}
        >
          {isSyncing ? 'Marking...' : 'Mark as synced'}
        </button>
      </div>
    </div>
  );
}
