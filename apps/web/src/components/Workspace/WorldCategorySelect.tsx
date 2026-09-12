import {useId, useState} from 'react';
import type {EntityCategory} from '../../entityTypes';
import styles from './WorldCategorySelect.module.css';
import {describeError} from '../../services/errors';

interface WorldCategorySelectProps {
  categories: EntityCategory[];
  value: string;
  onChange: (categoryId: string) => void;
  onCreate: (name: string) => Promise<EntityCategory>;
  ariaLabel?: string;
}

const CREATE_CATEGORY_VALUE = '__create_category__';

export function WorldCategorySelect({
  categories,
  value,
  onChange,
  onCreate,
  ariaLabel = 'World Bible type'
}: WorldCategorySelectProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const errorId = useId();

  const closeCreator = () => {
    setIsCreating(false);
    setDraftName('');
    setError('');
  };

  const createCategory = async () => {
    if (!draftName.trim() || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      const category = await onCreate(draftName);
      onChange(category.id);
      closeCreator();
    } catch (cause) {
      setError(
        describeError(cause, 'Unable to create this World Bible type.')
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.control}>
      <select
        value={isCreating ? CREATE_CATEGORY_VALUE : value}
        onChange={(event) => {
          if (event.target.value === CREATE_CATEGORY_VALUE) {
            setIsCreating(true);
            setError('');
            return;
          }
          closeCreator();
          onChange(event.target.value);
        }}
        aria-label={ariaLabel}
      >
        <option value=''>Choose a type</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
        <option value={CREATE_CATEGORY_VALUE}>Create a new type…</option>
      </select>
      {isCreating ? (
        <>
          <div className={styles.newCategoryRow}>
            <input
              type='text'
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void createCategory();
                }
              }}
              placeholder='New type (e.g., Factions)'
              aria-label='New World Bible type name'
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              autoFocus
            />
            <button
              type='button'
              onClick={() => void createCategory()}
              disabled={isSaving || !draftName.trim()}
            >
              {isSaving ? 'Adding…' : 'Add type'}
            </button>
            <button type='button' onClick={closeCreator} disabled={isSaving}>
              Cancel
            </button>
          </div>
          {error ? <p id={errorId} className={styles.error} role='alert'>{error}</p> : null}
        </>
      ) : null}
    </div>
  );
}
