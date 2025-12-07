import {useState} from 'react';
import type {EntityCategory, FieldDefinition} from '../entityTypes';
import {saveCategory} from '../categoryStorage';
import styles from '../assets/components/CategoryEditor.module.css';

interface CategoryEditorProps {
  category: EntityCategory;
  onSave: (category: EntityCategory) => void;
  onCancel: () => void;
}

function CategoryEditor({category, onSave, onCancel}: CategoryEditorProps) {
  const [name, setName] = useState(category.name);
  const [fields, setFields] = useState<FieldDefinition[]>(category.fieldSchema);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(
    null
  );

  const handleAddField = () => {
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
  };

  const handleDeleteField = (index: number) => {
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
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Category name is required');
      return;
    }

    for (const field of fields) {
      if (!field.key.trim() || !field.label.trim()) {
        alert('All fields must have a key and label');
        return;
      }
    }

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
            onChange={(e) => setName(e.target.value)}
            className={styles.nameInput}
          />
        </label>
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
                    />
                  </label>
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
                    />
                  </label>
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
