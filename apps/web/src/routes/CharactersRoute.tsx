import {useEffect, useMemo, useState} from 'react';
import type {
  Character,
  EntityCategory,
  ProjectSettings,
  WorldEntity
} from '../entityTypes';
import {deleteCharacter, getCharactersByProject, saveCharacter} from '../characterStorage';
import {getCategoriesByProject} from '../categoryStorage';
import {getEntitiesByProject} from '../entityStorage';
import {useConfirmDialog} from '../hooks/useConfirmDialog';
import {createCharacterLinkResolver} from '../services/characters/characterIdentity';
import {useAppStore} from '../store/appStore';
import {useNavigate} from 'react-router';
import styles from '../styles/CharactersRoute.module.css';

interface CharactersRouteProps {
  embedded?: boolean;
  onOpenSheets?: (characterId?: string, options?: {autoCreate?: boolean}) => void;
  canUseSheets?: boolean;
  prefillCharacterId?: string | null;
  onPrefillConsumed?: () => void;
}

function CharactersRoute({
  embedded = false,
  onOpenSheets,
  canUseSheets = Boolean(onOpenSheets),
  prefillCharacterId = null,
  onPrefillConsumed
}: CharactersRouteProps) {
  const activeProject = useAppStore((state) => state.activeProject);
  const projectSettings = useAppStore((state) => state.projectSettings);
  const loadProjectSettings = useAppStore((state) => state.loadProjectSettings);
  const navigate = useNavigate();
  const {requestConfirm, confirmDialog} = useConfirmDialog();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [categories, setCategories] = useState<EntityCategory[]>([]);
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [characterStyleId, setCharacterStyleId] = useState('');
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!activeProject) {
      setCharacters([]);
      setEntities([]);
      setCategories([]);
      setSettings(null);
      return;
    }
    let cancelled = false;
    void Promise.all([
      getCharactersByProject(activeProject.id),
      getEntitiesByProject(activeProject.id),
      getCategoriesByProject(activeProject.id),
      projectSettings?.projectId === activeProject.id
        ? Promise.resolve(projectSettings)
        : loadProjectSettings(activeProject.id)
    ]).then(([nextCharacters, nextEntities, nextCategories, nextSettings]) => {
      if (cancelled) return;
      setCharacters(nextCharacters);
      setEntities(nextEntities);
      setCategories(nextCategories);
      setSettings(nextSettings);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProject, loadProjectSettings, projectSettings]);

  useEffect(() => {
    if (!activeProject || projectSettings?.projectId !== activeProject.id) return;
    setSettings(projectSettings);
  }, [activeProject, projectSettings]);

  const resolver = useMemo(
    () => createCharacterLinkResolver({categories, entities, characters, sheets: []}),
    [categories, characters, entities]
  );
  const linkedEntityByCharacterId = useMemo(() => {
    const result = new Map<string, WorldEntity>();
    characters.forEach((character) => {
      const entityId = resolver.resolveEntityId({characterId: character.id});
      const entity = entityId ? resolver.getEntity(entityId) : undefined;
      if (entity) result.set(character.id, entity);
    });
    return result;
  }, [characters, resolver]);

  useEffect(() => {
    if (!prefillCharacterId || characters.length === 0) return;
    const character = characters.find((entry) => entry.id === prefillCharacterId);
    if (!character) {
      onPrefillConsumed?.();
      return;
    }
    if (!linkedEntityByCharacterId.has(character.id)) {
      setFeedback({
        tone: 'error',
        message: 'Link this legacy data to World Bible before assigning a dialogue style.'
      });
      onPrefillConsumed?.();
      return;
    }
    setEditingId(character.id);
    setCharacterStyleId(character.characterStyleId ?? '');
    onPrefillConsumed?.();
  }, [characters, linkedEntityByCharacterId, onPrefillConsumed, prefillCharacterId]);

  if (!activeProject) return <p>No active project selected.</p>;

  const editingCharacter = editingId
    ? characters.find((character) => character.id === editingId)
    : undefined;
  const editingEntity = editingCharacter
    ? linkedEntityByCharacterId.get(editingCharacter.id)
    : undefined;
  const getStyleName = (styleId?: string) =>
    settings?.characterStyles.find((style) => style.id === styleId)?.name ?? 'None';

  const resetStyleEditor = () => {
    setEditingId(null);
    setCharacterStyleId('');
  };

  const handleSaveDialogueStyle = async () => {
    if (!editingCharacter || !editingEntity) return;
    const updated: Character = {
      ...editingCharacter,
      entityId: editingEntity.id,
      name: editingEntity.name,
      characterStyleId: characterStyleId || undefined,
      updatedAt: Date.now()
    };
    try {
      await saveCharacter(updated);
      setCharacters((current) =>
        current.map((character) => (character.id === updated.id ? updated : character))
      );
      setFeedback({
        tone: 'success',
        message: characterStyleId
          ? `Dialogue style assigned to "${editingEntity.name}".`
          : `Dialogue style removed from "${editingEntity.name}".`
      });
      resetStyleEditor();
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to save dialogue style.'
      });
    }
  };

  const handleOpenSheet = (character: Character) => {
    if (onOpenSheets) {
      onOpenSheets(character.id);
      return;
    }
    navigate('/characters?view=sheets', {
      state: {prefillCharacterId: character.id, preferredView: 'sheets'}
    });
  };

  const handleOpenCanon = (character: Character) => {
    const entity = linkedEntityByCharacterId.get(character.id);
    navigate('/world-bible', {
      state: entity
        ? {focusEntityId: entity.id}
        : {focusCategorySlug: 'characters'}
    });
  };

  const handleRemoveCapabilityData = (character: Character) => {
    const entity = linkedEntityByCharacterId.get(character.id);
    requestConfirm({
      title: entity ? 'Remove optional character data?' : 'Delete legacy character data?',
      message: entity
        ? `Dialogue-style assignment for "${entity.name}" will be removed. World Bible canon and any directly linked sheet remain unchanged.`
        : 'This unresolved legacy data will be deleted. Its World Bible review decision, if any, is unchanged.',
      confirmLabel: 'Remove',
      variant: 'danger',
      onConfirm: async () => {
        await deleteCharacter(character.id);
        setCharacters((current) => current.filter((entry) => entry.id !== character.id));
        if (editingId === character.id) resetStyleEditor();
        setFeedback({
          tone: 'success',
          message: entity
            ? 'Optional character data removed. World Bible canon was not changed.'
            : 'Legacy character data deleted.'
        });
      }
    });
  };

  const content = (
    <div className={styles.page}>
      {!embedded && <h1 className={styles.title}>Character Tools</h1>}
      {!embedded && (
        <p className={styles.lead}>
          Assign dialogue styles, open sheets and state, or return to World Bible for
          character names, descriptions, aliases, and lore.
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

      {editingCharacter && editingEntity && (
        <section className={styles.formPanel} aria-label='Assign dialogue style'>
          <h2>Dialogue style for {editingEntity.name}</h2>
          <p className={styles.lead}>
            This writing aid changes dialogue presentation only. Character identity and
            descriptive canon remain in World Bible.
          </p>
          <label className={styles.fieldLabel}>
            Dialogue style
            <select
              className={styles.softSelect}
              value={characterStyleId}
              onChange={(event) => setCharacterStyleId(event.target.value)}
            >
              <option value=''>None</option>
              {settings?.characterStyles.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.name}
                </option>
              ))}
            </select>
          </label>
          {settings?.characterStyles.length === 0 && (
            <p className={styles.mutedText}>
              Define dialogue styles in Settings, then return here to assign one.
            </p>
          )}
          <div className={styles.bottomActions}>
            <button type='button' onClick={() => void handleSaveDialogueStyle()}>
              Save dialogue style
            </button>
            <button type='button' onClick={resetStyleEditor}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {!editingId && (
        <>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Character canon lives in World Bible</h2>
            <p className={styles.lead}>
              Create and edit names, descriptions, aliases, notes, and lore there. This
              page only manages optional attached capabilities.
            </p>
            <div className={styles.actionRow}>
              <button
                type='button'
                onClick={() =>
                  navigate('/world-bible', {state: {focusCategorySlug: 'characters'}})
                }
              >
                Open World Bible
              </button>
              <button type='button' onClick={() => navigate('/settings')}>
                Define dialogue styles
              </button>
            </div>
          </section>

          <h2>Character capabilities</h2>
          {characters.length === 0 && (
            <p>
              No optional character capabilities yet. Open a World Bible character to
              assign a dialogue style, add a sheet, or export it.
            </p>
          )}
          <ul className={styles.list}>
            {characters.map((character) => {
              const entity = linkedEntityByCharacterId.get(character.id);
              const displayName = entity?.name ?? character.name;
              return (
                <li key={character.id} className={styles.listCard}>
                  <div className={styles.listCardHeader}>
                    <div style={{flex: 1}}>
                      <strong style={{fontSize: '1.2em'}}>{displayName}</strong>
                      {!entity && (
                        <span className={styles.unlinkedBadge}>Not linked to canon</span>
                      )}
                      <div className={styles.listCardMeta}>
                        {entity ? (
                          <div>Dialogue style: {getStyleName(character.characterStyleId)}</div>
                        ) : (
                          <div>Resolve this legacy data in World Bible before using it.</div>
                        )}
                      </div>
                    </div>
                    <div className={styles.actionRow}>
                      {entity && (
                        <button
                          type='button'
                          onClick={() => {
                            setEditingId(character.id);
                            setCharacterStyleId(character.characterStyleId ?? '');
                          }}
                        >
                          Dialogue style
                        </button>
                      )}
                      {entity && canUseSheets && (
                        <button type='button' onClick={() => handleOpenSheet(character)}>
                          Sheet + state
                        </button>
                      )}
                      <button type='button' onClick={() => handleOpenCanon(character)}>
                        {entity ? 'Open in World Bible' : 'Resolve in World Bible'}
                      </button>
                      <button
                        type='button'
                        onClick={() => handleRemoveCapabilityData(character)}
                      >
                        {entity ? 'Remove optional data' : 'Delete legacy data'}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );

  return embedded ? (
    <>
      {content}
      {confirmDialog}
    </>
  ) : (
    <section>
      {content}
      {confirmDialog}
    </section>
  );
}

export default CharactersRoute;
