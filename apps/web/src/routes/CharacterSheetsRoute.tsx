import {useEffect, useState, useCallback, useMemo} from 'react';
import type {FormEvent} from 'react';
import type {
  Character,
  CharacterSheet,
  CharacterStat,
  CharacterResource,
  Project
} from '../entityTypes';
import type {StoredRuleset} from '../entityTypes';
import {
  getCharacterSheetsByProject,
  saveCharacterSheet,
  deleteCharacterSheet
} from '../services/characterSheetService';
import {getCharactersByProject} from '../characterStorage';
import {getRulesetByProjectId} from '../services/rulesetService';
import type {
  ShodhMemoryProvider,
  MemoryEntry
} from '../services/shodh/ShodhMemoryService';
import {getShodhService} from '../services/shodh/getShodhService';
import {ShodhMemoryPanel} from '../components/ShodhMemoryPanel';
import {
  getSeriesBibleConfig,
  promoteMemoryToParent,
  promoteDocumentToParent
} from '../services/seriesBible/SeriesBibleService';
import {
  DEFAULT_PARTY_SYNERGY_RULES,
  deriveCharacterRuntimeModifiers,
  getEffectiveResourceValues,
  getEffectiveStatValue,
  getOrCreateSettlementState,
  getPartySynergySuggestions,
  getSettlementModulesByProject
} from '../services/compendiumService';

interface CharacterSheetsRouteProps {
  activeProject: Project | null;
}

