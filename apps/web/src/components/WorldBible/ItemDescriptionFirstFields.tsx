import type {EntityCategory} from '../../entityTypes';
import styles from '../../assets/components/WorldBibleRoute.module.css';
import {EntityFieldEditor} from './EntityFieldEditor';

interface ItemDescriptionFirstFieldsProps {
  name: string;
  descriptionField: EntityCategory['fieldSchema'][number] | null;
  fieldValues: Record<string, string>;
  detailsExpanded: boolean;
  onNameChange: (name: string) => void;
  onFieldValuesChange: (fieldValues: Record<string, string>) => void;
  onToggleDetails: () => void;
}

export function ItemDescriptionFirstFields({
  name,
  descriptionField,
  fieldValues,
  detailsExpanded,
  onNameChange,
  onFieldValuesChange,
  onToggleDetails
}: ItemDescriptionFirstFieldsProps) {
  return (
    <section className={styles.itemDraftPanel} aria-labelledby='item-draft-heading'>
      <div className={styles.itemDraftHeader}>
        <div>
          <div className={styles.itemDraftEyebrow}>Start with the story</div>
          <h3 id='item-draft-heading'>Describe the item</h3>
          <p>
            Capture what the item is and why it matters. You can save this draft
            without adding mechanics or filling out the rest of the form.
          </p>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label>
          Name
          <input
            type='text'
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder='e.g., The Silver-Sewn Ring'
            required
          />
        </label>
      </div>

      {descriptionField ? (
        <div className={styles.itemDescriptionField}>
          <EntityFieldEditor
            field={descriptionField}
            fieldValues={fieldValues}
            variant='default'
            onFieldValuesChange={onFieldValuesChange}
          />
        </div>
      ) : (
        <p className={styles.itemDraftNotice}>
          This item category has no description field. Show all item details to
          use its configured fields.
        </p>
      )}

      <div className={styles.itemDraftActions}>
        <button
          type='button'
          onClick={onToggleDetails}
          aria-expanded={detailsExpanded}
          aria-controls='item-detailed-fields'
        >
          {detailsExpanded ? 'Hide extra item details' : 'Show all item details'}
        </button>
        <span>Name and description are enough to save an item.</span>
      </div>
    </section>
  );
}
