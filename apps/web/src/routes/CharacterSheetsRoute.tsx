import {useEffect, useState} from 'react';
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
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!activeProject) {
        if (!cancelled) {
          setSheets([]);
          setRuleset(null);
          setCharacters([]);
        }
        return;
      }

      const [loadedSheets, loadedRuleset, loadedCharacters] = await Promise.all(
        [
          getCharacterSheetsByProject(activeProject.id),
          getRulesetByProjectId(activeProject.id),
          getCharactersByProject(activeProject.id)
        ]
      );

      if (!cancelled) {
        setSheets(loadedSheets);
        setRuleset(loadedRuleset);
        setCharacters(loadedCharacters);

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

    await saveCharacterSheet(sheet);

    setSheets((prev) =>
      editingId ? prev.map((s) => (s.id === id ? sheet : s)) : [...prev, sheet]
    );

    resetForm();
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
    await deleteCharacterSheet(id);
    setSheets((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) resetForm();
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

          {/* Stats */}
          {stats.length > 0 && (
            <div style={{marginBottom: '1rem'}}>
              <h3>Stats</h3>
              {stats.map((stat) => {
                const def = getStatDefinition(stat.definitionId);
                if (!def) return null;
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
            <button type='submit'>
              {editingId ? 'Save Changes' : 'Create Character Sheet'}
            </button>
            {editingId && (
              <button type='button' onClick={resetForm}>
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
                      Level {sheet.level} | {sheet.experience} XP
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
                            return def ? (
                              <span key={stat.definitionId}>
                                {def.name}: {stat.value}
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
                            return def ? (
                              <div key={resource.definitionId}>
                                {def.name}: {resource.current}/{resource.max}
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
                    >
                      Delete
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
