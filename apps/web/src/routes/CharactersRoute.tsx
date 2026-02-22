// apps/web/src/routes/CharactersRoute.tsx - NEW FILE
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Character, Project, ProjectSettings } from '../entityTypes';
import { getCharactersByProject, saveCharacter, deleteCharacter } from '../characterStorage';
import { getOrCreateSettings, saveProjectSettings } from '../settingsStorage';
import { CharacterStyleList } from '../components/CharacterStyleList';
import type { CharacterStyle } from '../entityTypes';
import { useNavigate } from 'react-router-dom';

interface CharactersRouteProps {
  activeProject: Project | null;
}

function CharactersRoute({ activeProject }: CharactersRouteProps) {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [age, setAge] = useState('');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [characterStyleId, setCharacterStyleId] = useState<string>('');

  useEffect(() => {
    if (!activeProject) {
      setCharacters([]);
      setSettings(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const [chars, projectSettings] = await Promise.all([
        getCharactersByProject(activeProject.id),
        getOrCreateSettings(activeProject.id)
      ]);

      if (!cancelled) {
        setCharacters(chars);
        setSettings(projectSettings);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

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
  };

  const handleCreateSheet = (character: Character) => {
    // Store the character ID in localStorage to auto-populate the sheet form
    localStorage.setItem('pendingCharacterSheet', character.id);
    navigate('/character-sheets');
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
    return (
      <section>
        <h1>Characters</h1>
        <p>
          No active project. Go to <strong>Projects</strong> to create or open a
          project first.
        </p>
      </section>
    );
  }

  const getStyleName = (styleId: string | undefined) => {
    if (!styleId || !settings) return 'None';
    const style = settings.characterStyles.find(s => s.id === styleId);
    return style?.name ?? 'None';
  };

  return (
    <section>
      <h1>Characters</h1>

      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
        {/* Character form */}
        <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
          <h2>{editingId ? 'Edit Character' : 'New Character'}</h2>

          <div style={{ marginBottom: '0.75rem' }}>
            <label>
              Name *<br />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
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

        {/* Character list */}
        <div style={{ flex: 1 }}>
          <h2>Character List</h2>
          {characters.length === 0 && (
            <p>No characters yet. Create one on the left.</p>
          )}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {characters.map(character => (
              <li key={character.id} style={{ 
                marginBottom: '1rem', 
                padding: '1rem',
                border: '1px solid #444',
                borderRadius: '4px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '1.2em' }}>{character.name}</strong>
                    {character.description && (
                      <p style={{ margin: '0.5rem 0', color: '#ccc' }}>
                        {character.description}
                      </p>
                    )}
                    <div style={{ fontSize: '0.9em', color: '#888' }}>
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
                      Create Sheet
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
            ))}
          </ul>
        </div>
      </div>

      {/* Character Styles section */}
      {settings && (
        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '2px solid #444' }}>
          <CharacterStyleList
            styles={settings.characterStyles}
            onUpdate={handleUpdateStyle}
            onDelete={handleDeleteStyle}
          />
        </div>
      )}
    </section>
  );
}

export default CharactersRoute;
