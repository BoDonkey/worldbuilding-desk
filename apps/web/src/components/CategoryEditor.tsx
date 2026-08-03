import {useState} from 'react';
import type {EntityCategory, FieldDefinition} from '../entityTypes';
import {saveCategory} from '../categoryStorage';
import styles from '../assets/components/CategoryEditor.module.css';

interface CategoryEditorProps {
  category: EntityCategory;
  onSave: (category: EntityCategory) => void;
  onCancel: () => void;
}

type ValidationError =
  | {scope: 'name'}
  | {
      scope: 'field';
      index: number;
      missingKey: boolean;
      missingLabel: boolean;
    };

function CategoryEditor({category, onSave, onCancel}: CategoryEditorProps) {
  const [name, setName] = useState(category.name);
  const [fields, setFields] = useState<FieldDefinition[]>(category.fieldSchema);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(
    null
  );
  const [validationError, setValidationError] =
    useState<ValidationError | null>(null);

  const handleAddField = () => {
    setValidationError(null);
    setFields([
      ...fields,
      {
        key: '',
        label: '',
        type: 'text',
        required: false
      }
    ]);
    setEditingFieldIndex(fields.length);
  };

  const handleUpdateField = (
    index: number,
    updates: Partial<FieldDefinition>
  ) => {
    const updated = [...fields];
    updated[index] = {...updated[index], ...updates};
    setFields(updated);
    if (validationError?.scope === 'field' && validationError.index === index) {
      setValidationError(null);
    }
  };

  const handleDeleteField = (index: number) => {
    setValidationError(null);
    setFields(fields.filter((_, i) => i !== index));
    if (editingFieldIndex === index) setEditingFieldIndex(null);
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fields.length - 1) return;

    const updated = [...fields];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setFields(updated);
    setValidationError(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setValidationError({scope: 'name'});
      return;
    }

    for (const [index, field] of fields.entries()) {
      if (!field.key.trim() || !field.label.trim()) {
        setValidationError({
          scope: 'field',
          index,
          missingKey: !field.key.trim(),
          missingLabel: !field.label.trim()
        });
        setEditingFieldIndex(index);
        return;
      }
    }

    setValidationError(null);
    const updated: EntityCategory = {
      ...category,
      name: name.trim(),
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      fieldSchema: fields
    };

    await saveCategory(updated);
    onSave(updated);
  };

  return (
    <div className={styles.container}>
      <h3>Edit Category: {category.name}</h3>

      <div className={styles.header}>
        <label>
          Category Name
          <br />
          <input
            type='text'
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (validationError?.scope === 'name') {
                setValidationError(null);
              }
            }}
            className={`${styles.nameInput} ${
              validationError?.scope === 'name' ? styles.invalidInput : ''
            }`}
            aria-invalid={validationError?.scope === 'name' || undefined}
            aria-describedby={
              validationError?.scope === 'name'
                ? 'category-name-error'
                : undefined
            }
          />
        </label>
        {validationError?.scope === 'name' && (
          <p
            id='category-name-error'
            className={styles.fieldError}
            role='alert'
          >
            Category name is required.
          </p>
        )}
      </div>

      <div className={styles.fieldsSection}>
        <h4>Fields</h4>
        {fields.length === 0 && (
          <p className={styles.emptyState}>No fields defined. Add one below.</p>
        )}

        {fields.map((field, index) => (
          <div
            key={index}
            className={`${styles.fieldCard} ${
              editingFieldIndex === index ? styles.editing : ''
            }`}
          >
            <div className={styles.fieldHeader}>
              <span className={styles.fieldTitle}>
                {field.label || 'Untitled Field'}
              </span>
              <div className={styles.fieldActions}>
                <button
                  type='button'
                  onClick={() => handleMoveField(index, 'up')}
                  disabled={index === 0}
                >
                  ↑
                </button>
                <button
                  type='button'
                  onClick={() => handleMoveField(index, 'down')}
                  disabled={index === fields.length - 1}
                >
                  ↓
                </button>
                <button
                  type='button'
                  onClick={() =>
                    setEditingFieldIndex(
                      editingFieldIndex === index ? null : index
                    )
                  }
                >
                  {editingFieldIndex === index ? 'Done' : 'Edit'}
                </button>
                <button
                  type='button'
                  onClick={() => handleDeleteField(index)}
                  className={styles.deleteButton}
                >
                  Delete
                </button>
              </div>
            </div>

            {editingFieldIndex === index && (
              <div className={styles.fieldForm}>
                <div>
                  <label>
                    Field Key (internal)
                    <br />
                    <input
                      type='text'
                      value={field.key}
                      onChange={(e) =>
                        handleUpdateField(index, {key: e.target.value})
                      }
                      placeholder='e.g., powerLevel'
                      className={
                        validationError?.scope === 'field' &&
                        validationError.index === index &&
                        validationError.missingKey
                          ? styles.invalidInput
                          : undefined
                      }
                      aria-invalid={
                        (validationError?.scope === 'field' &&
                          validationError.index === index &&
                          validationError.missingKey) ||
                        undefined
                      }
                      aria-describedby={
                        validationError?.scope === 'field' &&
                        validationError.index === index &&
                        validationError.missingKey
                          ? `field-${index}-key-error`
                          : undefined
                      }
                    />
                  </label>
                  {validationError?.scope === 'field' &&
                    validationError.index === index &&
                    validationError.missingKey && (
                      <p
                        id={`field-${index}-key-error`}
                        className={styles.fieldError}
                        role='alert'
                      >
                        Field key is required.
                      </p>
                    )}
                </div>

                <div>
                  <label>
                    Label (display)
                    <br />
                    <input
                      type='text'
                      value={field.label}
                      onChange={(e) =>
                        handleUpdateField(index, {label: e.target.value})
                      }
                      placeholder='e.g., Power Level'
                      className={
                        validationError?.scope === 'field' &&
                        validationError.index === index &&
                        validationError.missingLabel
                          ? styles.invalidInput
                          : undefined
                      }
                      aria-invalid={
                        (validationError?.scope === 'field' &&
                          validationError.index === index &&
                          validationError.missingLabel) ||
                        undefined
                      }
                      aria-describedby={
                        validationError?.scope === 'field' &&
                        validationError.index === index &&
                        validationError.missingLabel
                          ? `field-${index}-label-error`
                          : undefined
                      }
                    />
                  </label>
                  {validationError?.scope === 'field' &&
                    validationError.index === index &&
                    validationError.missingLabel && (
                      <p
                        id={`field-${index}-label-error`}
                        className={styles.fieldError}
                        role='alert'
                      >
                        Field label is required.
                      </p>
                    )}
                </div>

                <div>
                  <label>
                    Field Type
                    <br />
                    <select
                      value={field.type}
                      onChange={(e) =>
                        handleUpdateField(index, {
                          type: e.target.value as FieldDefinition['type']
                        })
                      }
                    >
                      <option value='text'>Text</option>
                      <option value='textarea'>Textarea</option>
                      <option value='number'>Number</option>
                      <option value='select'>Select (Dropdown)</option>
                      <option value='multiselect'>
                        Multi-Select (Checkboxes)
                      </option>
                      <option value='checkbox'>Checkbox (Yes/No)</option>
                      <option value='dice'>Dice Roll (e.g., 3d6)</option>
                      <option value='modifier'>Modifier (+/-)</option>
                    </select>
                  </label>
                </div>

                <div className={styles.checkboxGroup}>
                  <label>
                    <input
                      type='checkbox'
                      checked={field.required || false}
                      onChange={(e) =>
                        handleUpdateField(index, {required: e.target.checked})
                      }
                    />
                    Required field
                  </label>
                </div>

                {(field.type === 'select' || field.type === 'multiselect') && (
                  <div className={styles.fullWidth}>
                    <label>
                      Options (one per line)
                      <br />
                      <textarea
                        value={(field.options || []).join('\n')}
                        onChange={(e) =>
                          handleUpdateField(index, {
                            // if handleUpdateField *replaces* the field,
                            // keep the other props:
                            ...field,
                            options: e.target.value
                              .split('\n')
                              .map((s) => s.trim())
                          })
                        }
                        rows={4}
                        placeholder={'Common\nUncommon\nRare\nLegendary'}
                      />
                    </label>
                  </div>
                )}

                {field.type === 'dice' && (
                  <div className={styles.fullWidth}>
                    <label>
                      <input
                        type='checkbox'
                        checked={field.diceConfig?.allowMultipleDice || false}
                        onChange={(e) =>
                          handleUpdateField(index, {
                            diceConfig: {allowMultipleDice: e.target.checked}
                          })
                        }
                      />{' '}
                      Allow multiple dice (e.g., "3d6" instead of just "1d20")
                    </label>
                  </div>
                )}
              </div>
            )}

            {editingFieldIndex !== index && (
              <div className={styles.fieldMeta}>
                Key: <code>{field.key}</code> • Type: {field.type}
                {field.required && ' • Required'}
                {field.type === 'select' &&
                  ` • ${field.options?.length || 0} options`}
              </div>
            )}
          </div>
        ))}

        <button
          type='button'
          onClick={handleAddField}
          className={styles.addFieldButton}
        >
          + Add Field
        </button>
      </div>

      <div className={styles.footer}>
        <button onClick={handleSave} className={styles.primaryButton}>
          Save Category
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default CategoryEditor;
