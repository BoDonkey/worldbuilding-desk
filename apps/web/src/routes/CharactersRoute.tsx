// apps/web/src/routes/CharactersRoute.tsx - NEW FILE
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
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
import {WorldBibleRichTextField} from '../components/WorldBibleRichTextField';
import {AIAssistant} from '../components/AIAssistant/AIAssistant';
import {
  convertPlainTextToRichHtml,
  extractPlainTextFromRichText,
  normalizeRichTextValue
} from '../services/worldBible/worldBibleEntityHelpers';
import {
  parseCharacterImportText,
  readCharacterImportFile,
  type CharacterImportDraft,
  type CharacterImportSectionDraft
} from '../services/characters/characterImportService';
import styles from '../styles/CharactersRoute.module.css';

interface CharactersRouteProps {
  embedded?: boolean;
  onOpenSheets?: (characterId?: string, options?: {autoCreate?: boolean}) => void;
  canUseSheets?: boolean;
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

type CharacterAssistField = 'description' | 'notes';
type CharacterCreationMode = 'idle' | 'manual' | 'import';

const appendAssistantText = (currentValue: string, assistantText: string): string => {
  const addition = convertPlainTextToRichHtml(assistantText);
  const current = normalizeRichTextValue(currentValue);
  if (extractPlainTextFromRichText(current).trim().length === 0) {
    return addition;
  }
  return `${current}${addition}`;
};

const buildImportNotes = (
  draft: CharacterImportDraft,
  sections: CharacterImportSectionDraft[]
): string => {
  const noteBlocks = sections
    .filter((section) => section.action === 'notes')
    .map((section) => `${section.title}\n${section.content.trim()}`)
    .filter(Boolean);
  const residue = draft.unmatchedText.trim();
  return [...noteBlocks, residue ? `Source Notes\n${residue}` : ''].filter(Boolean).join('\n\n');
};

const buildImportDescription = (
  draft: CharacterImportDraft,
  sections: CharacterImportSectionDraft[]
): string => {
  const descriptionBlocks = sections
    .filter((section) => section.action === 'description')
    .map((section) => section.content.trim())
    .filter(Boolean);
  return descriptionBlocks.join('\n\n') || draft.detectedDescription;
};

function CharactersRoute({
  embedded = false,
  onOpenSheets,
  canUseSheets = Boolean(onOpenSheets),
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
  const [creationMode, setCreationMode] = useState<CharacterCreationMode>('idle');
  const [activeAssistField, setActiveAssistField] = useState<CharacterAssistField | null>(null);
  const [queuedAssistantPrompt, setQueuedAssistantPrompt] = useState<string | null>(null);
  const [pastedImportText, setPastedImportText] = useState('');
  const [importDraft, setImportDraft] = useState<CharacterImportDraft | null>(null);
  const [importSections, setImportSections] = useState<CharacterImportSectionDraft[]>([]);
  const [isImportingCharacterDoc, setIsImportingCharacterDoc] = useState(false);

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
    setCreationMode('manual');
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
    setCreationMode('idle');
    setName('');
    setDescription('');
    setAge('');
    setRole('');
    setNotes('');
    setCharacterStyleId('');
    setActiveAssistField(null);
    setQueuedAssistantPrompt(null);
    setPastedImportText('');
    setImportDraft(null);
    setImportSections([]);
    setIsImportingCharacterDoc(false);
  };

  const openFieldAssistant = (
    field: CharacterAssistField,
    prompt?: string
  ) => {
    setActiveAssistField(field);
    setQueuedAssistantPrompt(prompt ?? null);
  };

  const handleInsertAssistantText = (text: string) => {
    if (activeAssistField === 'description') {
      setDescription((current) => appendAssistantText(current, text));
      return;
    }
    if (activeAssistField === 'notes') {
      setNotes((current) => appendAssistantText(current, text));
    }
  };

  const reviewImportDraft = (draft: CharacterImportDraft) => {
    setImportDraft(draft);
    setImportSections(draft.sections);
    setName(draft.detectedName);
    setAge(draft.detectedAge);
    setRole(draft.detectedRole);
    setDescription(convertPlainTextToRichHtml(buildImportDescription(draft, draft.sections)));
    setNotes(convertPlainTextToRichHtml(buildImportNotes(draft, draft.sections)));
    setCreationMode('import');
    setFeedback(null);
  };

  const handleReviewPastedImport = () => {
    const source = pastedImportText.trim();
    if (!source) {
      setFeedback({tone: 'error', message: 'Paste character notes before reviewing.'});
      return;
    }
    reviewImportDraft(parseCharacterImportText(source));
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsImportingCharacterDoc(true);
    setFeedback(null);
    try {
      const source = await readCharacterImportFile(file);
      reviewImportDraft(parseCharacterImportText(source, file.name));
      setPastedImportText(source);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to import this character document.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsImportingCharacterDoc(false);
    }
  };

  const updateImportSectionAction = (
    sectionId: string,
    action: CharacterImportSectionDraft['action']
  ) => {
    if (!importDraft) return;
    const nextSections = importSections.map((section) =>
      section.id === sectionId ? {...section, action} : section
    );
    setImportSections(nextSections);
    setDescription(convertPlainTextToRichHtml(buildImportDescription(importDraft, nextSections)));
    setNotes(convertPlainTextToRichHtml(buildImportNotes(importDraft, nextSections)));
  };

  const startManualFromImportDraft = () => {
    setCreationMode('manual');
    setImportDraft(null);
    setImportSections([]);
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
      description: extractPlainTextFromRichText(description).trim()
        ? normalizeRichTextValue(description)
        : undefined,
      characterStyleId: characterStyleId || undefined,
      fields: {
        age: age.trim() || undefined,
        role: role.trim() || undefined,
        notes: extractPlainTextFromRichText(notes).trim()
          ? normalizeRichTextValue(notes)
          : undefined,
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
        message: `"${character.name}" now has a World Bible character record.`
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
          ? `"${entity.name}" already has a Character Tools profile.`
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
    setCreationMode('manual');
    setName(character.name);
    setDescription(character.description ?? '');
    setAge(character.fields.age ?? '');
    setRole(character.fields.role ?? '');
    setNotes(character.fields.notes ?? '');
    setCharacterStyleId(character.characterStyleId ?? '');
  };

  const handleDelete = async (id: string, options?: {hasLinkedLore?: boolean}) => {
    if (options?.hasLinkedLore) {
      const confirmed = confirm(
        'Remove this Character Tools profile? The World Bible canon record and aliases will stay, so the name will still highlight in the workspace.'
      );
      if (!confirmed) return;
    }
    await deleteCharacter(id);
    setCharacters(prev => prev.filter(c => c.id !== id));
    setFeedback({
      tone: 'success',
      message: options?.hasLinkedLore
        ? 'Character Tools profile removed. Delete the World Bible canon record to remove workspace highlights.'
        : 'Character deleted.'
    });

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
  const assistantSelectedText =
    activeAssistField === 'description'
      ? extractPlainTextFromRichText(description)
      : activeAssistField === 'notes'
        ? extractPlainTextFromRichText(notes)
        : '';
  const assistantFieldLabel =
    activeAssistField === 'description' ? 'Description' : activeAssistField === 'notes' ? 'Notes' : '';
  const isFocusedCharacterTask = Boolean(editingId || creationMode === 'manual');
  const content = (
    <div className={styles.page}>
      {!embedded && <h1 className={styles.title}>Character Tools</h1>}
      {!embedded && (
        <p className={styles.lead}>
          {canUseSheets
            ? 'Use this secondary workspace for dialogue style, exportable tool profiles, sheets, and state. Create and edit canonical names, aliases, and lore in World Bible.'
            : 'Use this secondary workspace for dialogue style and exportable tool profiles. Create and edit canonical names, aliases, and lore in World Bible.'}
        </p>
      )}
      {feedback && (
        <p
          role='status'
          className={`${styles.feedback} ${
            feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess
          }`}
        >
          {feedback.message}
        </p>
      )}
      {showMigrationNotice && migrationCandidates.length > 0 && (
        <div className={styles.notice}>
          <div style={{display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start'}}>
            <div>
              <strong>Character Tools is optional here</strong>
              <p style={{margin: '0.4rem 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)'}}>
                These canon records already exist in World Bible. If you want to keep writing,
                dismiss this and continue. If you want a tools profile here, click
                <strong> Open Tools Profile</strong>.
                {canUseSheets && (
                  <>
                    {' '}If you want a sheet immediately, click
                    <strong> Create/Open Sheet + State</strong>.
                  </>
                )}
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
                className={styles.listCard}
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
                    {importingEntityId === entity.id ? 'Opening...' : 'Open Tools Profile'}
                  </button>
                  {canUseSheets && (
                    <button
                      type='button'
                      onClick={() => void handleImportWorldEntity(entity, {autoCreateSheet: true})}
                      disabled={importingEntityId === entity.id}
                    >
                      {importingEntityId === entity.id ? 'Opening...' : 'Create/Open Sheet + State'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isFocusedCharacterTask && (
        <div className={styles.taskGrid}>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Character Canon</h2>
            <p className={styles.lead}>
              Start or revise identity, aliases, duplicate cleanup, and story-facing
              lore in World Bible.
            </p>
            <button
              type='button'
              onClick={() => navigate('/world-bible', {state: {focusCategorySlug: 'characters'}})}
              style={{marginTop: '0.75rem'}}
            >
              Open World Bible
            </button>
          </section>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Tool Profile</h2>
            <p className={styles.lead}>
              Add secondary metadata such as dialogue style after the canon record
              exists in World Bible.
            </p>
            <button
              type='button'
              onClick={() => setCreationMode('manual')}
              style={{marginTop: '0.75rem'}}
            >
              Add Tool Profile
            </button>
          </section>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Import Tool Metadata</h2>
            <p className={styles.lead}>
              Bring in tool metadata without making this the canonical character home.
            </p>
            <button
              type='button'
              onClick={() => setCreationMode('import')}
              style={{marginTop: '0.75rem'}}
            >
              Import Or Paste
            </button>
          </section>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>AI-Assisted Draft</h2>
            <p className={styles.lead}>
              Generate secondary tool notes from your premise, then edit and approve them yourself.
            </p>
            <button
              type='button'
              disabled
              title='Planned for a later recovery slice'
              style={{marginTop: '0.75rem'}}
            >
              Start With AI
            </button>
          </section>
        </div>
      )}

      {creationMode === 'import' && !importDraft && (
        <section className={styles.formPanel} aria-label='Import character'>
          <h2>Import Tool Metadata</h2>
          <p className={styles.lead}>
            Paste a profile or import a character document, then review the parsed draft before it becomes secondary tool metadata.
          </p>
          <label className={styles.fieldLabel}>
            Character notes
            <textarea
              className={styles.softTextarea}
              value={pastedImportText}
              onChange={(event) => setPastedImportText(event.target.value)}
              rows={10}
              placeholder='Name: Mira Voss&#10;Role: Cartographer&#10;&#10;Background: ...'
            />
          </label>
          <div className={styles.bottomActions}>
            <button type='button' onClick={handleReviewPastedImport}>
              Review Paste
            </button>
            <label className={styles.fileButton}>
              {isImportingCharacterDoc ? 'Importing...' : 'Import File'}
              <input
                type='file'
                accept='.txt,.md,.rtf,.html,.htm,.docx,text/plain,text/markdown,text/rtf,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                onChange={(event) => void handleImportFile(event)}
                disabled={isImportingCharacterDoc}
              />
            </label>
            <button type='button' onClick={resetForm}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {creationMode === 'import' && importDraft && (
        <section className={styles.formPanel} aria-label='Review character import'>
          <h2>Review Import</h2>
          <p className={styles.lead}>
            Confirm the extracted fields. Sections marked Description or Notes are copied into the rich editor below.
          </p>
          {importDraft.warnings.length > 0 && (
            <div className={styles.notice}>
              {importDraft.warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          )}
          <div className={styles.fieldGrid}>
            <label className={styles.fieldLabel}>
              Name *
              <input
                className={styles.softInput}
                type='text'
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <label className={styles.fieldLabel}>
              Age
              <input
                className={styles.softInput}
                type='text'
                value={age}
                onChange={(event) => setAge(event.target.value)}
              />
            </label>
            <label className={styles.fieldLabel}>
              Role
              <input
                className={styles.softInput}
                type='text'
                value={role}
                onChange={(event) => setRole(event.target.value)}
              />
            </label>
          </div>
          {importSections.length > 0 && (
            <div className={styles.importReviewList}>
              {importSections.map((section) => (
                <div key={section.id} className={styles.importReviewCard}>
                  <div>
                    <strong>{section.title}</strong>
                    <p className={styles.mutedText}>{section.content}</p>
                  </div>
                  <label className={styles.fieldLabel}>
                    Destination
                    <select
                      className={styles.softSelect}
                      value={section.action}
                      onChange={(event) =>
                        updateImportSectionAction(
                          section.id,
                          event.target.value as CharacterImportSectionDraft['action']
                        )
                      }
                    >
                      <option value='notes'>Notes</option>
                      <option value='description'>Description</option>
                      <option value='ignore'>Ignore</option>
                    </select>
                  </label>
                </div>
              ))}
            </div>
          )}
          <div className={styles.bottomActions}>
            <button type='button' onClick={startManualFromImportDraft}>
              Edit Rich Fields
            </button>
            <button type='button' onClick={resetForm}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {isFocusedCharacterTask && (
        <form onSubmit={handleSubmit} className={styles.formPanel}>
          <h2>{editingId ? 'Edit Tool Metadata' : 'New Tool Metadata'}</h2>
          <p className={styles.lead}>
            This form does not own character canon. Use World Bible for canonical
            names, aliases, lore, and merge decisions.
          </p>
          <div className={styles.fieldGrid} style={{marginBottom: '0.9rem'}}>
            <label className={styles.fieldLabel}>
              Name *
              <input
                className={styles.softInput}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                disabled={editingCharacterHasCanonRecord}
              />
            </label>
            <label className={styles.fieldLabel}>
              Age
              <input
                className={styles.softInput}
                type="text"
                value={age}
                onChange={e => setAge(e.target.value)}
              />
            </label>
            <label className={styles.fieldLabel}>
              Role
              <input
                className={styles.softInput}
                type="text"
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="e.g., Protagonist, Mentor, Antagonist"
              />
            </label>
          </div>

          <div className={styles.richField} style={{marginBottom: '0.9rem'}}>
            <WorldBibleRichTextField
              label='Description'
              value={description}
              onChange={setDescription}
            />
            <div className={styles.actionRow}>
              <button type='button' onClick={() => openFieldAssistant('description')}>
                AI Assist
              </button>
              <button
                type='button'
                onClick={() => openFieldAssistant('description', 'Suggest a richer character description that preserves the existing facts and voice.')}
              >
                Suggest Expansion
              </button>
            </div>
          </div>

          <div className={styles.fieldGrid} style={{marginBottom: '0.9rem'}}>
            <label className={styles.fieldLabel}>
              Dialogue Style
              <select
                className={styles.softSelect}
                value={characterStyleId}
                onChange={e => setCharacterStyleId(e.target.value)}
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

          <div className={styles.richField} style={{marginBottom: '0.9rem'}}>
            <WorldBibleRichTextField
              label='Notes'
              value={notes}
              onChange={setNotes}
            />
            <div className={styles.actionRow}>
              <button type='button' onClick={() => openFieldAssistant('notes')}>
                AI Assist
              </button>
              <button
                type='button'
                onClick={() => openFieldAssistant('notes', 'Find useful character-development gaps, contradictions, or follow-up questions from these notes.')}
              >
                Review Notes
              </button>
            </div>
          </div>

          {activeAssistField && activeProject && (
            <div className={styles.assistantPanel}>
              <div className={styles.assistantHeader}>
                <strong>AI assist: {assistantFieldLabel}</strong>
                <button type='button' onClick={() => setActiveAssistField(null)}>
                  Close
                </button>
              </div>
              <AIAssistant
                projectId={activeProject.id}
                aiConfig={projectSettings?.aiSettings}
                projectMode={projectSettings?.projectMode}
                context={{
                  type: 'character',
                  id: editingId ?? 'new-character',
                  selectedText: assistantSelectedText
                }}
                onInsert={handleInsertAssistantText}
                queuedPrompt={queuedAssistantPrompt}
                onQueuedPromptConsumed={() => setQueuedAssistantPrompt(null)}
                consultationModel={projectSettings?.aiSettings?.inspectorSettings?.lowCostModel}
                consultationMaxTokens={
                  projectSettings?.aiSettings?.inspectorSettings?.maxResponseTokens
                }
              />
            </div>
          )}

          <div className={styles.bottomActions}>
            <button type="submit">
              {editingId ? 'Save Tool Metadata' : 'Create Tool Metadata'}
            </button>
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {!isFocusedCharacterTask && (
        <div>
          <h2>Tool Profiles</h2>
          {characters.length === 0 && (
            <p>
              {canUseSheets
                ? 'No tool profiles yet. Start in World Bible, then open sheets or state tracking from a character canon record when needed.'
                : 'No tool profiles yet. Start in World Bible, then add secondary tool metadata only when needed.'}
            </p>
          )}
          <ul className={styles.list}>
            {characters.map((character) => {
              const hasLinkedLore = characterLoreEntityIdByCharacterId.has(character.id);
              const characterAliases = characterAliasesById.get(character.id) ?? [];
              return (
              <li key={character.id} className={styles.listCard}>
                <div className={styles.listCardHeader}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '1.2em' }}>{character.name}</strong>
                    <div className={styles.listCardMeta}>
                      {characterAliases.length > 0 && (
                        <div>Aliases: {characterAliases.join(', ')}</div>
                      )}
                      {character.fields.age && <div>Age: {character.fields.age}</div>}
                      {character.fields.role && <div>Role: {character.fields.role}</div>}
                      {character.characterStyleId && (
                        <div>Dialogue Style: {getStyleName(character.characterStyleId)}</div>
                      )}
                    </div>
                    {(character.description || character.fields.notes) && (
                      <details className={styles.detailsBlock}>
                        <summary>Details</summary>
                        {character.description && (
                          <div style={{marginTop: '0.5rem'}}>
                            <strong>Profile Summary</strong>
                            <p className={styles.mutedText}>
                              {extractPlainTextFromRichText(character.description)}
                            </p>
                          </div>
                        )}
                        {character.fields.notes && (
                          <div style={{marginTop: '0.6rem'}}>
                            <strong>Notes</strong>
                            <p className={styles.italicText}>
                              {extractPlainTextFromRichText(character.fields.notes)}
                            </p>
                          </div>
                        )}
                      </details>
                    )}
                  </div>
                  <div className={styles.actionRow}>
                    {canUseSheets && (
                      <button type="button" onClick={() => handleCreateSheet(character)}>
                        Open Sheet + State
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleOpenWorldLore(character)}
                    >
                      {hasLinkedLore ? 'Open Canon in World Bible' : 'Create Canon in World Bible'}
                    </button>
                    <button type="button" onClick={() => handleEdit(character)}>
                      Edit Tool Metadata
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(character.id, {hasLinkedLore})}
                    >
                      {hasLinkedLore ? 'Remove Tools Profile' : 'Delete'}
                    </button>
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Character Styles section */}
      {settings && !isFocusedCharacterTask && (
        <div className={styles.characterStyles}>
          <CharacterStyleList
            styles={settings.characterStyles}
            onUpdate={handleUpdateStyle}
            onDelete={handleDeleteStyle}
          />
        </div>
      )}
    </div>
  );

  return embedded ? <>{content}</> : <section>{content}</section>;
}

export default CharactersRoute;
