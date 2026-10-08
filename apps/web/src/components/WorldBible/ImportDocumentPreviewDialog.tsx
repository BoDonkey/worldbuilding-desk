import {useRef} from 'react';
import type {EntityCategory} from '../../entityTypes';
import type {WorldBibleImportDraft} from '../../hooks/useWorldBibleImports';
import {useEscapeToClose} from '../../hooks/useEscapeToClose';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import {
  getPreferredImportField,
  normalizeRichTextValue
} from '../../services/worldBible/worldBibleEntityHelpers';
import {getImportSourceKind} from '../../services/worldBible/worldBibleImportParsing';
import styles from '../../assets/components/WorldBibleRoute.module.css';

interface ImportDocumentPreviewDialogProps {
  draft: WorldBibleImportDraft;
  category: EntityCategory | null;
  isApplyingImports: boolean;
  onImportAndOpen: (draftId: string) => void;
  onClose: () => void;
}

export function ImportDocumentPreviewDialog({
  draft,
  category,
  isApplyingImports,
  onImportAndOpen,
  onClose
}: ImportDocumentPreviewDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEscapeToClose(onClose, true);
  useFocusTrap(dialogRef, true);
  const previewField = category ? getPreferredImportField(category) : null;
  const isImported = draft.status === 'imported';

  return (
    <div
      ref={dialogRef}
      className={styles.importPreviewOverlay}
      role='dialog'
      aria-modal='true'
      aria-label='Import document preview'
      onClick={onClose}
    >
      <div className={styles.importPreviewCard} onClick={(event) => event.stopPropagation()}>
        <div className={styles.importPreviewHeader}>
          <div>
            <div className={styles.importPreviewEyebrow}>Import document preview</div>
            <h3 className={styles.importPreviewTitle}>{draft.name || draft.fileName}</h3>
            <div className={styles.importChipRow}>
              <span className={styles.importChip}>{getImportSourceKind(draft.fileName)}</span>
              {previewField && (
                <span
                  className={`${styles.importChip} ${
                    previewField.type === 'textarea'
                      ? styles.importChipRich
                      : styles.importChipPlain
                  }`}
                >
                  {previewField.type === 'textarea'
                    ? `Rich text -> ${previewField.label}`
                    : `Plain field -> ${previewField.label}`}
                </span>
              )}
              <span className={styles.importChip}>{draft.fileName}</span>
            </div>
          </div>
          {!isImported && (
            <button
              type='button'
              className={styles.importPreviewButton}
              onClick={() => onImportAndOpen(draft.id)}
              disabled={isApplyingImports}
            >
              Import and open
            </button>
          )}
          <button
            type='button'
            className={styles.importPreviewButton}
            onClick={onClose}
            disabled={isApplyingImports}
          >
            Close preview
          </button>
        </div>
        <div className={styles.importPreviewDocument}>
          <article
            className={styles.importPreviewContent}
            dangerouslySetInnerHTML={{
              __html: draft.richTextHtml || normalizeRichTextValue(draft.text)
            }}
          />
        </div>
      </div>
    </div>
  );
}