function CharacterSheetsRoute({activeProject}: CharacterSheetsRouteProps) {
  const [sheets, setSheets] = useState<CharacterSheet[]>([]);
  const [ruleset, setRuleset] = useState<StoredRuleset | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [level, setLevel] = useState(1);
  const [experience, setExperience] = useState(0);
  const [stats, setStats] = useState<CharacterStat[]>([]);
  const [resources, setResources] = useState<CharacterResource[]>([]);
  const [notes, setNotes] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [settlementState, setSettlementState] = useState<Awaited<
    ReturnType<typeof getOrCreateSettlementState>
  > | null>(null);
  const [settlementModules, setSettlementModules] = useState<Awaited<
    ReturnType<typeof getSettlementModulesByProject>
  >>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
  const [shodhService, setShodhService] =
    useState<ShodhMemoryProvider | null>(null);
  const [rulesetMemory, setRulesetMemory] = useState<MemoryEntry | null>(null);
  const [rulesetMemoryFilter, setRulesetMemoryFilter] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingSheetId, setDeletingSheetId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!activeProject) {
        if (!cancelled) {
          setSheets([]);
          setRuleset(null);
          setCharacters([]);
          setSettlementState(null);
          setSettlementModules([]);
          setShodhService(null);
          setRulesetMemory(null);
        }
        return;
      }

      const [loadedSheets, loadedRuleset, loadedCharacters, loadedSettlementState, loadedSettlementModules] = await Promise.all(
        [
          getCharacterSheetsByProject(activeProject.id),
          getRulesetByProjectId(activeProject.id),
          getCharactersByProject(activeProject.id),
          getOrCreateSettlementState(activeProject.id),
          getSettlementModulesByProject(activeProject.id)
        ]
      );

      const bibleConfig = getSeriesBibleConfig(activeProject);
      const shodhOptions =
        bibleConfig.parentProjectId && bibleConfig.inheritShodh
          ? {
              projectId: activeProject.id,
              inheritFromParent: true,
              parentProjectId: bibleConfig.parentProjectId
            }
          : {projectId: activeProject.id};

      let shodh: ShodhMemoryProvider | null = null;
      if (!cancelled) {
        setSheets(loadedSheets);
        setRuleset(loadedRuleset);
        setCharacters(loadedCharacters);
        setSettlementState(loadedSettlementState);
        setSettlementModules(loadedSettlementModules);
        shodh = await getShodhService(shodhOptions);
        if (!cancelled) {
          setShodhService(shodh);
        }

        // Handle pending character from Characters route
        const pendingId = localStorage.getItem('pendingCharacterSheet');
        if (pendingId) {
          localStorage.removeItem('pendingCharacterSheet');
          const character = loadedCharacters.find((c) => c.id === pendingId);
          if (character) {
            setSelectedCharacterId(pendingId);
            setName(character.name);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  const refreshRulesetMemory = useCallback(async () => {
    if (!shodhService || !ruleset?.id) {
      setRulesetMemory(null);
      return;
    }
    const list = await shodhService.listMemories();
    const memory = list.find((entry) => entry.documentId === ruleset.id) ?? null;
    setRulesetMemory(memory);
  }, [shodhService, ruleset?.id]);

  useEffect(() => {
    void refreshRulesetMemory();
  }, [refreshRulesetMemory]);


  const resetForm = () => {
    setEditingId(null);
    setSelectedCharacterId('');
    setName('');
    setLevel(1);
    setExperience(0);
    setNotes('');
    initializeStatsAndResources();
  };

  const initializeStatsAndResources = () => {
    if (!ruleset) {
      setStats([]);
      setResources([]);
      return;
    }

    // Initialize stats from ruleset definitions
    const initialStats: CharacterStat[] = ruleset.statDefinitions.map(
      (def) => ({
        definitionId: def.id,
        value: typeof def.defaultValue === 'number' ? def.defaultValue : 0
      })
    );

    // Initialize resources from ruleset definitions
    const initialResources: CharacterResource[] =
      ruleset.resourceDefinitions.map((def) => ({
        definitionId: def.id,
        current: typeof def.defaultValue === 'number' ? def.defaultValue : 0,
        max: typeof def.defaultValue === 'number' ? def.defaultValue : 0
      }));

    setStats(initialStats);
    setResources(initialResources);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeProject) {
      alert('Select or create a project first.');
      return;
    }

    const now = Date.now();
    const id = editingId ?? crypto.randomUUID();
    const existing = sheets.find((s) => s.id === id);

    const sheet: CharacterSheet = {
      id,
      projectId: activeProject.id,
      characterId: selectedCharacterId || undefined,
      name: name.trim(),
      level,
      experience,
      stats,
      resources,
      inventory: existing?.inventory ?? [],
      notes: notes.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    setIsSubmitting(true);
    setFeedback(null);
    try {
      await saveCharacterSheet(sheet);

      setSheets((prev) =>
        editingId ? prev.map((s) => (s.id === id ? sheet : s)) : [...prev, sheet]
      );

      resetForm();
      setFeedback({
        tone: 'success',
        message: editingId ? 'Character sheet updated.' : 'Character sheet created.'
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to save character sheet.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (sheet: CharacterSheet) => {
    setEditingId(sheet.id);
    setSelectedCharacterId(sheet.characterId || '');
    setName(sheet.name);
    setLevel(sheet.level);
    setExperience(sheet.experience);
    setStats(sheet.stats);
    setResources(sheet.resources);
    setNotes(sheet.notes || '');
  };

  const handleCharacterSelect = (characterId: string) => {
    setSelectedCharacterId(characterId);
    const character = characters.find((c) => c.id === characterId);
    if (character && !editingId) {
      setName(character.name);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this character sheet?')) return;
    setDeletingSheetId(id);
    setFeedback(null);
    try {
      await deleteCharacterSheet(id);
      setSheets((prev) => prev.filter((s) => s.id !== id));
      if (editingId === id) resetForm();
      setFeedback({tone: 'success', message: 'Character sheet deleted.'});
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to delete character sheet.';
      setFeedback({tone: 'error', message});
    } finally {
      setDeletingSheetId(null);
    }
  };

  const updateStatValue = (definitionId: string, value: number) => {
    setStats((prev) =>
      prev.map((s) => (s.definitionId === definitionId ? {...s, value} : s))
    );
  };

  const updateResourceCurrent = (definitionId: string, current: number) => {
    setResources((prev) =>
      prev.map((r) => (r.definitionId === definitionId ? {...r, current} : r))
    );
  };

  const updateResourceMax = (definitionId: string, max: number) => {
    setResources((prev) =>
      prev.map((r) => (r.definitionId === definitionId ? {...r, max} : r))
    );
  };

  const getStatDefinition = (definitionId: string) =>
    ruleset?.statDefinitions.find((def) => def.id === definitionId);

  const getResourceDefinition = (definitionId: string) =>
    ruleset?.resourceDefinitions.find((def) => def.id === definitionId);

  const activePartySynergies = useMemo(
    () =>
      getPartySynergySuggestions({
        characters,
        rules: DEFAULT_PARTY_SYNERGY_RULES
      }),
    [characters]
  );
  const runtimeModifiers = useMemo(
    () =>
      deriveCharacterRuntimeModifiers({
        settlementState,
        settlementModules,
        activePartySynergies
      }),
    [settlementState, settlementModules, activePartySynergies]
  );
  const effectiveLevel = Math.max(1, level + runtimeModifiers.levelBonus);

  const handlePromoteRuleset = useCallback(async () => {
    if (!ruleset || !activeProject?.parentProjectId) return;
    const ruleText = ruleset.rules
      .map((rule) => `${rule.name}: ${rule.description || ''}`)
      .join('\n');
    await promoteDocumentToParent({
      parentProjectId: activeProject.parentProjectId,
      documentId: ruleset.id,
      title: ruleset.name || 'Ruleset',
      content: `${ruleset.description ?? ''}\n${ruleText}`,
      type: 'rule',
      tags: ['ruleset']
    });
  }, [ruleset, activeProject?.parentProjectId]);

  if (!activeProject) {
    return (
      <section>
        <h1>Character Sheets</h1>
        <p>
          Go to <strong>Projects</strong> to create or open a project first.
        </p>
      </section>
    );
  }

  if (!ruleset) {
    return (
      <section>
        <h1>Character Sheets</h1>
        <p>
          This project doesn't have a ruleset yet. Character sheets require a
          ruleset to define stats and resources.
        </p>
        <p>
          Go to <strong>Projects</strong> and create a ruleset for this project.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1>Character Sheets</h1>
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

      {ruleset && (
        <ShodhMemoryPanel
          title={`${ruleset.name || 'World ruleset'} summary`}
          memories={rulesetMemory ? [rulesetMemory] : []}
          filterValue={rulesetMemoryFilter}
          onFilterChange={setRulesetMemoryFilter}
          highlightDocumentId={ruleset.id}
          onRefresh={() => void refreshRulesetMemory()}
          pageSize={1}
          scopeSummaryLabel='this ruleset'
          emptyState='No Shodh memory found yet. Save the ruleset (Projects → World Ruleset) to generate one.'
          renderSourceLabel={(memory) =>
            memory.projectId === activeProject.id ? 'Local' : 'Parent'
          }
          renderMemoryActions={(memory) => {
            if (
              activeProject.parentProjectId &&
              memory.projectId === activeProject.id
            ) {
              return (
                <button
                  type='button'
                  onClick={() => {
                    const parentId = activeProject.parentProjectId;
                    if (!parentId) return;
                    void promoteMemoryToParent(memory, parentId).then(() =>
                      refreshRulesetMemory()
                    );
                  }}
                  style={{fontSize: '0.8rem'}}
                >
                  Promote
                </button>
              );
            }
            return null;
          }}
        />
      )}
      {ruleset && activeProject?.parentProjectId && (
        <button
          type='button'
          style={{marginBottom: '1rem'}}
          onClick={() => void handlePromoteRuleset()}
        >
          Promote ruleset to parent
        </button>
      )}

      <div style={{display: 'flex', gap: '2rem', alignItems: 'flex-start'}}>
        {/* Character Sheet Editor */}
        <form onSubmit={handleSubmit} style={{flex: 1, maxWidth: 500}}>
          <h2>{editingId ? 'Edit Character Sheet' : 'New Character Sheet'}</h2>

          <div style={{marginBottom: '0.75rem'}}>
            <label>
              Name *
              <br />
              <input
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{width: '100%'}}
              />
            </label>
          </div>

          <div style={{marginBottom: '0.75rem'}}>
            <label>
              Link to Character (optional)
              <br />
              <select
                value={selectedCharacterId}
                onChange={(e) => handleCharacterSelect(e.target.value)}
                style={{width: '100%'}}
              >
                <option value=''>-- None (create new) --</option>
                {characters.map((char) => (
                  <option key={char.id} value={char.id}>
                    {char.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              marginBottom: '0.75rem'
            }}
          >
            <label>
              Level *
              <br />
              <input
                type='number'
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                min={1}
                required
                style={{width: '100%'}}
              />
            </label>

            <label>
              Experience *
              <br />
              <input
                type='number'
                value={experience}
                onChange={(e) => setExperience(Number(e.target.value))}
                min={0}
                required
                style={{width: '100%'}}
              />
            </label>
          </div>

          <div
            style={{
              marginBottom: '0.9rem',
              padding: '0.6rem 0.75rem',
              border: '1px solid #dbeafe',
              borderRadius: '6px',
              backgroundColor: '#f8fbff',
              fontSize: '0.85rem'
            }}
          >
            <strong>Runtime Effects (Preview)</strong>
            <div style={{marginTop: '0.25rem'}}>
              Effective level: {effectiveLevel}
              {runtimeModifiers.levelBonus > 0
                ? ` (base ${level} + ${runtimeModifiers.levelBonus})`
                : ` (base ${level})`}
            </div>
            {runtimeModifiers.notes.length > 0 && (
              <div style={{marginTop: '0.25rem', color: '#4b5563'}}>
                {runtimeModifiers.notes.join(' ')}
              </div>
            )}
          </div>

          {/* Stats */}
          {stats.length > 0 && (
            <div style={{marginBottom: '1rem'}}>
              <h3>Stats</h3>
              {stats.map((stat) => {
                const def = getStatDefinition(stat.definitionId);
                if (!def) return null;
                const effectiveValue = getEffectiveStatValue({
                  definitionId: stat.definitionId,
                  baseValue: stat.value,
                  runtime: runtimeModifiers
                });
                return (
                  <div key={stat.definitionId} style={{marginBottom: '0.5rem'}}>
                    <label>
                      {def.name}
                      {def.description && (
                        <span
                          style={{
                            fontSize: '0.85em',
                            color: '#888',
                            marginLeft: '0.5rem'
                          }}
                        >
                          ({def.description})
                        </span>
                      )}
                      <br />
                      <input
                        type='number'
                        value={stat.value}
                        onChange={(e) =>
                          updateStatValue(
                            stat.definitionId,
                            Number(e.target.value)
                          )
                        }
                        min={def.min}
                        max={def.max}
                        style={{width: '100%'}}
                      />
                    </label>
                    <div style={{fontSize: '0.8rem', color: '#4b5563'}}>
                      Effective: {effectiveValue}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Resources */}
          {resources.length > 0 && (
            <div style={{marginBottom: '1rem'}}>
              <h3>Resources</h3>
              {resources.map((resource) => {
                const def = getResourceDefinition(resource.definitionId);
                if (!def) return null;
                const effective = getEffectiveResourceValues({
                  definitionId: resource.definitionId,
                  current: resource.current,
                  max: resource.max,
                  runtime: runtimeModifiers
                });
                return (
                  <div
                    key={resource.definitionId}
                    style={{marginBottom: '0.75rem'}}
                  >
                    <label>
                      {def.name}
                      {def.description && (
                        <span
                          style={{
                            fontSize: '0.85em',
                            color: '#888',
                            marginLeft: '0.5rem'
                          }}
                        >
                          ({def.description})
                        </span>
                      )}
                    </label>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '0.5rem'
                      }}
                    >
                      <label>
                        Current
                        <br />
                        <input
                          type='number'
                          value={resource.current}
                          onChange={(e) =>
                            updateResourceCurrent(
                              resource.definitionId,
                              Number(e.target.value)
                            )
                          }
                          min={0}
                          style={{width: '100%'}}
                        />
                      </label>
                      <label>
                        Max
                        <br />
                        <input
                          type='number'
                          value={resource.max}
                          onChange={(e) =>
                            updateResourceMax(
                              resource.definitionId,
                              Number(e.target.value)
                            )
                          }
                          min={0}
                          style={{width: '100%'}}
                        />
                      </label>
                    </div>
                    <div style={{fontSize: '0.8rem', color: '#4b5563'}}>
                      Effective: {effective.current}/{effective.max}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{marginBottom: '0.75rem'}}>
            <label>
              Notes
              <br />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                style={{width: '100%'}}
              />
            </label>
          </div>

          <div style={{display: 'flex', gap: '0.5rem'}}>
            <button type='submit' disabled={isSubmitting}>
              {isSubmitting
                ? 'Saving...'
                : editingId
                  ? 'Save Changes'
                  : 'Create Character Sheet'}
            </button>
            {editingId && (
              <button type='button' onClick={resetForm} disabled={isSubmitting}>
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Character Sheet List */}
        <div style={{flex: 1}}>
          <h2>Character Sheets</h2>
          {sheets.length === 0 && (
            <p>No character sheets yet. Add one on the left.</p>
          )}
          <ul style={{listStyle: 'none', padding: 0}}>
            {sheets.map((sheet) => (
              <li
                key={sheet.id}
                style={{
                  marginBottom: '1rem',
                  padding: '1rem',
                  border: '1px solid #444',
                  borderRadius: '4px'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
                  }}
                >
                  <div style={{flex: 1}}>
                    <strong style={{fontSize: '1.2em'}}>{sheet.name}</strong>
                    <div
                      style={{
                        fontSize: '0.9em',
                        color: '#888',
                        marginTop: '0.5rem'
                      }}
                    >
                      Level {Math.max(1, sheet.level + runtimeModifiers.levelBonus)}
                      {runtimeModifiers.levelBonus > 0
                        ? ` (base ${sheet.level})`
                        : ''}
                      {' | '}
                      {sheet.experience} XP
                    </div>

                    {sheet.stats.length > 0 && (
                      <div style={{marginTop: '0.5rem', fontSize: '0.9em'}}>
                        <strong>Stats:</strong>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '0.25rem',
                            marginTop: '0.25rem'
                          }}
                        >
                          {sheet.stats.map((stat) => {
                            const def = getStatDefinition(stat.definitionId);
                            const effectiveValue = getEffectiveStatValue({
                              definitionId: stat.definitionId,
                              baseValue: stat.value,
                              runtime: runtimeModifiers
                            });
                            return def ? (
                              <span key={stat.definitionId}>
                                {def.name}: {stat.value}
                                {effectiveValue !== stat.value
                                  ? ` (${effectiveValue})`
                                  : ''}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}

                    {sheet.resources.length > 0 && (
                      <div style={{marginTop: '0.5rem', fontSize: '0.9em'}}>
                        <strong>Resources:</strong>
                        <div style={{marginTop: '0.25rem'}}>
                          {sheet.resources.map((resource) => {
                            const def = getResourceDefinition(
                              resource.definitionId
                            );
                            const effective = getEffectiveResourceValues({
                              definitionId: resource.definitionId,
                              current: resource.current,
                              max: resource.max,
                              runtime: runtimeModifiers
                            });
                            return def ? (
                              <div key={resource.definitionId}>
                                {def.name}: {resource.current}/{resource.max}
                                {(effective.current !== resource.current ||
                                  effective.max !== resource.max) &&
                                  ` (${effective.current}/${effective.max})`}
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}

                    {sheet.notes && (
                      <p
                        style={{
                          margin: '0.5rem 0 0 0',
                          fontSize: '0.9em',
                          fontStyle: 'italic',
                          color: '#ccc'
                        }}
                      >
                        {sheet.notes}
                      </p>
                    )}
                  </div>

                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <button type='button' onClick={() => handleEdit(sheet)}>
                      Edit
                    </button>
                    <button
                      type='button'
                      onClick={() => handleDelete(sheet.id)}
                      disabled={deletingSheetId === sheet.id}
                    >
                      {deletingSheetId === sheet.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default CharacterSheetsRoute;
