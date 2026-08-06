import type {RefObject} from 'react';
import TipTapEditor from '../TipTapEditor';
import {normalizeRichTextValue} from '../../services/worldBible/worldBibleEntityHelpers';
import styles from '../../styles/WorkspaceRoute.module.css';

interface WorkspaceScratchpadModalProps {
  isOpen: boolean;
  dialogRef: RefObject<HTMLDivElement | null>;
  content: string;
  statusLabel: string;
  isNarrowViewport: boolean;
  setContent: (content: string) => void;
  setActiveContextView: (view: 'scratchpad') => void;
  setContextDrawerOpen: (open: boolean) => void;
  setSceneDrawerOpen: (open: boolean) => void;
  onClose: () => void;
}

export const WorkspaceScratchpadModal = ({
  isOpen, dialogRef, content, statusLabel, isNarrowViewport, setContent,
  setActiveContextView, setContextDrawerOpen, setSceneDrawerOpen, onClose
}: WorkspaceScratchpadModalProps) => {
  if (!isOpen) return null;
  return (
    <div ref={dialogRef} role='dialog' aria-modal='true' aria-label='Project scratchpad'
      onClick={onClose} className={styles.modalOverlay}>
      <div onClick={(event) => event.stopPropagation()}
        className={`${styles.modalCard} ${styles.scratchpadModalCard}`}>
        <div className={styles.scratchpadModalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Scratchpad</h3>
            <p className={styles.modalDescription}>
              Loose project notes that stay outside scenes and canon.
            </p>
          </div>
          <button type='button' className={styles.modalSecondaryAction} onClick={onClose}>
            Close
          </button>
        </div>
        <div className={`${styles.scratchpadEditorShell} ${styles.scratchpadModalEditorShell}`}
          aria-label='Project scratchpad'>
          <TipTapEditor content={normalizeRichTextValue(content)} onChange={setContent} />
        </div>
        <div className={styles.scratchpadModalFooter}>
          <div className={styles.scratchpadStatus} role='status'>{statusLabel}</div>
          <div className={styles.scratchpadModalActions}>
            <button type='button' className={styles.modalSecondaryAction} onClick={() => {
              setActiveContextView('scratchpad');
              setContextDrawerOpen(true);
              if (isNarrowViewport) setSceneDrawerOpen(false);
              onClose();
            }}>
              Open in Context Drawer
            </button>
            <button type='button' onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
};
