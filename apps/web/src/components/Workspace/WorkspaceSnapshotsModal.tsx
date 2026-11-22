import {useEffect, useRef, useState} from 'react';
import type {SceneSnapshot} from '../../entityTypes';
import type {SceneSnapshotsController} from '../../hooks/useSceneSnapshots';
import {useConfirmDialog} from '../../hooks/useConfirmDialog';
import {useEscapeToClose} from '../../hooks/useEscapeToClose';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import {formatSnapshotTime, snapshotTitle, wordLabel} from '../../services/editor/sceneSnapshots';
import workspaceStyles from '../../styles/WorkspaceRoute.module.css';
import {SnapshotCompare} from './SnapshotCompare';
import styles from './SceneVersions.module.css';

interface WorkspaceSnapshotsModalProps {
  controller: SceneSnapshotsController;
  sceneTitle: string;
  /** The open scene as edited. */
  currentContent: string;
}

/**
 * The Snapshots dialog (slice 4.95): take a named snapshot, list the scene's
 * snapshots, and show one read-only beside the current text, with Compare
 * marking the words added and removed since.
 */
export function WorkspaceSnapshotsModal({controller, sceneTitle, currentContent}: WorkspaceSnapshotsModalProps) {
  const {isOpen, close, snapshots, isLoaded, isWorking} = controller;
  const dialogRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const {requestConfirm, confirmDialog, isConfirmOpen} = useConfirmDialog();
  useEscapeToClose(close, isOpen && !isConfirmOpen);
  useFocusTrap(dialogRef, isOpen && !isConfirmOpen);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setSelectedId(null);
    }
  }, [isOpen]);

  const selected: SceneSnapshot | null =
    snapshots.find((snapshot) => snapshot.id === selectedId) ?? snapshots[0] ?? null;
  if (!isOpen) return null;

  const handleTake = async () => {
    if (await controller.takeSnapshot(name)) {
      setName('');
      setSelectedId(null);
    }
  };

  return (
    <>
    <div className={workspaceStyles.modalOverlay} onClick={close} role='presentation'>
      <div
        ref={dialogRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby='scene-snapshots-title'
        className={`${workspaceStyles.modalCard} ${styles.card}`}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id='scene-snapshots-title' className={workspaceStyles.modalTitle}>
          Snapshots: {sceneTitle || 'Untitled scene'}
        </h3>
        <p className={`${workspaceStyles.modalDescription} ${styles.note}`}>
          Saved copies of this scene&apos;s text. They are kept with the project and its backups, and are never
          sent to AI or used in review. Automatic snapshots are kept to the newest 20; yours stay until you delete them.
        </p>

        <form
          className={styles.takeRow}
          onSubmit={(event) => {
            event.preventDefault();
            void handleTake();
          }}
        >
          <label className={styles.nameLabel}>
            Name (optional)
            <input
              type='text'
              value={name}
              placeholder='Draft 1, before cutting the dream…'
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button type='submit' disabled={isWorking}>Take snapshot</button>
        </form>

        <div className={styles.body}>
          <ul className={styles.list} aria-label='Snapshots of this scene'>
            {isLoaded && snapshots.length === 0 && (
              <li className={styles.empty}>No snapshots yet. Take one before a big change.</li>
            )}
            {snapshots.map((snapshot) => (
              <li key={snapshot.id}>
                <button
                  type='button'
                  className={styles.listItem}
                  aria-pressed={snapshot.id === selected?.id}
                  onClick={() => setSelectedId(snapshot.id)}
                >
                  <span className={styles.listTitle}>{snapshotTitle(snapshot)}</span>
                  <span className={styles.listMeta}>
                    {formatSnapshotTime(snapshot.createdAt)} · {wordLabel(snapshot.wordCount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <SnapshotCompare
              key={selected.id}
              snapshotHeading={`${snapshotTitle(selected)} · ${formatSnapshotTime(selected.createdAt)}`}
              snapshotHtml={selected.content}
              currentHtml={currentContent}
              actions={<>
                <button type='button' disabled={isWorking} onClick={() => void controller.restoreSnapshot(selected)}>
                  Restore
                </button>
                <button type='button' onClick={() => void controller.copySnapshot(selected)}>Copy</button>
                <button type='button' className={styles.dangerButton} onClick={() => requestConfirm({
                  title: `Delete "${snapshotTitle(selected)}"?`,
                  message: 'This snapshot will be deleted. The scene itself is not changed.',
                  confirmLabel: 'Delete snapshot',
                  variant: 'danger',
                  onConfirm: () => controller.removeSnapshot(selected)
                })}>
                  Delete
                </button>
              </>}
            />
          )}
        </div>

        <div className={workspaceStyles.modalActions}>
          <button type='button' onClick={close} className={workspaceStyles.modalSecondaryAction}>Close</button>
        </div>
      </div>
    </div>
    {confirmDialog}
    </>
  );
}
