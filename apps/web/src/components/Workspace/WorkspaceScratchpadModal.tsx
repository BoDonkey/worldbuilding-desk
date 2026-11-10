import {useRef} from 'react';
import {useEscapeToClose} from '../../hooks/useEscapeToClose';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import TipTapEditor from '../TipTapEditor';
import {normalizeRichTextValue} from '../../services/worldBible/worldBibleEntityHelpers';
import styles from '../../styles/WorkspaceRoute.module.css';
import modalStyles from './WorkspaceScratchpadModal.module.css';

interface WorkspaceScratchpadModalProps {
  isOpen: boolean;
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
  isOpen, content, statusLabel, isNarrowViewport, setContent,
  setActiveContextView, setContextDrawerOpen, setSceneDrawerOpen, onClose
}: WorkspaceScratchpadModalProps) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEscapeToClose(onClose, isOpen);
  useFocusTrap(dialogRef, isOpen);
  if (!isOpen) return null;
  return (
    <div ref={dialogRef} role='dialog' aria-modal='true' aria-label='Project scratchpad'
      onClick={onClose} className={styles.modalOverlay}>
      <div onClick={(event) => event.stopPropagation()}
        className={`${styles.modalCard} ${modalStyles.card}`}>
        <div className={modalStyles.header}>
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
        <div className={`${styles.scratchpadEditorShell} ${modalStyles.editorShell}`}
          aria-label='Project scratchpad'>
          <TipTapEditor content={normalizeRichTextValue(content)} onChange={setContent} />
        </div>
        <div className={modalStyles.footer}>
          <div className={styles.scratchpadStatus} role='status'>{statusLabel}</div>
          <div className={modalStyles.actions}>
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
