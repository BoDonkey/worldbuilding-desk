import styles from '../../styles/WorkspaceRoute.module.css';

interface WorkspaceEmptyStateProps {
  onNewScene: () => Promise<unknown>;
  isCreatingScene: boolean;
  onImportDraft: () => void;
  isImportingDocuments: boolean;
  onOpenScratchpad: () => void;
  onOpenCorkboard: () => void;
  onToggleSceneDrawer: () => void;
}

/** Shown in place of the editor when no scene is open. */
export function WorkspaceEmptyState({
  onNewScene,
  isCreatingScene,
  onImportDraft,
  isImportingDocuments,
  onOpenScratchpad,
  onOpenCorkboard,
  onToggleSceneDrawer
}: WorkspaceEmptyStateProps) {
  return (
    <div className={styles.emptyWorkspaceState}>
      <h2 className={styles.emptyWorkspaceTitle}>Start writing immediately</h2>
      <p className={styles.emptyWorkspaceCopy}>
        Create a blank scene or import existing pages. World context and review
        tools can stay in the background until you need them.
      </p>
      <div className={styles.emptyWorkspaceActions}>
        <button
          type='button'
          onClick={() => void onNewScene()}
          disabled={isCreatingScene}
        >
          {isCreatingScene ? 'Creating...' : 'New Scene'}
        </button>
        <button
          type='button'
          onClick={onImportDraft}
          disabled={isImportingDocuments}
        >
          {isImportingDocuments ? 'Importing...' : 'Import Draft'}
        </button>
        <button
          type='button'
          className={styles.drawerTopButton}
          onClick={onOpenScratchpad}
        >
          Open Scratchpad
        </button>
        <button
          type='button'
          className={styles.drawerTopButton}
          onClick={onOpenCorkboard}
        >
          Open Corkboard
        </button>
        <button
          type='button'
          className={styles.drawerTopButton}
          onClick={onToggleSceneDrawer}
        >
          Browse Scenes
        </button>
      </div>
    </div>
  );
}
