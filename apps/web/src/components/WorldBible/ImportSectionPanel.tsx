import type {EntityCategory} from '../../entityTypes';
import type {
  ImportSectionDestination,
  WorldBibleImportDraft,
  WorldBibleImportSectionDraft
} from '../../hooks/useWorldBibleImports';
import {
  getImportFieldOptions,
  getImportFieldLabelError,
  getNewFieldLabel,
  resolveImportSectionField,
  suggestImportFieldLabel
} from '../../services/worldBible/worldBibleImportParsing';
import styles from '../../assets/components/WorldBibleRoute.module.css';

const KEEP_VALUE = 'keep';
const SKIP_VALUE = 'skip';
const FIELD_PREFIX = 'field:';
const NEW_PREFIX = 'new:';

const sameLabel = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const getDestinationValue = (
  section: WorldBibleImportSectionDraft,
  category: EntityCategory | null
): string => {
  switch (section.action) {
    case 'ignore':
      return SKIP_VALUE;
    case 'new-field': {
      // A name matching an existing field fills that field; show it as chosen.
      const field = category ? resolveImportSectionField(category, section) : null;
      return field ? `${FIELD_PREFIX}${field.key}` : `${NEW_PREFIX}${getNewFieldLabel(section)}`;
    }
    case 'existing-field': {
      const field = category ? resolveImportSectionField(category, section) : null;
      return field ? `${FIELD_PREFIX}${field.key}` : KEEP_VALUE;
    }
    default:
      return KEEP_VALUE;
  }
};

const parseDestinationValue = (value: string): ImportSectionDestination => {
  if (value.startsWith(FIELD_PREFIX)) {
    return {action: 'existing-field', fieldKey: value.slice(FIELD_PREFIX.length)};
  }
  if (value.startsWith(NEW_PREFIX)) {
    return {action: 'new-field', newFieldLabel: value.slice(NEW_PREFIX.length)};
  }
  return {action: value === SKIP_VALUE ? 'ignore' : 'record-section'};
};

const describeDestination = (
  section: WorldBibleImportSectionDraft,
  category: EntityCategory | null
): string => {
  const categoryName = category?.name ?? 'this category';
  switch (section.action) {
    case 'ignore':
      return 'Not imported.';
    case 'new-field': {
      const field = category ? resolveImportSectionField(category, section) : null;
      if (field) {
        return `${field.label} already exists in ${categoryName}, so this fills the ${field.label} field. No new field is added.`;
      }
      return `Adds a new field named ${getNewFieldLabel(section)} to ${categoryName} and fills it here. Other records get the field empty.`;
    }
    case 'existing-field': {
      const field = category ? resolveImportSectionField(category, section) : null;
      return field
        ? `Goes into the ${field.label} field.`
        : 'Stays in Description under this heading.';
    }
    default:
      return 'Stays in Description under this heading.';
  }
};

interface ImportSectionPanelProps {
  draft: WorldBibleImportDraft;
  category: EntityCategory | null;
  /** New-field labels planned by any open draft for this category. */
  plannedNewFieldLabels?: string[];
  isApplyingImports: boolean;
  onUpdateDraft: (
    draftId: string,
    updates: Partial<WorldBibleImportDraft>
  ) => void;
  onUpdateSectionDestination: (
    draftId: string,
    sectionId: string,
    destination: ImportSectionDestination
  ) => void;
}

export function ImportSectionPanel({
  draft,
  category,
  plannedNewFieldLabels = [],
  isApplyingImports,
  onUpdateDraft,
  onUpdateSectionDestination
}: ImportSectionPanelProps) {
  if (!draft.detectedSections || draft.detectedSections.length === 0) {
    return null;
  }

  const fieldOptions = category ? getImportFieldOptions(category) : [];
  const categoryName = category?.name ?? 'Category';
  const draftNewFieldLabels = draft.detectedSections
    .filter((section) => section.action === 'new-field')
    .map(getNewFieldLabel)
    .filter((label) => !getImportFieldLabelError(label));

  return (
    <div className={styles.importSectionMapping}>
      <div className={styles.importSectionMappingHeader}>
        <div>
          <strong>Choose where each heading goes</strong>
          <p>
            Headings stay in Description unless you send them to a field. A new field is
            added to {categoryName} for every record.
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
        {draft.detectedSections.map((section) => {
          const suggestedFieldLabel = suggestImportFieldLabel(section.title, draft.name);
          const suggestedLabelExists = fieldOptions.some((field) =>
            sameLabel(field.label, suggestedFieldLabel)
          );
          const newFieldLabels = suggestedLabelExists ? [] : [suggestedFieldLabel];
          [...draftNewFieldLabels, ...plannedNewFieldLabels].forEach((label) => {
            const exists = fieldOptions.some((field) => sameLabel(field.label, label));
            if (!exists && !newFieldLabels.some((known) => sameLabel(known, label))) {
              newFieldLabels.push(label);
            }
          });
          const visibleNewFieldLabels = newFieldLabels;
          const newFieldLabel = section.newFieldLabel ?? suggestedFieldLabel;
          const newFieldLabelError = section.action === 'new-field'
            ? getImportFieldLabelError(newFieldLabel)
            : null;
          const newFieldInputId = `import-new-field-${draft.id}-${section.id}`;
          const newFieldErrorId = `${newFieldInputId}-error`;
          return (
            <div key={section.id} className={styles.importSectionItem}>
              <div>
                <strong>{section.title}</strong>
                <span>{describeDestination(section, category)}</span>
              </div>
              <select
                aria-label={`Destination for ${section.title}`}
                value={getDestinationValue(section, category)}
                disabled={
                  isApplyingImports || !(draft.useDetectedSections ?? false)
                }
                onChange={(event) =>
                  onUpdateSectionDestination(
                    draft.id,
                    section.id,
                    parseDestinationValue(event.target.value)
                  )
                }
              >
                <option value={KEEP_VALUE}>Keep in Description</option>
                {fieldOptions.length > 0 && (
                  <optgroup label={`${categoryName} fields`}>
                    {fieldOptions.map((field) => (
                      <option key={field.key} value={`${FIELD_PREFIX}${field.key}`}>
                        {field.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {visibleNewFieldLabels.length > 0 && (
                  <optgroup label='New fields'>
                    {visibleNewFieldLabels.map((label) => (
                      <option key={label} value={`${NEW_PREFIX}${label}`}>
                        New field: {label}
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value={SKIP_VALUE}>Skip</option>
              </select>
              {section.action === 'new-field' && (
                <div>
                  <label htmlFor={newFieldInputId}>New field name</label>
                  <input
                    id={newFieldInputId}
                    type='text'
                    value={newFieldLabel}
                    maxLength={80}
                    disabled={isApplyingImports || !(draft.useDetectedSections ?? false)}
                    aria-invalid={newFieldLabelError ? true : undefined}
                    aria-describedby={newFieldLabelError ? newFieldErrorId : undefined}
                    onChange={(event) =>
                      onUpdateSectionDestination(draft.id, section.id, {
                        action: 'new-field',
                        newFieldLabel: event.target.value
                      })
                    }
                  />
                  {newFieldLabelError && (
                    <span id={newFieldErrorId} className={styles.importError}>
                      {newFieldLabelError}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
