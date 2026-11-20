import {useRef} from 'react';
import {useEscapeToClose} from '../../hooks/useEscapeToClose';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import workspaceStyles from '../../styles/WorkspaceRoute.module.css';
import styles from './WorkspaceMemoryModal.module.css';

interface WorkspaceMemoryModalProps {
  isOpen: boolean;
  draft: string;
  isSaving: boolean;
  setDraft: (draft: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export const WorkspaceMemoryModal = ({
  isOpen, draft, isSaving, setDraft, onClose, onSave
}: WorkspaceMemoryModalProps) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEscapeToClose(onClose, isOpen);
  useFocusTrap(dialogRef, isOpen);
  if (!isOpen) return null;
  return (
    <div ref={dialogRef} role='dialog' aria-modal='true' className={workspaceStyles.modalOverlay}>
      <div className={`${workspaceStyles.modalCard} ${styles.memoryModalCard}`}>
        <h3 className={workspaceStyles.modalTitle}>Capture project memory</h3>
        <p className={workspaceStyles.modalDescription}>
          Review or edit the summary before adding it to the project canon.
        </p>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)}
          rows={6} className={styles.memoryTextarea} />
        <div className={workspaceStyles.modalActions}>
          <button type='button' onClick={onClose} disabled={isSaving}
            className={workspaceStyles.modalSecondaryAction}>Cancel</button>
          <button type='button' onClick={onSave} disabled={isSaving || !draft.trim()}>
            {isSaving ? 'Saving...' : 'Save memory'}
          </button>
        </div>
      </div>
    </div>
  );
};
