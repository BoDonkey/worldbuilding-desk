import styles from '../../styles/WorkspaceRoute.module.css';

interface CanonPanelProps {
  childLastSynced?: string;
  isSyncingCanon: boolean;
  onSync: () => Promise<void>;
  parentCanonVersion?: string;
  parentName?: string;
}

export function CanonPanel({
  childLastSynced,
  isSyncingCanon,
  onSync,
  parentCanonVersion,
  parentName
}: CanonPanelProps) {
  return (
    <div className={styles.canonPanel}>
      <div>
        <strong>Parent canon:</strong>{' '}
        {parentName ?? 'Unknown'} · Version{' '}
        {parentCanonVersion ?? 'n/a'}
        {parentCanonVersion &&
          childLastSynced &&
          parentCanonVersion !== childLastSynced && (
            <span className={styles.canonOutOfSync}>
              Out of sync
            </span>
          )}
      </div>
      <div className={styles.canonMetaRow}>
        <span>
          Last synced:{' '}
          {childLastSynced ?? 'never'}
        </span>
        <button
          type='button'
          onClick={() => void onSync()}
          disabled={isSyncingCanon}
        >
          {isSyncingCanon ? 'Marking...' : 'Mark as synced'}
        </button>
      </div>
    </div>
  );
}
