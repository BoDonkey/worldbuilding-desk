// apps/web/src/routes/CharactersRoute.tsx - NEW FILE
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  Character,
  EntityCategory,
  ProjectSettings,
  WorldEntity
} from '../entityTypes';
import { getCharactersByProject, saveCharacter, deleteCharacter } from '../characterStorage';
import { getEntitiesByProject, saveEntity } from '../entityStorage';
import { getCategoriesByProject, saveCategory } from '../categoryStorage';
import {
  getAliasesByProject,
  type ConsistencyAlias
} from '../services/consistency';
import { CharacterStyleList } from '../components/CharacterStyleList';
import type { CharacterStyle } from '../entityTypes';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';

interface CharactersRouteProps {
  embedded?: boolean;
  onOpenSheets?: (characterId?: string, options?: {autoCreate?: boolean}) => void;
  prefillCharacterId?: string | null;
  onPrefillConsumed?: () => void;
}

const normalizeName = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const dedupeNames = (names: string[]): string[] =>
  Array.from(
    new Map(
      names
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => [normalizeName(value), value])
    ).values()
  );

const CHARACTER_CATEGORY_HINTS = ['character', 'characters', 'npc', 'person', 'people'];
const DEFAULT_CHARACTER_FIELD_SCHEMA: EntityCategory['fieldSchema'] = [
  {key: 'description', label: 'Description', type: 'textarea'},
  {key: 'age', label: 'Age', type: 'text'},
  {key: 'role', label: 'Role', type: 'text'},
  {key: 'notes', label: 'Notes', type: 'textarea'}
];

