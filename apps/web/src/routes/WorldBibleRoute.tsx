import {useEffect, useState} from 'react';
import type {FormEvent} from 'react';
import type {
  EntityCategory,
  Project,
  WorldEntity
} from '../entityTypes';
import {getEntitiesByProject, saveEntity, deleteEntity} from '../entityStorage';
import {
  getCategoriesByProject,
  saveCategory,
  deleteCategory,
  initializeDefaultCategories
} from '../categoryStorage';
import CategoryEditor from '../components/CategoryEditor';
import styles from '../assets/components/WorldBibleRoute.module.css';

interface WorldBibleRouteProps {
  activeProject: Project | null;
}

function WorldBibleRoute({activeProject}: WorldBibleRouteProps) {
  const [categories, setCategories] = useState<EntityCategory[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  useEffect(() => {
    if (!activeProject) return;

    let cancelled = false;

    (async () => {
      const projectId = activeProject.id;

      await initializeDefaultCategories(projectId);

      const [cats, ents] = await Promise.all([
        getCategoriesByProject(projectId),
        getEntitiesByProject(projectId)
      ]);

      if (!cancelled) {
        setCategories(cats);
        setEntities(ents);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  useEffect(() => {
    if (!activeTab && categories.length > 0) {
      setActiveTab(categories[0].id);
    }
  }, [categories, activeTab]);

  const activeCategory = categories.find((c) => c.id === activeTab);
  const filteredEntities = entities.filter((e) => e.categoryId === activeTab);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setFieldValues({});
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeProject || !activeCategory) return;

    const now = Date.now();
    const id = editingId ?? crypto.randomUUID();
    const existing = entities.find((e) => e.id === id);

    const entity: WorldEntity = {
      id,
      projectId: activeProject.id,
      categoryId: activeCategory.id,
      name,
      fields: {...fieldValues},
      links: existing?.links ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    await saveEntity(entity);

    setEntities((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx === -1) return [...prev, entity];
      const copy = [...prev];
      copy[idx] = entity;
      return copy;
    });

    resetForm();
  };

  const handleEdit = (entity: WorldEntity) => {
    setEditingId(entity.id);
    setName(entity.name);
    setFieldValues(entity.fields as Record<string, string>);
  };

  const handleDeleteEntity = async (id: string) => {
    if (!confirm('Delete this entity?')) return;
    await deleteEntity(id);
    setEntities((prev) => prev.filter((e) => e.id !== id));
    if (editingId === id) resetForm();
  };

  if (!activeProject) {
    return (
      <section className={styles.noProject}>
        <h1>World Bible</h1>
        <p>
          No active project. Go to <strong>Projects</strong> to create or open a
          project first.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <h1>World Bible</h1>
      </div>

      <div className={styles.tabNav}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveTab(cat.id)}
            className={`${styles.tab} ${
              activeTab === cat.id ? styles.active : ''
            }`}
          >
            {cat.name}
          </button>
        ))}
        <button
          onClick={() => setShowCategoryManager(!showCategoryManager)}
          className={styles.manageButton}
        >
          {showCategoryManager ? 'Close' : 'Manage Categories'}
        </button>
      </div>

      {showCategoryManager && (
        <CategoryManager
          projectId={activeProject.id}
          categories={categories}
          onCategoriesChange={setCategories}
          onClose={() => setShowCategoryManager(false)}
        />
      )}

      {activeCategory && (
        <div className={styles.content}>
          <div className={styles.formSection}>
            <form onSubmit={handleSubmit} className={styles.form}>
              <h2>
                {editingId ? 'Edit' : 'New'} {activeCategory.name.slice(0, -1)}
              </h2>

              <div className={styles.formGroup}>
                <label>
                  Name
                  <input
                    type='text'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </label>
              </div>

              {activeCategory.fieldSchema.map((field) => (
                <div key={field.key} className={styles.formGroup}>
                  <label>
                    {field.label}
                    {field.required && ' *'}
                    {field.type === 'textarea' ? (
                      <textarea
                        value={fieldValues[field.key] || ''}
                        onChange={(e) =>
                          setFieldValues({
                            ...fieldValues,
                            [field.key]: e.target.value
                          })
                        }
                        rows={4}
                        required={field.required}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={fieldValues[field.key] || ''}
                        onChange={(e) =>
                          setFieldValues({
                            ...fieldValues,
                            [field.key]: e.target.value
                          })
                        }
                        required={field.required}
                      >
                        <option value=''>-- Select --</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'multiselect' ? (
                      <div className={styles.multiselectContainer}>
                        {field.options?.map((opt) => (
                          <label key={opt} className={styles.multiselectOption}>
                            <input
                              type='checkbox'
                              checked={(fieldValues[field.key] || '')
                                .split(',')
                                .includes(opt)}
                              onChange={(e) => {
                                const current = (fieldValues[field.key] || '')
                                  .split(',')
                                  .filter(Boolean);
                                const updated = e.target.checked
                                  ? [...current, opt]
                                  : current.filter((v) => v !== opt);
                                setFieldValues({
                                  ...fieldValues,
                                  [field.key]: updated.join(',')
                                });
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <input
                        type='checkbox'
                        checked={fieldValues[field.key] === 'true'}
                        onChange={(e) =>
                          setFieldValues({
                            ...fieldValues,
                            [field.key]: e.target.checked ? 'true' : 'false'
                          })
                        }
                      />
                    ) : field.type === 'dice' ? (
                      <input
                        type='text'
                        value={fieldValues[field.key] || ''}
                        onChange={(e) =>
                          setFieldValues({
                            ...fieldValues,
                            [field.key]: e.target.value
                          })
                        }
                        placeholder={
                          field.diceConfig?.allowMultipleDice
                            ? 'e.g., 3d6, 2d8+1d4'
                            : 'e.g., 1d20'
                        }
                        pattern={
                          field.diceConfig?.allowMultipleDice ? '.*' : '1d\\d+'
                        }
                        required={field.required}
                      />
                    ) : field.type === 'modifier' ? (
                      <input
                        type='text'
                        value={fieldValues[field.key] || ''}
                        onChange={(e) =>
                          setFieldValues({
                            ...fieldValues,
                            [field.key]: e.target.value
                          })
                        }
                        placeholder='e.g., +5, -2'
                        pattern='[+-]?\\d+'
                        required={field.required}
                      />
                    ) : (
                      <input
                        type={field.type}
                        value={fieldValues[field.key] || ''}
                        onChange={(e) =>
                          setFieldValues({
                            ...fieldValues,
                            [field.key]: e.target.value
                          })
                        }
                        required={field.required}
                      />
                    )}
                  </label>
                </div>
              ))}

              <div className={styles.formActions}>
                <button type='submit' className={styles.primaryButton}>
                  {editingId ? 'Save Changes' : 'Create'}
                </button>
                {editingId && (
                  <button type='button' onClick={resetForm}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className={styles.listSection}>
            <h2>{activeCategory.name}</h2>
            {filteredEntities.length === 0 && (
              <p className={styles.emptyState}>
                No {activeCategory.name.toLowerCase()} yet. Add one on the left.
              </p>
            )}
            <ul className={styles.entityList}>
              {filteredEntities.map((entity) => (
                <li key={entity.id} className={styles.entityCard}>
                  <div className={styles.entityName}>{entity.name}</div>
                  {Object.entries(entity.fields).map(([key, value]) => (
                    <div key={key} className={styles.entityField}>
                      <strong>{key}:</strong> {String(value)}
                    </div>
                  ))}
                  <div className={styles.entityActions}>
                    <button onClick={() => handleEdit(entity)}>Edit</button>
                    <button
                      onClick={() => handleDeleteEntity(entity.id)}
                      className={styles.deleteButton}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

interface CategoryManagerProps {
  projectId: string;
  categories: EntityCategory[];
  onCategoriesChange: (cats: EntityCategory[]) => void;
  onClose: () => void;
}

function CategoryManager({
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

    const cat: EntityCategory = {
      id: crypto.randomUUID(),
      projectId,
      name: newCatName,
      slug: newCatName.toLowerCase().replace(/\s+/g, '-'),
      fieldSchema: [
        {key: 'description', label: 'Description', type: 'textarea'}
      ],
      createdAt: Date.now()
    };

    await saveCategory(cat);
    onCategoriesChange([...categories, cat]);
    setNewCatName('');
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category? All entities in it will be orphaned.'))
      return;
    await deleteCategory(id);
    onCategoriesChange(categories.filter((c) => c.id !== id));
  };

  const handleSaveCategory = (updated: EntityCategory) => {
    onCategoriesChange(
      categories.map((c) => (c.id === updated.id ? updated : c))
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
          onChange={(e) => setNewCatName(e.target.value)}
        />
        <button onClick={handleAddCategory}>Add Category</button>
      </div>

      <ul className={styles.categoryList}>
        {categories.map((cat) => (
          <li key={cat.id} className={styles.categoryItem}>
            <div className={styles.categoryInfo}>
              <strong>{cat.name}</strong>
              <span className={styles.categoryMeta}>
                ({cat.fieldSchema.length} fields)
              </span>
            </div>
            <div className={styles.categoryActions}>
              <button onClick={() => setEditingCategory(cat)}>
                Edit Fields
              </button>
              <button
                onClick={() => handleDeleteCategory(cat.id)}
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

export default WorldBibleRoute;
