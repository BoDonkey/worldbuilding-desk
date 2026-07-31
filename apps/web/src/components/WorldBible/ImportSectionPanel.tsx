import type {
  WorldBibleImportDraft,
  WorldBibleImportSectionAction
} from '../../hooks/useWorldBibleImports';
import styles from '../../assets/components/WorldBibleRoute.module.css';

const IMPORT_SECTION_ACTION_LABELS: Record<WorldBibleImportSectionAction, string> = {
  'existing-field': 'Existing field',
  'record-section': 'Record section',
  'new-field': 'Reusable field',
  ignore: 'Ignore'
};

const IMPORT_SECTION_ACTION_HELP: Record<WorldBibleImportSectionAction, string> = {
  'existing-field': 'Copies this heading into the matching category field.',
  'record-section': 'Keeps this heading inside this record without changing the category schema.',
  'new-field': 'Creates a reusable field on this category before import.',
  ignore: 'Skips this heading and content during structured import.'
};

const IMPORT_SECTION_ACTIONS: WorldBibleImportSectionAction[] = [
  'existing-field',
  'record-section',
  'new-field',
  'ignore'
];

interface ImportSectionPanelProps {
  draft: WorldBibleImportDraft;
  isApplyingImports: boolean;
  onUpdateDraft: (
    draftId: string,
    updates: Partial<WorldBibleImportDraft>
  ) => void;
  onUpdateSectionAction: (
    draftId: string,
    sectionId: string,
    action: WorldBibleImportSectionAction
  ) => void;
}

export function ImportSectionPanel({
  draft,
  isApplyingImports,
  onUpdateDraft,
  onUpdateSectionAction
}: ImportSectionPanelProps) {
  if (!draft.detectedSections || draft.detectedSections.length === 0) {
    return null;
  }

  return (
    <div className={styles.importSectionMapping}>
      <div className={styles.importSectionMappingHeader}>
        <div>
          <strong>Classify detected headings</strong>
          <p>
            Specific topics stay inside this record by default. Promote only reusable
            headings to category fields.
          </p>
        </div>
        <label>
          <input
            type='checkbox'
            checked={draft.useDetectedSections ?? false}
            disabled={isApplyingImports}
            onChange={(event) =>
              onUpdateDraft(draft.id, {
                useDetectedSections: event.target.checked
              })
            }
          />
          <span>Use structured headings</span>
        </label>
      </div>
      <div className={styles.importSectionList}>
        {draft.detectedSections.slice(0, 8).map((section) => (
          <div key={section.id} className={styles.importSectionItem}>
            <div>
              <strong>{section.title}</strong>
              <span>{IMPORT_SECTION_ACTION_HELP[section.action]}</span>
            </div>
            <select
              value={section.action}
              disabled={
                isApplyingImports || !(draft.useDetectedSections ?? false)
              }
              onChange={(event) =>
                onUpdateSectionAction(
                  draft.id,
                  section.id,
                  event.target.value as WorldBibleImportSectionAction
                )
              }
            >
              {IMPORT_SECTION_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {IMPORT_SECTION_ACTION_LABELS[action]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
