import type {RefObject} from 'react';
import styles from '../../styles/WorkspaceRoute.module.css';

interface WorkspaceMemoryModalProps {
  isOpen: boolean;
  dialogRef: RefObject<HTMLDivElement | null>;
  draft: string;
  isSaving: boolean;
  setDraft: (draft: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export const WorkspaceMemoryModal = ({
  isOpen, dialogRef, draft, isSaving, setDraft, onClose, onSave
}: WorkspaceMemoryModalProps) => {
  if (!isOpen) return null;
  return (
    <div ref={dialogRef} role='dialog' aria-modal='true' className={styles.modalOverlay}>
      <div className={`${styles.modalCard} ${styles.memoryModalCard}`}>
        <h3 className={styles.modalTitle}>Capture Shodh memory</h3>
        <p className={styles.modalDescription}>
          Review or edit the summary before adding it to the project canon.
        </p>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)}
          rows={6} className={styles.memoryTextarea} />
        <div className={styles.modalActions}>
          <button type='button' onClick={onClose} disabled={isSaving}
            className={styles.modalSecondaryAction}>Cancel</button>
          <button type='button' onClick={onSave} disabled={isSaving || !draft.trim()}>
            {isSaving ? 'Saving...' : 'Save memory'}
          </button>
        </div>
      </div>
    </div>
  );
};
