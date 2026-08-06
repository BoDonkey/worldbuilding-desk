import type {RefObject} from 'react';
import type {WorkspaceExportFormat, WorkspaceExportItem} from '../../store/workspaceUiStore';
import styles from '../../styles/WorkspaceRoute.module.css';

interface WorkspaceExportModalProps {
  isOpen: boolean;
  dialogRef: RefObject<HTMLDivElement | null>;
  format: WorkspaceExportFormat;
  selection: WorkspaceExportItem[];
  onClose: () => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onToggle: (id: string) => void;
  onToggleAll: (included: boolean) => void;
  onExport: () => void;
}

export const WorkspaceExportModal = ({
  isOpen, dialogRef, format, selection, onClose, onMove, onToggle,
  onToggleAll, onExport
}: WorkspaceExportModalProps) => {
  if (!isOpen) return null;
  return (
    <div ref={dialogRef} role='dialog' aria-modal='true' className={styles.modalOverlay}>
      <div className={`${styles.modalCard} ${styles.exportModalCard}`}>
        <h3 className={styles.modalTitle}>
          Export scenes as {format === 'markdown' ? 'Markdown' : format === 'docx' ? 'DOCX' : 'EPUB'}
        </h3>
        <p className={styles.modalDescription}>
          Choose which scenes to export and adjust their order for the final file.
        </p>
        <div className={styles.exportControlRow}>
          <button type='button' onClick={() => onToggleAll(true)}>Select all</button>
          <button type='button' onClick={() => onToggleAll(false)}>Clear all</button>
        </div>
        <div className={styles.exportListContainer}>
          {selection.length === 0 ? (
            <p className={styles.exportEmpty}>No scenes available to export.</p>
          ) : (
            <ul className={styles.exportList}>
              {selection.map((item, index) => (
                <li key={item.id} className={styles.exportListItem}>
                  <label className={styles.exportItemLabel}>
                    <input type='checkbox' checked={item.included}
                      onChange={() => onToggle(item.id)} />
                    <span className={styles.exportItemTitle}>{index + 1}. {item.title}</span>
                  </label>
                  <div className={styles.exportMoveActions}>
                    <button type='button' onClick={() => onMove(item.id, -1)}
                      disabled={index === 0} className={styles.exportMoveButton}>Up</button>
                    <button type='button' onClick={() => onMove(item.id, 1)}
                      disabled={index === selection.length - 1}
                      className={styles.exportMoveButton}>Down</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.modalActions}>
          <button type='button' onClick={onClose} className={styles.modalSecondaryAction}>Cancel</button>
          <button type='button' onClick={onExport}>Export</button>
        </div>
      </div>
    </div>
  );
};
