import type {EntityCategory} from '../../entityTypes';
import {WorldBibleRichTextField} from '../WorldBibleRichTextField';
import styles from '../../assets/components/WorldBibleRoute.module.css';

interface EntityFieldEditorProps {
  field: EntityCategory['fieldSchema'][number];
  fieldValues: Record<string, string>;
  variant: 'character' | 'default';
  onFieldValuesChange: (fieldValues: Record<string, string>) => void;
}

export function EntityFieldEditor({
  field,
  fieldValues,
  variant,
  onFieldValuesChange
}: EntityFieldEditorProps) {
  const setFieldValue = (value: string) => {
    onFieldValuesChange({...fieldValues, [field.key]: value});
  };

  return (
    <div className={styles.formGroup}>
      {field.type === 'textarea' ? (
        <WorldBibleRichTextField
          label={field.label}
          required={field.required}
          value={fieldValues[field.key] || ''}
          variant={variant}
          onChange={setFieldValue}
        />
      ) : (
        <label>
          {field.label}
          {field.required && ' *'}
          {field.type === 'select' ? (
            <select
              value={fieldValues[field.key] || ''}
              onChange={(event) => setFieldValue(event.target.value)}
              required={field.required}
            >
              <option value=''>-- Select --</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : field.type === 'multiselect' ? (
            <div className={styles.multiselectContainer}>
              {field.options?.map((option) => (
                <label key={option} className={styles.multiselectOption}>
                  <input
                    type='checkbox'
                    checked={(fieldValues[field.key] || '')
                      .split(',')
                      .includes(option)}
                    onChange={(event) => {
                      const current = (fieldValues[field.key] || '')
                        .split(',')
                        .filter(Boolean);
                      const updated = event.target.checked
                        ? [...current, option]
                        : current.filter((value) => value !== option);
                      setFieldValue(updated.join(','));
                    }}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          ) : field.type === 'checkbox' ? (
            <input
              type='checkbox'
              checked={fieldValues[field.key] === 'true'}
              onChange={(event) =>
                setFieldValue(event.target.checked ? 'true' : 'false')
              }
            />
          ) : field.type === 'dice' ? (
            <input
              type='text'
              value={fieldValues[field.key] || ''}
              onChange={(event) => setFieldValue(event.target.value)}
              placeholder={
                field.diceConfig?.allowMultipleDice
                  ? 'e.g., 3d6, 2d8+1d4'
                  : 'e.g., 1d20'
              }
              pattern={field.diceConfig?.allowMultipleDice ? '.*' : '1d\\d+'}
              required={field.required}
            />
          ) : field.type === 'modifier' ? (
            <input
              type='text'
              value={fieldValues[field.key] || ''}
              onChange={(event) => setFieldValue(event.target.value)}
              placeholder='e.g., +5, -2'
              pattern='[+-]?\\d+'
              required={field.required}
            />
          ) : (
            <input
              type={field.type}
              value={fieldValues[field.key] || ''}
              onChange={(event) => setFieldValue(event.target.value)}
              required={field.required}
            />
          )}
        </label>
      )}
    </div>
  );
}
