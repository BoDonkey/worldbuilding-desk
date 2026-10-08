import type {EntityCategory} from '../../entityTypes';
import type {
  ImportMode,
  ImportSectionDestination,
  WorldBibleImportDraft
} from '../../hooks/useWorldBibleImports';
import {getPreferredImportField} from '../../services/worldBible/worldBibleEntityHelpers';
import {getImportSourceKind} from '../../services/worldBible/worldBibleImportParsing';
import {ImportSectionPanel} from './ImportSectionPanel';
import styles from '../../assets/components/WorldBibleRoute.module.css';

interface ImportDraftCardProps {
  draft: WorldBibleImportDraft;
  category: EntityCategory | null;
  categories: EntityCategory[];
  plannedNewFieldLabels?: string[];
  isApplyingImports: boolean;
  onUpdateDraft: (draftId: string, updates: Partial<WorldBibleImportDraft>) => void;
  onUpdateSectionDestination: (
    draftId: string,
    sectionId: string,
    destination: ImportSectionDestination
  ) => void;
  onImportAndOpen: (draftId: string) => void;
  onOpenImported: (entityId: string) => void;
  onPreviewSource: (draftId: string) => void;
}

export function ImportDraftCard({
  draft,
  category,
  categories,
  plannedNewFieldLabels,
  isApplyingImports,
  onUpdateDraft,
  onUpdateSectionDestination,
  onImportAndOpen,
  onOpenImported,
  onPreviewSource
}: ImportDraftCardProps) {
  if (draft.status === 'imported') {
    const savedName = draft.importedEntityName || draft.name;
    return (
      <li className={styles.importDraftCard} aria-label={`${draft.fileName}: imported`}>
        <div className={styles.importDraftTop}>
          <span>{draft.fileName}</span>
          <div className={styles.importChipRow}>
            <span className={`${styles.importChip} ${styles.importChipRich}`}>Imported</span>
            {category && <span className={styles.importChip}>{category.name}</span>}
          </div>
        </div>
        <p className={styles.importDraftNote}>
          Saved to the project as <strong>{savedName}</strong>.
        </p>
        <div className={styles.importDraftActions}>
          {draft.importedEntityId && (
            <button
              type='button'
              className={styles.importPreviewButton}
              onClick={() => onOpenImported(draft.importedEntityId!)}
            >
              Open {savedName}
            </button>
          )}
        </div>
      </li>
    );
  }

  const preferredField = category ? getPreferredImportField(category) : null;
  const landsAsRichText = preferredField?.type === 'textarea';
  const isDisabled = Boolean(draft.parseError) || isApplyingImports;
  return (
    <li className={styles.importDraftCard}>
      <div className={styles.importDraftTop}>
        <label>
          <input
            type='checkbox'
            checked={draft.include}
            disabled={isDisabled}
            onChange={(e) => onUpdateDraft(draft.id, {include: e.target.checked})}
          />
          <span>{draft.fileName}</span>
        </label>
        <div className={styles.importChipRow}>
          {!draft.parseError && (
            <span className={`${styles.importChip} ${styles.importChipPlain}`}>
              {draft.status === 'failed' ? 'Not imported' : 'Not saved yet'}
            </span>
          )}
          <span className={styles.importChip}>{getImportSourceKind(draft.fileName)}</span>
          {preferredField && (
            <span
              className={`${styles.importChip} ${
                landsAsRichText ? styles.importChipRich : styles.importChipPlain
              }`}
            >
              {landsAsRichText
                ? `Rich text -> ${preferredField.label}`
                : `Plain field -> ${preferredField.label}`}
            </span>
          )}
          {draft.detectedSections && draft.detectedSections.length > 0 && (
            <span className={`${styles.importChip} ${styles.importChipRich}`}>
              {draft.detectedSections.length} headings detected
            </span>
          )}
          <span className={styles.importChip}>
            {draft.mode === 'upsert' ? 'Update by name' : 'Create new'}
          </span>
        </div>
      </div>
      {draft.status === 'failed' && draft.importError && (
        <p className={styles.importError}>Import failed: {draft.importError}</p>
      )}
      <div className={styles.importDraftFields}>
        <label>
          Entry Name
          <input
            type='text'
            value={draft.name}
            disabled={isDisabled}
            onChange={(e) => onUpdateDraft(draft.id, {name: e.target.value})}
          />
        </label>
        <label>
          Category
          <select
            value={draft.categoryId}
            disabled={isDisabled}
            onChange={(e) => onUpdateDraft(draft.id, {categoryId: e.target.value})}
          >
            {categories.map((categoryOption) => (
              <option key={categoryOption.id} value={categoryOption.id}>
                {categoryOption.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Behavior
          <select
            value={draft.mode}
            disabled={isDisabled}
            onChange={(e) => onUpdateDraft(draft.id, {mode: e.target.value as ImportMode})}
          >
            <option value='create'>Create New</option>
            <option value='upsert'>Update by Name</option>
          </select>
        </label>
      </div>
      {draft.parseError ? (
        <p className={styles.importError}>{draft.parseError}</p>
      ) : (
        <>
          <ImportSectionPanel
            draft={draft}
            category={category}
            plannedNewFieldLabels={plannedNewFieldLabels}
            isApplyingImports={isApplyingImports}
            onUpdateDraft={onUpdateDraft}
            onUpdateSectionDestination={onUpdateSectionDestination}
          />
          <div className={styles.importDraftActions}>
            <button
              type='button'
              className={styles.importPreviewButton}
              onClick={() => onImportAndOpen(draft.id)}
              disabled={isApplyingImports}
            >
              Import and open
            </button>
            {draft.richTextHtml && (
              <button
                type='button'
                className={styles.importPreviewButton}
                onClick={() => onPreviewSource(draft.id)}
                disabled={isApplyingImports}
              >
                Preview source document
              </button>
            )}
          </div>
          <p className={styles.importPreview}>{draft.preview}</p>
          <p className={styles.importDraftNote}>
            {draft.useDetectedSections && (draft.detectedSections?.length ?? 0) > 0
              ? 'Description keeps the intro and every heading set to Keep in Description. Only New field choices add fields to the category.'
              : landsAsRichText
                ? 'This import will preserve richer prose structure in the target lore field.'
                : 'This import will land as plain text in the target field.'}
          </p>
        </>
      )}
    </li>
  );
}
