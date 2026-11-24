import type {SaveStatus} from '../../hooks/useWorkspaceDocuments';
import {dispatchWorkspaceCommand} from '../../commands/workspaceCommands';
import workspaceStyles from '../../styles/WorkspaceRoute.module.css';
import styles from './WorkspaceEditorFooter.module.css';
import {useFocusModeStore} from '../../store/focusModeStore';

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
 * The bar under the editor: save now, scene snapshots, promote to the parent
 * series, extract memory, the save status and word count, and the drawer and
 * tool buttons. In focus mode it is hidden, and a bar with the word count and
 * Leave focus mode takes its place.
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
  const isFocusMode = useFocusModeStore((state) => state.isOn);
  return (
    <>
      {isFocusMode && (
        <div className={styles.focusBar} data-testid='focus-mode-bar'>
          <span>{wordCount} words</span>
          <button
            type='button'
            title='Leave focus mode (Escape)'
            onClick={() => dispatchWorkspaceCommand('toggle-focus-mode')}
          >
            Leave focus mode
          </button>
        </div>
      )}
      <div className={styles.editorFooterBar} data-stat-panel-avoid='' data-focus-hide=''>
        <button
          type='button'
          onClick={onSave}
          disabled={saveStatus === 'saving'}
        >
          Save now
        </button>
        <button
          type='button'
          title='Take snapshot (Cmd/Ctrl+Shift+S)'
          onClick={() => dispatchWorkspaceCommand('take-snapshot')}
        >
          Take snapshot
        </button>
        <button type='button' onClick={() => dispatchWorkspaceCommand('open-snapshots')}>
          Snapshots
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
            className={workspaceStyles.drawerTopButton}
            aria-pressed={isFocusMode}
            title='Hide everything but the scene (Cmd/Ctrl+Shift+F)'
            onClick={() => dispatchWorkspaceCommand('toggle-focus-mode')}
          >
            Focus mode
          </button>
          <button
            type='button'
            className={workspaceStyles.drawerTopButton}
            onClick={onOpenScratchpad}
          >
            Scratchpad
          </button>
          <button
            type='button'
            className={workspaceStyles.drawerTopButton}
            aria-label='Open quick Corkboard'
            onClick={onOpenCorkboard}
          >
            Corkboard
          </button>
          <button
            type='button'
            className={workspaceStyles.drawerTopButton}
            onClick={onToggleSceneDrawer}
          >
            Scenes
          </button>
          <button
            type='button'
            className={workspaceStyles.drawerTopButton}
            onClick={onToggleContextDrawer}
          >
            Context
          </button>
        </div>
      </div>
    </>
  );
}
