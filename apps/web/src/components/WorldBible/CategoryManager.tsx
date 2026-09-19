import {useState} from 'react';
import type {EntityCategory} from '../../entityTypes';
import {deleteCategory, saveCategory} from '../../categoryStorage';
import CategoryEditor from '../CategoryEditor';
import {useConfirmDialog} from '../../hooks/useConfirmDialog';
import styles from '../../assets/components/WorldBibleRoute.module.css';
import {
  SYSTEM_NEGATIVE_SPACE_CATEGORY_NAME,
  SYSTEM_NEGATIVE_SPACE_DESCRIPTION,
  createSystemNegativeSpaceCategory,
  isSystemNegativeSpaceCategory
} from '../../services/worldBible/systemNegativeSpace';

interface CategoryManagerProps {
  projectId: string;
  categories: EntityCategory[];
  /** Game-systems projects may opt in to the built-in "Problems Power Cannot Solve" category. */
  canAddSystemNegativeSpace?: boolean;
  onCategoriesChange: (categories: EntityCategory[]) => void;
  onClose: () => void;
}

export function CategoryManager({
  projectId,
  categories,
  canAddSystemNegativeSpace = false,
  onCategoriesChange,
  onClose
}: CategoryManagerProps) {
  const [newCatName, setNewCatName] = useState('');
  const [editingCategory, setEditingCategory] = useState<EntityCategory | null>(
    null
  );
  const {requestConfirm, confirmDialog} = useConfirmDialog();

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;

    const category: EntityCategory = {
      id: crypto.randomUUID(),
      projectId,
      kind: 'general',
      name: newCatName,
      slug: newCatName.toLowerCase().replace(/\s+/g, '-'),
      fieldSchema: [
        {key: 'description', label: 'Description', type: 'textarea'}
      ],
      createdAt: Date.now()
    };

    await saveCategory(category);
    onCategoriesChange([...categories, category]);
    setNewCatName('');
  };

  const showSystemNegativeSpaceOffer =
    canAddSystemNegativeSpace && !categories.some(isSystemNegativeSpaceCategory);

  const handleAddSystemNegativeSpace = async () => {
    const category = createSystemNegativeSpaceCategory(projectId);
    await saveCategory(category);
    onCategoriesChange([
      ...categories.filter((existing) => existing.id !== category.id),
      category
    ]);
  };

  const handleDeleteCategory = (id: string) => {
    requestConfirm({
      title: 'Delete this category?',
      message: 'All entities in it will be orphaned.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        await deleteCategory(id);
        onCategoriesChange(categories.filter((category) => category.id !== id));
      }
    });
  };

  const handleSaveCategory = (updated: EntityCategory) => {
    onCategoriesChange(
      categories.map((category) =>
        category.id === updated.id ? updated : category
      )
    );
    setEditingCategory(null);
  };

  if (editingCategory) {
    return (
      <>
        <CategoryEditor
          category={editingCategory}
          onSave={handleSaveCategory}
          onCancel={() => setEditingCategory(null)}
        />
        {confirmDialog}
      </>
    );
  }

  return (
    <div className={styles.categoryManager}>
      <h3>Manage Categories</h3>
      <div className={styles.addCategoryForm}>
        <input
          type='text'
          placeholder='New category name (e.g., Monsters)'
          value={newCatName}
          onChange={(event) => setNewCatName(event.target.value)}
        />
        <button onClick={handleAddCategory}>Add Category</button>
      </div>

      {showSystemNegativeSpaceOffer && (
        <div className={styles.categoryItem}>
          <div className={styles.categoryInfo}>
            <strong>Optional: {SYSTEM_NEGATIVE_SPACE_CATEGORY_NAME}</strong>
            <span className={styles.categoryMeta}>{SYSTEM_NEGATIVE_SPACE_DESCRIPTION}</span>
          </div>
          <div className={styles.categoryActions}>
            <button onClick={() => void handleAddSystemNegativeSpace()}>
              Add {SYSTEM_NEGATIVE_SPACE_CATEGORY_NAME}
            </button>
          </div>
        </div>
      )}

      <ul className={styles.categoryList}>
        {categories.map((category) => (
          <li key={category.id} className={styles.categoryItem}>
            <div className={styles.categoryInfo}>
              <strong>{category.name}</strong>
              <span className={styles.categoryMeta}>
                ({category.fieldSchema.length} fields
                {isSystemNegativeSpaceCategory(category) ? ' · built-in mechanics record' : ''})
              </span>
            </div>
            <div className={styles.categoryActions}>
              {!isSystemNegativeSpaceCategory(category) && (
                <button onClick={() => setEditingCategory(category)}>
                  Edit Fields
                </button>
              )}
              <button
                onClick={() => handleDeleteCategory(category.id)}
                className={styles.deleteButton}
                aria-label={`Delete ${category.name}`}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button onClick={onClose} className={styles.closeButton}>
        Close
      </button>

      {confirmDialog}
    </div>
  );
}
