import {useEffect, useState, useCallback} from 'react';
import type {FormEvent} from 'react';
import type {EntityCategory, Project, WorldEntity} from '../entityTypes';
import {getEntitiesByProject, saveEntity, deleteEntity} from '../entityStorage';
import {
  getCategoriesByProject,
  saveCategory,
  deleteCategory,
  initializeDefaultCategories
} from '../categoryStorage';
import CategoryEditor from '../components/CategoryEditor';
import styles from '../assets/components/WorldBibleRoute.module.css';
import type {RAGProvider} from '../services/rag/RAGService';
import {getRAGService} from '../services/rag/getRAGService';
import type {
  ShodhMemoryProvider,
  MemoryEntry
} from '../services/shodh/ShodhMemoryService';
import {getShodhService} from '../services/shodh/getShodhService';
import {emitShodhMemoriesUpdated} from '../services/shodh/shodhEvents';
import {ShodhMemoryPanel} from '../components/ShodhMemoryPanel';
import {
  getSeriesBibleConfig,
  promoteMemoryToParent,
  promoteDocumentToParent,
  getCanonSyncState,
  syncChildWithParent
} from '../services/seriesBible/SeriesBibleService';

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
  const [ragService, setRagService] = useState<RAGProvider | null>(null);
  const [shodhService, setShodhService] =
    useState<ShodhMemoryProvider | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memoryFilter, setMemoryFilter] = useState('');
  const seriesConfig = activeProject
    ? getSeriesBibleConfig(activeProject)
    : null;
  const [canonState, setCanonState] = useState<{
    parentCanonVersion?: string;
    childLastSynced?: string;
    parentName?: string;
  }>({});
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isSubmittingEntity, setIsSubmittingEntity] = useState(false);
  const [deletingEntityId, setDeletingEntityId] = useState<string | null>(null);
  const [promotingEntityId, setPromotingEntityId] = useState<string | null>(null);
  const [promotingMemoryId, setPromotingMemoryId] = useState<string | null>(null);
  const [isSyncingCanon, setIsSyncingCanon] = useState(false);
  const refreshMemories = useCallback(async () => {
    if (!shodhService) {
      setMemories([]);
      emitShodhMemoriesUpdated([]);
      return;
    }
    const list = await shodhService.listMemories();
    setMemories(list);
    emitShodhMemoriesUpdated(list);
  }, [shodhService]);

  const handlePromoteMemory = useCallback(
    async (memory: MemoryEntry) => {
      if (!seriesConfig?.parentProjectId) return;
      setPromotingMemoryId(memory.id);
      setFeedback(null);
      try {
        await promoteMemoryToParent(memory, seriesConfig.parentProjectId);
        await refreshMemories();
        setFeedback({tone: 'success', message: 'Memory promoted to parent canon.'});
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to promote memory.';
        setFeedback({tone: 'error', message});
      } finally {
        setPromotingMemoryId(null);
      }
    },
    [seriesConfig?.parentProjectId, refreshMemories]
  );

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
    void refreshMemories();
  }, [refreshMemories]);

  useEffect(() => {
    if (!activeTab && categories.length > 0) {
      setActiveTab(categories[0].id);
    }
  }, [categories, activeTab]);

  useEffect(() => {
    if (!activeProject) {
      setRagService(null);
      setShodhService(null);
      return;
    }

    const bibleConfig = getSeriesBibleConfig(activeProject);
    const ragOptions =
      bibleConfig.parentProjectId && bibleConfig.inheritRag
        ? {
            projectId: activeProject.id,
            inheritFromParent: true,
            parentProjectId: bibleConfig.parentProjectId
          }
        : {projectId: activeProject.id};
    const shodhOptions =
      bibleConfig.parentProjectId && bibleConfig.inheritShodh
        ? {
            projectId: activeProject.id,
            inheritFromParent: true,
            parentProjectId: bibleConfig.parentProjectId
          }
        : {projectId: activeProject.id};

    let cancelled = false;
    Promise.all([getRAGService(ragOptions), getShodhService(shodhOptions)]).then(
      ([rag, shodh]) => {
        if (!cancelled) {
          setRagService(rag);
          setShodhService(shodh);
        }
      }
    );

    return () => {
      cancelled = true;
      setRagService(null);
      setShodhService(null);
    };
  }, [activeProject]);

  useEffect(() => {
    let cancelled = false;
    if (!activeProject || !seriesConfig?.parentProjectId) {
      setCanonState({});
      return;
    }
    getCanonSyncState(activeProject).then((state) => {
      if (!cancelled) {
        setCanonState(state);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject, seriesConfig?.parentProjectId]);

  useEffect(() => {
    if (!ragService) return;
    const vocabulary = entities.map((entity) => ({
      id: entity.id,
      terms: [
        entity.name,
        ...Object.values(entity.fields).filter(
          (value): value is string => typeof value === 'string'
        )
      ]
    }));
    ragService.setEntityVocabulary(vocabulary);
  }, [entities, ragService]);

  const activeCategory = categories.find((c) => c.id === activeTab);
  const filteredEntities = entities.filter((e) => e.categoryId === activeTab);
  const currentEntityMemories = editingId
    ? memories.filter((memory) => memory.documentId === editingId)
    : [];
  const memoryPanelEmpty =
    'This entry has no captured memories yet. Save it to generate one or adjust the filter.';

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setFieldValues({});
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeProject || !activeCategory) return;

    setIsSubmittingEntity(true);
    setFeedback(null);
    try {
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
      if (ragService) {
        await ragService.indexDocument(
          entity.id,
          entity.name,
          buildEntityContent(entity),
          'worldbible',
          {
            tags: [activeCategory.slug],
            entityIds: [entity.id]
          }
        );
      }
      if (shodhService) {
        await shodhService.captureAutoMemory({
          projectId: activeProject.id,
          documentId: entity.id,
          title: entity.name,
          content: buildEntityContent(entity),
          tags: ['worldbible', activeCategory.slug]
        });
        await refreshMemories();
      }

      setEntities((prev) => {
        const idx = prev.findIndex((e) => e.id === id);
        if (idx === -1) return [...prev, entity];
        const copy = [...prev];
        copy[idx] = entity;
        return copy;
      });

      resetForm();
      setFeedback({
        tone: 'success',
        message: editingId ? 'Entry updated.' : 'Entry created.'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save entry.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsSubmittingEntity(false);
    }
  };

  const handleEdit = (entity: WorldEntity) => {
    setEditingId(entity.id);
    setName(entity.name);
    setFieldValues(entity.fields as Record<string, string>);
  };

  const handleDeleteEntity = async (id: string) => {
    if (!confirm('Delete this entity?')) return;
    setDeletingEntityId(id);
    setFeedback(null);
    try {
      await deleteEntity(id);
      if (ragService) {
        await ragService.deleteDocument(id);
      }
      if (shodhService) {
        await shodhService.deleteMemoriesForDocument(id);
        await refreshMemories();
      }
      setEntities((prev) => prev.filter((e) => e.id !== id));
      if (editingId === id) resetForm();
      setFeedback({tone: 'success', message: 'Entry deleted.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to delete entry.';
      setFeedback({tone: 'error', message});
    } finally {
      setDeletingEntityId(null);
    }
  };

  const buildEntityContent = (entity: WorldEntity) => {
    const fieldText = Object.entries(entity.fields)
      .map(([key, value]) => `${key}: ${value ?? ''}`)
      .join('\n');
    return `${entity.name}\n${fieldText}`;
  };
  const handlePromoteEntity = async (entity: WorldEntity) => {
    if (!seriesConfig?.parentProjectId) return;
    setPromotingEntityId(entity.id);
    setFeedback(null);
    try {
      await promoteDocumentToParent({
        parentProjectId: seriesConfig.parentProjectId,
        documentId: entity.id,
        title: entity.name,
        content: buildEntityContent(entity),
        type: 'worldbible',
        tags: [activeCategory?.slug ?? 'worldbible']
      });
      setFeedback({tone: 'success', message: 'Entry promoted to parent canon.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to promote entry.';
      setFeedback({tone: 'error', message});
    } finally {
      setPromotingEntityId(null);
    }
  };
  const handleCanonSync = async () => {
    if (!activeProject) return;
    setIsSyncingCanon(true);
    setFeedback(null);
    try {
      const updated = await syncChildWithParent(activeProject.id);
      if (updated) {
        setCanonState((prev) => ({
          ...prev,
          childLastSynced: updated.lastSyncedCanon
        }));
      }
      setFeedback({tone: 'success', message: 'Canon sync state updated.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to mark canon as synced.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsSyncingCanon(false);
    }
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
      {feedback && (
        <p
          role='status'
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            border: `1px solid ${
              feedback.tone === 'error' ? '#fecaca' : '#bbf7d0'
            }`,
            backgroundColor:
              feedback.tone === 'error' ? '#fef2f2' : '#f0fdf4',
            color: feedback.tone === 'error' ? '#991b1b' : '#166534'
          }}
        >
          {feedback.message}
        </p>
      )}
      {seriesConfig?.parentProjectId && (
        <div className={styles.banner}>
          <strong>Parent canon:</strong> {canonState.parentName ?? 'Unknown'} ·
          Version {canonState.parentCanonVersion ?? 'n/a'}
          {canonState.parentCanonVersion &&
            canonState.childLastSynced &&
            canonState.parentCanonVersion !== canonState.childLastSynced && (
              <span className={styles.outOfSync}>Out of sync</span>
            )}
          <div className={styles.syncRow}>
            <span>
              Last synced:{' '}
              {canonState.childLastSynced ?? 'never'}
            </span>
            <button
              type='button'
              onClick={() => void handleCanonSync()}
              disabled={isSyncingCanon}
            >
              {isSyncingCanon ? 'Marking...' : 'Mark as synced'}
            </button>
          </div>
        </div>
      )}

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
                <button
                  type='submit'
                  className={styles.primaryButton}
                  disabled={isSubmittingEntity}
                >
                  {isSubmittingEntity
                    ? 'Saving...'
                    : editingId
                      ? 'Save Changes'
                      : 'Create'}
                </button>
                {editingId && (
                  <button type='button' onClick={resetForm} disabled={isSubmittingEntity}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
            {editingId && (
              <ShodhMemoryPanel
                title='Canon summary'
                memories={currentEntityMemories}
                filterValue={memoryFilter}
                onFilterChange={setMemoryFilter}
                highlightDocumentId={editingId}
                onRefresh={() => void refreshMemories()}
                pageSize={0}
                scopeSummaryLabel='this entry'
                emptyState={memoryPanelEmpty}
                renderSourceLabel={(memory) =>
                  memory.projectId === activeProject.id ? 'Local' : 'Parent'
                }
                renderMemoryActions={(memory) => {
                  if (
                    seriesConfig?.parentProjectId &&
                    memory.projectId === activeProject.id
                  ) {
                    return (
                      <button
                        type='button'
                        onClick={() => void handlePromoteMemory(memory)}
                        disabled={promotingMemoryId === memory.id}
                        style={{fontSize: '0.8rem'}}
                      >
                        {promotingMemoryId === memory.id ? 'Promoting...' : 'Promote'}
                      </button>
                    );
                  }
                  return null;
                }}
              />
            )}
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
                      disabled={deletingEntityId === entity.id}
                      className={styles.deleteButton}
                    >
                      {deletingEntityId === entity.id ? 'Deleting...' : 'Delete'}
                    </button>
                    {seriesConfig?.parentProjectId && (
                      <button
                        type='button'
                        onClick={() => void handlePromoteEntity(entity)}
                        disabled={promotingEntityId === entity.id}
                      >
                        {promotingEntityId === entity.id
                          ? 'Promoting...'
                          : 'Promote to parent'}
                      </button>
                    )}
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
