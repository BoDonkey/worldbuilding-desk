import {useState} from 'react';
import type {EntityCategory} from '../../entityTypes';
import {deleteCategory, saveCategory} from '../../categoryStorage';
import CategoryEditor from '../CategoryEditor';
import styles from '../../assets/components/WorldBibleRoute.module.css';

interface CategoryManagerProps {
  projectId: string;
  categories: EntityCategory[];
  onCategoriesChange: (categories: EntityCategory[]) => void;
  onClose: () => void;
}

export function CategoryManager({
  projectId,
  categories,
  onCategoriesChange,
  onClose
}: CategoryManagerProps) {
  const [newCatName, setNewCatName] = useState('');
  const [editingCategory, setEditingCategory] = useState<EntityCategory | null>(
    null
  );

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;

    const category: EntityCategory = {
      id: crypto.randomUUID(),
      projectId,
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

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category? All entities in it will be orphaned.'))
      return;
    await deleteCategory(id);
    onCategoriesChange(categories.filter((category) => category.id !== id));
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
      <CategoryEditor
        category={editingCategory}
        onSave={handleSaveCategory}
        onCancel={() => setEditingCategory(null)}
      />
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

      <ul className={styles.categoryList}>
        {categories.map((category) => (
          <li key={category.id} className={styles.categoryItem}>
            <div className={styles.categoryInfo}>
              <strong>{category.name}</strong>
              <span className={styles.categoryMeta}>
                ({category.fieldSchema.length} fields)
              </span>
            </div>
            <div className={styles.categoryActions}>
              <button onClick={() => setEditingCategory(category)}>
                Edit Fields
              </button>
              <button
                onClick={() => handleDeleteCategory(category.id)}
                className={styles.deleteButton}
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
}
