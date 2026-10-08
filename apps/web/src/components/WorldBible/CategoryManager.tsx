import {useCallback, useEffect, useRef, useState} from 'react';
import {useLocation} from 'react-router';
import type {EntityCategory} from '../../entityTypes';
import {deleteCategory, saveCategory} from '../../categoryStorage';
import CategoryEditor from '../CategoryEditor';
import {useConfirmDialog} from '../../hooks/useConfirmDialog';
import {useEscapeToClose} from '../../hooks/useEscapeToClose';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import styles from '../../assets/components/WorldBibleRoute.module.css';
import dialogStyles from '../../assets/components/WorldBible/CategoryManagerDialog.module.css';
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

/**
 * Modal dialog for adding, editing, and deleting World Bible categories.
 * Focus moves into it; Escape backs out of field editing, then closes it; it
 * also closes when the route navigates.
 */
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
  const {requestConfirm, confirmDialog, isConfirmOpen} = useConfirmDialog();
  const dialogRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const openedAtLocationKey = useRef(location.key);

  // An open delete confirmation handles its own Escape.
  const handleEscape = useCallback(() => {
    if (editingCategory) {
      setEditingCategory(null);
    } else {
      onClose();
    }
  }, [editingCategory, onClose]);
  useEscapeToClose(handleEscape, !isConfirmOpen);
  useFocusTrap(dialogRef, true);

  useEffect(() => {
    if (location.key !== openedAtLocationKey.current) onClose();
  }, [location.key, onClose]);

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

  const renderCategoryList = () => (
    <div>
      <div className={styles.addCategoryForm}>
        <input
          type='text'
          aria-label='New category name'
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
    </div>
  );

  return (
    <>
      <div className={dialogStyles.overlay} role='presentation' onClick={onClose}>
        <div
          ref={dialogRef}
          role='dialog'
          aria-modal='true'
          aria-labelledby='category-manager-title'
          className={dialogStyles.card}
          onClick={(event) => event.stopPropagation()}
        >
          <div className={dialogStyles.header}>
            <div>
              <h2 id='category-manager-title' className={dialogStyles.title}>
                {editingCategory ? `Edit ${editingCategory.name} fields` : 'Manage Categories'}
              </h2>
              <p className={dialogStyles.subtitle}>
                Categories and their fields apply to every record in this project.
              </p>
            </div>
          </div>
          {editingCategory ? (
            <CategoryEditor
              category={editingCategory}
              onSave={handleSaveCategory}
              onCancel={() => setEditingCategory(null)}
            />
          ) : (
            renderCategoryList()
          )}
        </div>
      </div>
      {/* Outside the dialog card so its focus trap does not compete with this one. */}
      {confirmDialog}
    </>
  );
}