function CharactersRoute({
  embedded = false,
  onOpenSheets,
  prefillCharacterId = null,
  onPrefillConsumed
}: CharactersRouteProps) {
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const loadProjectSettings = useAppStore((s) => s.loadProjectSettings);
  const saveProjectSettings = useAppStore((s) => s.saveProjectSettings);
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [worldEntities, setWorldEntities] = useState<WorldEntity[]>([]);
  const [categories, setCategories] = useState<EntityCategory[]>([]);
  const [aliases, setAliases] = useState<ConsistencyAlias[]>([]);
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [importingEntityId, setImportingEntityId] = useState<string | null>(null);
  const [showMigrationNotice, setShowMigrationNotice] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [age, setAge] = useState('');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [characterStyleId, setCharacterStyleId] = useState<string>('');

  useEffect(() => {
    if (!activeProject) {
      setCharacters([]);
      setWorldEntities([]);
      setCategories([]);
      setAliases([]);
      setSettings(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const [chars, entities, loadedCategories, loadedAliases] = await Promise.all([
        getCharactersByProject(activeProject.id),
        getEntitiesByProject(activeProject.id),
        getCategoriesByProject(activeProject.id),
        getAliasesByProject(activeProject.id)
      ]);
      const loadedSettings =
        projectSettings && projectSettings.projectId === activeProject.id
          ? projectSettings
          : await loadProjectSettings(activeProject.id);

      if (!cancelled) {
        setCharacters(chars);
        setWorldEntities(entities);
        setCategories(loadedCategories);
        setAliases(loadedAliases);
        setSettings(loadedSettings);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject, loadProjectSettings, projectSettings]);

  useEffect(() => {
    if (!activeProject || !projectSettings || projectSettings.projectId !== activeProject.id) {
      return;
    }
    setSettings(projectSettings);
  }, [activeProject, projectSettings]);

  const migrationCandidates = useMemo(() => {
    const characterCategoryIds = new Set(
      categories
        .filter((category) =>
          CHARACTER_CATEGORY_HINTS.some((hint) =>
            category.slug.toLowerCase().includes(hint)
          )
        )
        .map((category) => category.id)
    );
    if (characterCategoryIds.size === 0) {
      return [];
    }

    const existingNames = new Set(characters.map((character) => normalizeName(character.name)));
    return worldEntities.filter((entity) => {
      if (!characterCategoryIds.has(entity.categoryId)) {
        return false;
      }
      return !existingNames.has(normalizeName(entity.name));
    });
  }, [categories, characters, worldEntities]);

  const characterLoreEntityIdByCharacterId = useMemo(() => {
    const map = new Map<string, string>();
    const characterCategoryIds = new Set(
      categories
        .filter((category) =>
          CHARACTER_CATEGORY_HINTS.some((hint) =>
            category.slug.toLowerCase().includes(hint)
          )
        )
        .map((category) => category.id)
    );
    if (characterCategoryIds.size === 0) {
      return map;
    }

    worldEntities.forEach((entity) => {
      if (!characterCategoryIds.has(entity.categoryId)) {
        return;
      }
      const normalizedEntityName = normalizeName(entity.name);
      const matchingCharacter = characters.find(
        (character) => normalizeName(character.name) === normalizedEntityName
      );
      if (matchingCharacter) {
        map.set(matchingCharacter.id, entity.id);
      }
    });

    return map;
  }, [categories, characters, worldEntities]);

  const characterAliasesById = useMemo(() => {
    const entityAliasesById = new Map<string, string[]>();
    aliases.forEach((alias) => {
      if (alias.targetType !== 'entity') {
        return;
      }
      const current = entityAliasesById.get(alias.targetId) ?? [];
      entityAliasesById.set(alias.targetId, dedupeNames([...current, alias.alias]));
    });

    const map = new Map<string, string[]>();
    characters.forEach((character) => {
      const linkedEntityId = characterLoreEntityIdByCharacterId.get(character.id);
      if (!linkedEntityId) {
        map.set(character.id, []);
        return;
      }
      map.set(character.id, entityAliasesById.get(linkedEntityId) ?? []);
    });
    return map;
  }, [aliases, characters, characterLoreEntityIdByCharacterId]);

  useEffect(() => {
    if (!prefillCharacterId) {
      return;
    }
    const character = characters.find((entry) => entry.id === prefillCharacterId);
    if (!character) {
      onPrefillConsumed?.();
      return;
    }

    setEditingId(character.id);
    setName(character.name);
    setDescription(character.description ?? '');
    setAge(character.fields.age ?? '');
    setRole(character.fields.role ?? '');
    setNotes(character.fields.notes ?? '');
    setCharacterStyleId(character.characterStyleId ?? '');
    onPrefillConsumed?.();
  }, [characters, onPrefillConsumed, prefillCharacterId]);

  useEffect(() => {
    setShowMigrationNotice(true);
  }, [activeProject?.id]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setAge('');
    setRole('');
    setNotes('');
    setCharacterStyleId('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeProject) {
      alert('Select or create a project first.');
      return;
    }

    const now = Date.now();
    const id = editingId ?? crypto.randomUUID();
    const existing = characters.find(c => c.id === id);
    const linkedLoreEntityId = existing
      ? characterLoreEntityIdByCharacterId.get(existing.id)
      : undefined;
    const linkedLoreEntity = linkedLoreEntityId
      ? worldEntities.find((entity) => entity.id === linkedLoreEntityId)
      : undefined;

    if (
      linkedLoreEntity &&
      normalizeName(existing?.name ?? '') !== normalizeName(name.trim())
    ) {
      setFeedback({
        tone: 'error',
        message: 'Rename this character in World Bible so canonical names and aliases stay in one place.'
      });
      return;
    }

    const character: Character = {
      id,
      projectId: activeProject.id,
      name: name.trim(),
      description: description.trim() || undefined,
      characterStyleId: characterStyleId || undefined,
      fields: {
        age: age.trim() || undefined,
        role: role.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    await saveCharacter(character);

    setCharacters(prev => {
      const existingIndex = prev.findIndex(c => c.id === id);
      if (existingIndex === -1) {
        return [...prev, character];
      } else {
        const copy = [...prev];
        copy[existingIndex] = character;
        return copy;
      }
    });

    resetForm();
    setFeedback({
      tone: 'success',
      message: existing ? `"${character.name}" saved.` : `"${character.name}" created.`
    });
  };

  const handleCreateSheet = (character: Character) => {
    if (onOpenSheets) {
      onOpenSheets(character.id);
      return;
    }
    navigate('/characters?view=sheets');
  };

  const ensureCharacterLoreCategory = async (): Promise<EntityCategory> => {
    const existing = categories.find((category) =>
      CHARACTER_CATEGORY_HINTS.some((hint) =>
        category.slug.toLowerCase().includes(hint)
      )
    );
    if (existing) {
      return existing;
    }

    if (!activeProject) {
      throw new Error('Select or create a project first.');
    }

    const category: EntityCategory = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      name: 'Characters',
      slug: 'characters',
      fieldSchema: DEFAULT_CHARACTER_FIELD_SCHEMA,
      createdAt: Date.now()
    };

    await saveCategory(category);
    setCategories((prev) => [...prev, category]);
    return category;
  };

  const handleOpenWorldLore = async (
    character: Character,
    options?: {focus?: 'general' | 'aliases'; matchEntityId?: string}
  ) => {
    if (!activeProject) {
      return;
    }

    setFeedback(null);
    try {
      const existingEntity = worldEntities.find((entity) =>
        normalizeName(entity.name) === normalizeName(character.name)
      );

      if (existingEntity) {
        navigate('/world-bible', {
          state: {
            focusEntityId: existingEntity.id,
            focus: options?.focus ?? 'general',
            handoffKind: options?.focus === 'aliases' ? 'character-canonicalization' : undefined,
            handoffSourceName: options?.focus === 'aliases' ? character.name : undefined,
            handoffMatchEntityId: options?.matchEntityId
          }
        });
        return;
      }

      const category = await ensureCharacterLoreCategory();
      const now = Date.now();
      const entity: WorldEntity = {
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        categoryId: category.id,
        name: character.name,
        fields: {
          ...(character.description ? {description: character.description} : {}),
          ...(typeof character.fields.age === 'string' && character.fields.age.trim()
            ? {age: character.fields.age}
            : {}),
          ...(typeof character.fields.role === 'string' && character.fields.role.trim()
            ? {role: character.fields.role}
            : {}),
          ...(typeof character.fields.notes === 'string' && character.fields.notes.trim()
            ? {notes: character.fields.notes}
            : {})
        },
        isNew: true,
        needsCompletion: false,
        links: [],
        createdAt: now,
        updatedAt: now
      };

      await saveEntity(entity);
      setWorldEntities((prev) => [...prev, entity]);
      setFeedback({
        tone: 'success',
        message: `"${character.name}" now has a World Bible lore entry.`
      });
      navigate('/world-bible', {
        state: {
          focusEntityId: entity.id,
          focus: options?.focus ?? 'general',
          handoffKind: options?.focus === 'aliases' ? 'character-canonicalization' : undefined,
          handoffSourceName: options?.focus === 'aliases' ? character.name : undefined,
          handoffMatchEntityId: options?.matchEntityId
        }
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to open world lore entry.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleImportWorldEntity = async (
    entity: WorldEntity,
    options?: {autoCreateSheet?: boolean}
  ) => {
    if (!activeProject) {
      return;
    }
    setImportingEntityId(entity.id);
    setFeedback(null);
    try {
      const existing = characters.find(
        (character) => normalizeName(character.name) === normalizeName(entity.name)
      );
      const character: Character = existing ?? {
        id: crypto.randomUUID(),
        projectId: activeProject.id,
        name: entity.name,
        description:
          typeof entity.fields.description === 'string'
            ? entity.fields.description
            : undefined,
        fields: {
          age: typeof entity.fields.age === 'string' ? entity.fields.age : undefined,
          role: typeof entity.fields.role === 'string' ? entity.fields.role : undefined,
          notes: typeof entity.fields.notes === 'string' ? entity.fields.notes : undefined
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      if (!existing) {
        await saveCharacter(character);
        setCharacters((prev) => [...prev, character]);
      }

      setFeedback({
        tone: 'success',
        message: existing
          ? `"${entity.name}" already exists in Character Tools.`
          : `"${entity.name}" is now available in Character Tools without changing its World Bible canon record.`
      });

      if (options?.autoCreateSheet) {
        if (onOpenSheets) {
          onOpenSheets(character.id, {autoCreate: true});
        } else {
          navigate('/characters?view=sheets', {
            state: {
              prefillCharacterId: character.id,
              preferredView: 'sheets',
              autoCreateSheetForCharacterId: character.id
            }
          });
        }
        return;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to import world record.';
      setFeedback({tone: 'error', message});
    } finally {
      setImportingEntityId(null);
    }
  };

  const handleEdit = (character: Character) => {
    setEditingId(character.id);
    setName(character.name);
    setDescription(character.description ?? '');
    setAge(character.fields.age ?? '');
    setRole(character.fields.role ?? '');
    setNotes(character.fields.notes ?? '');
    setCharacterStyleId(character.characterStyleId ?? '');
  };

  const handleDelete = async (id: string) => {
    await deleteCharacter(id);
    setCharacters(prev => prev.filter(c => c.id !== id));

    if (editingId === id) {
      resetForm();
    }
  };

  const handleUpdateStyle = async (styleId: string, updates: Partial<CharacterStyle['styles']>) => {
    if (!settings) return;

    const updated: ProjectSettings = {
      ...settings,
      characterStyles: settings.characterStyles.map(s =>
        s.id === styleId
          ? { ...s, styles: { ...s.styles, ...updates } }
          : s
      ),
      updatedAt: Date.now()
    };

    await saveProjectSettings(updated);
    setSettings(updated);
  };

  const handleDeleteStyle = async (styleId: string) => {
    if (!settings) return;

    const updated: ProjectSettings = {
      ...settings,
      characterStyles: settings.characterStyles.filter(s => s.id !== styleId),
      updatedAt: Date.now()
    };

    await saveProjectSettings(updated);
    setSettings(updated);
  };

  if (!activeProject) {
    return <p>No active project selected.</p>;
  }

  const getStyleName = (styleId: string | undefined) => {
    if (!styleId || !settings) return 'None';
    const style = settings.characterStyles.find(s => s.id === styleId);
    return style?.name ?? 'None';
  };
  const editingCharacterHasCanonRecord = Boolean(
    editingId && characterLoreEntityIdByCharacterId.has(editingId)
  );
  const content = (
    <>
      {!embedded && <h1>Character Tools</h1>}
      <p style={{marginTop: 0, marginBottom: '1rem', color: 'var(--color-text-secondary)'}}>
        Use this area for roster-linked profiles, sheets, and supporting tools. Set
        canonical names, aliases, and merge decisions in World Bible.
      </p>
      {feedback && (
        <p
          role='status'
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            border: `1px solid ${feedback.tone === 'error' ? 'var(--color-error-soft-border)' : 'var(--color-success-soft-border)'}`,
            backgroundColor: feedback.tone === 'error' ? 'var(--color-error-soft-bg)' : 'var(--color-success-soft-bg)',
            color: feedback.tone === 'error' ? 'var(--color-error)' : 'var(--color-success)'
          }}
        >
          {feedback.message}
        </p>
      )}
      {showMigrationNotice && migrationCandidates.length > 0 && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.85rem',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            backgroundColor: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)'
          }}
        >
          <div style={{display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start'}}>
            <div>
              <strong>Character Tools is optional here</strong>
              <p style={{margin: '0.4rem 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)'}}>
                These canon records already exist in World Bible. If you want to keep writing,
                dismiss this and continue. If you want a tools profile here, click
                <strong> Open Character Tools</strong>. If you want a sheet immediately, click
                <strong> Open/Create Sheet</strong>.
              </p>
            </div>
            <button type='button' onClick={() => setShowMigrationNotice(false)}>
              Dismiss
            </button>
          </div>
          <div style={{display: 'grid', gap: '0.6rem'}}>
            {migrationCandidates.slice(0, 8).map((entity) => (
              <div
                key={entity.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.7rem',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-bg-primary)'
                }}
              >
                <div>
                  <strong>{entity.name}</strong>
                  {typeof entity.fields.description === 'string' &&
                    entity.fields.description.trim().length > 0 && (
                      <div style={{marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--color-text-tertiary)'}}>
                        {entity.fields.description}
                      </div>
                    )}
                </div>
                <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                  <button
                    type='button'
                    onClick={() => void handleImportWorldEntity(entity)}
                    disabled={importingEntityId === entity.id}
                  >
                    {importingEntityId === entity.id ? 'Opening...' : 'Open Character Tools'}
                  </button>
                  <button
                    type='button'
                    onClick={() => void handleImportWorldEntity(entity, {autoCreateSheet: true})}
                    disabled={importingEntityId === entity.id}
                  >
                    {importingEntityId === entity.id ? 'Opening...' : 'Open/Create Sheet'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
        <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
          <h2>{editingId ? 'Edit Character Tools Profile' : 'New Character Tools Profile'}</h2>
          <div style={{ marginBottom: '0.75rem' }}>
            <label>
              Name *<br />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                disabled={editingCharacterHasCanonRecord}
                style={{ width: '100%' }}
              />
            </label>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label>
              Description<br />
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                style={{ width: '100%' }}
              />
            </label>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label>
              Age<br />
              <input
                type="text"
                value={age}
                onChange={e => setAge(e.target.value)}
                style={{ width: '100%' }}
              />
            </label>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label>
              Role<br />
              <input
                type="text"
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="e.g., Protagonist, Mentor, Antagonist"
                style={{ width: '100%' }}
              />
            </label>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label>
              Dialogue Style<br />
              <select
                value={characterStyleId}
                onChange={e => setCharacterStyleId(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">None</option>
                {settings?.characterStyles.map(style => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label>
              Notes<br />
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                style={{ width: '100%' }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit">
              {editingId ? 'Save Changes' : 'Create Character'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div style={{ flex: 1 }}>
          <h2>Roster</h2>
          {characters.length === 0 && (
            <p>
              No characters yet. Create one on the left, then open Sheets to
              build stat blocks from your ruleset.
            </p>
          )}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {characters.map((character) => {
              const hasLinkedLore = characterLoreEntityIdByCharacterId.has(character.id);
              const characterAliases = characterAliasesById.get(character.id) ?? [];
              return (
              <li key={character.id} style={{ 
                marginBottom: '1rem', 
                padding: '1rem',
                border: '1px solid var(--color-border)',
                borderRadius: '4px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '1.2em' }}>{character.name}</strong>
                    {character.description && (
                      <p style={{ margin: '0.5rem 0', color: 'var(--color-text-secondary)' }}>
                        {character.description}
                      </p>
                    )}
                    <div style={{ fontSize: '0.9em', color: 'var(--color-text-tertiary)' }}>
                      {characterAliases.length > 0 && (
                        <div>Aliases: {characterAliases.join(', ')}</div>
                      )}
                      {character.fields.age && <div>Age: {character.fields.age}</div>}
                      {character.fields.role && <div>Role: {character.fields.role}</div>}
                      {character.characterStyleId && (
                        <div>Dialogue Style: {getStyleName(character.characterStyleId)}</div>
                      )}
                    </div>
                    {character.fields.notes && (
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9em', fontStyle: 'italic' }}>
                        {character.fields.notes}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" onClick={() => handleCreateSheet(character)}>
                      Open Sheet
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOpenWorldLore(character)}
                    >
                      {hasLinkedLore ? 'Open Canon Record' : 'Create Canon Record'}
                    </button>
                    <button type="button" onClick={() => handleEdit(character)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(character.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Character Styles section */}
      {settings && (
        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '2px solid var(--color-border)' }}>
          <CharacterStyleList
            styles={settings.characterStyles}
            onUpdate={handleUpdateStyle}
            onDelete={handleDeleteStyle}
          />
        </div>
      )}
    </>
  );

  return embedded ? <>{content}</> : <section>{content}</section>;
}

export default CharactersRoute;
