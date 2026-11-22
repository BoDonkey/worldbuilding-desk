import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import type {SceneSnapshot} from '../../entityTypes';
import type {SceneSnapshotsController} from '../../hooks/useSceneSnapshots';
import {useEscapeToClose} from '../../hooks/useEscapeToClose';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import {compareSnapshotWithCurrent, snapshotTitle} from '../../services/editor/sceneSnapshots';
import {manuscriptPlainText} from '../../services/state/manuscriptCustody';
import {PARAGRAPH_BREAK_TOKEN, tokenizeWords, type WordDiffOp} from '../../services/editor/wordDiff';
import workspaceStyles from '../../styles/WorkspaceRoute.module.css';
import styles from './WorkspaceSnapshotsModal.module.css';

interface WorkspaceSnapshotsModalProps {
  controller: SceneSnapshotsController;
  sceneTitle: string;
  /** The open scene as edited. */
  currentContent: string;
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'});

const wordLabel = (count: number) => `${count.toLocaleString()} ${count === 1 ? 'word' : 'words'}`;

/** Paragraphs of word tokens; `marked` words are wrapped as added or removed. */
function renderTokens(ops: WordDiffOp[]): ReactNode {
  const paragraphs: WordDiffOp[][] = [[]];
  for (const op of ops) {
    if (op.token === PARAGRAPH_BREAK_TOKEN) paragraphs.push([]);
    else paragraphs[paragraphs.length - 1].push(op);
  }
  return paragraphs
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph, index) => (
      <p key={index}>
        {paragraph.map((op, opIndex) => {
          const space = opIndex > 0 ? ' ' : '';
          if (op.kind === 'added') return <span key={opIndex}>{space}<ins className={styles.added}>{op.token}</ins></span>;
          if (op.kind === 'removed') return <span key={opIndex}>{space}<del className={styles.removed}>{op.token}</del></span>;
          return <span key={opIndex}>{space}{op.token}</span>;
        })}
      </p>
    ));
}

const plainOps = (html: string): WordDiffOp[] =>
  tokenizeWords(manuscriptPlainText(html)).map((token) => ({kind: 'same', token}));

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
  const [isComparing, setComparing] = useState(false);
  useEscapeToClose(close, isOpen);
  useFocusTrap(dialogRef, isOpen);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setSelectedId(null);
      setComparing(false);
    }
  }, [isOpen]);

  const selected: SceneSnapshot | null =
    snapshots.find((snapshot) => snapshot.id === selectedId) ?? snapshots[0] ?? null;
  const comparison = useMemo(
    () => (isOpen && selected && isComparing ? compareSnapshotWithCurrent(selected.content, currentContent) : null),
    [currentContent, isComparing, isOpen, selected]
  );
  const snapshotOps = useMemo(() => (selected ? plainOps(selected.content) : []), [selected]);
  const currentOps = useMemo(() => (isOpen ? plainOps(currentContent) : []), [currentContent, isOpen]);

  if (!isOpen) return null;

  const handleTake = async () => {
    if (await controller.takeSnapshot(name)) {
      setName('');
      setSelectedId(null);
    }
  };

  return (
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
                    {formatTime(snapshot.createdAt)} · {wordLabel(snapshot.wordCount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <section className={styles.detail} aria-label='Selected snapshot'>
              <div className={styles.detailBar}>
                <label className={styles.compareToggle}>
                  <input
                    type='checkbox'
                    checked={isComparing}
                    onChange={(event) => setComparing(event.target.checked)}
                  />
                  Compare
                </label>
                {comparison && (
                  <span className={styles.summary} data-testid='snapshot-compare-summary'>
                    Since this snapshot: {wordLabel(comparison.added)} added, {wordLabel(comparison.removed)} removed.
                  </span>
                )}
                <div className={styles.detailActions}>
                  <button type='button' disabled={isWorking} onClick={() => void controller.restoreSnapshot(selected)}>
                    Restore
                  </button>
                  <button type='button' onClick={() => void controller.copySnapshot(selected)}>Copy</button>
                  <button type='button' className={styles.dangerButton} onClick={() => controller.removeSnapshot(selected)}>
                    Delete
                  </button>
                </div>
              </div>
              <div className={styles.panes}>
                <div className={styles.pane}>
                  <h4 className={styles.paneHeading}>
                    {snapshotTitle(selected)} · {formatTime(selected.createdAt)}
                  </h4>
                  <div className={styles.text} data-testid='snapshot-text'>
                    {renderTokens(comparison ? comparison.snapshot : snapshotOps)}
                  </div>
                </div>
                <div className={styles.pane}>
                  <h4 className={styles.paneHeading}>Current text</h4>
                  <div className={styles.text} data-testid='snapshot-current-text'>
                    {renderTokens(comparison ? comparison.current : currentOps)}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className={workspaceStyles.modalActions}>
          <button type='button' onClick={close} className={workspaceStyles.modalSecondaryAction}>Close</button>
        </div>
      </div>
    </div>
  );
}
