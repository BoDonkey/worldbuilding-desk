import type {SaveStatus} from '../../hooks/useWorkspaceDocuments';
import styles from '../../styles/WorkspaceRoute.module.css';

interface WorkspaceEditorFooterProps {
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  wordCount: number;
  onSave: () => void;
  /** Shown only for a book in a series. */
  canPromoteToParent: boolean;
  isPromotingDocument: boolean;
  onPromoteDocument: () => Promise<void>;
  onExtractMemory: () => void;
  onOpenScratchpad: () => void;
  onOpenCorkboard: () => void;
  onToggleSceneDrawer: () => void;
  onToggleContextDrawer: () => void;
}

/**
 * The bar under the editor: save now, promote to the parent series, extract
 * memory, the save status and word count, and the drawer and tool buttons.
 */
export function WorkspaceEditorFooter({
  saveStatus,
  lastSavedAt,
  wordCount,
  onSave,
  canPromoteToParent,
  isPromotingDocument,
  onPromoteDocument,
  onExtractMemory,
  onOpenScratchpad,
  onOpenCorkboard,
  onToggleSceneDrawer,
  onToggleContextDrawer
}: WorkspaceEditorFooterProps) {
  return (
    <div className={styles.editorFooterBar} data-stat-panel-avoid=''>
      <button
        type='button'
        onClick={onSave}
        disabled={saveStatus === 'saving'}
      >
        Save now
      </button>
      {canPromoteToParent && (
        <button
          type='button'
          onClick={() => void onPromoteDocument()}
          disabled={isPromotingDocument}
        >
          {isPromotingDocument
            ? 'Promoting...'
            : 'Promote scene to parent'}
        </button>
      )}
      <button type='button' onClick={onExtractMemory}>
        Extract memory
      </button>
      <span className={styles.editorFooterStatus}>
        {saveStatus === 'saving' && 'Saving…'}
        {saveStatus === 'saved' && lastSavedAt && (
          <>Saved at {new Date(lastSavedAt).toLocaleTimeString()}</>
        )}
        {saveStatus === 'idle' && 'No recent changes'}
        {' · '}
        {wordCount} words
      </span>
      <div className={styles.editorFooterUtilities}>
        <button
          type='button'
          className={styles.drawerTopButton}
          onClick={onOpenScratchpad}
        >
          Scratchpad
        </button>
        <button
          type='button'
          className={styles.drawerTopButton}
          aria-label='Open quick Corkboard'
          onClick={onOpenCorkboard}
        >
          Corkboard
        </button>
        <button
          type='button'
          className={styles.drawerTopButton}
          onClick={onToggleSceneDrawer}
        >
          Scenes
        </button>
        <button
          type='button'
          className={styles.drawerTopButton}
          onClick={onToggleContextDrawer}
        >
          Context
        </button>
      </div>
    </div>
  );
}
