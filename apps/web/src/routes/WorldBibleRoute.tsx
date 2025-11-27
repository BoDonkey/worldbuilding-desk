import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { EntityFields, EntityType, Project, WorldEntity } from '../entityTypes';
import { getEntitiesByProject, saveEntity, deleteEntity } from '../entityStorage';

interface WorldBibleRouteProps {
  activeProject: Project | null;
}

function WorldBibleRoute({ activeProject }: WorldBibleRouteProps) {
  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<EntityType>('character');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!activeProject) return;

    let cancelled = false;

    (async () => {
      const all = await getEntitiesByProject(activeProject.id);
      if (!cancelled) {
        setEntities(all);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setType('character');
    setNotes('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeProject) {
      alert('Select or create a project first.');
      return;
    }

    const now = Date.now();
    const id = editingId ?? crypto.randomUUID();
    const existing = entities.find(e => e.id === id);

    const fields: EntityFields = {
      ...(existing?.fields ?? {}),
      notes: notes || undefined
    };

    const entity: WorldEntity = {
      id,
      projectId: activeProject.id,
      type,
      name,
      fields,
      links: existing?.links ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    await saveEntity(entity);

    setEntities(prev => {
      const existingIndex = prev.findIndex(e => e.id === id);
      if (existingIndex === -1) {
        return [...prev, entity];
      } else {
        const copy = [...prev];
        copy[existingIndex] = entity;
        return copy;
      }
    });

    resetForm();
  };

  const handleEdit = (entity: WorldEntity) => {
    setEditingId(entity.id);
    setName(entity.name);
    setType(entity.type);
    setNotes(entity.fields.notes ?? '');
  };

  const handleDeleteEntity = async (id: string) => {
    await deleteEntity(id);
    setEntities(prev => prev.filter(e => e.id !== id));

    if (editingId === id) {
      resetForm();
    }
  };

  if (!activeProject) {
    return (
      <section>
        <h1>World Bible</h1>
        <p>
          No active project. Go to <strong>Projects</strong> to create or open a
          project first.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1>World Bible</h1>

      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
        <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
          <h2>{editingId ? 'Edit Entity' : 'New Entity'}</h2>

          <div style={{ marginBottom: '0.75rem' }}>
            <label>
              Name<br />
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
              Type<br />
              <select
                value={type}
                onChange={e => setType(e.target.value as EntityType)}
                style={{ width: '100%' }}
              >
                <option value="character">Character</option>
                <option value="location">Location</option>
                <option value="item">Item</option>
                <option value="rule">Rule</option>
              </select>
            </label>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label>
              Notes (stored in fields.notes)<br />
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
              {editingId ? 'Save Changes' : 'Create Entity'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div style={{ flex: 1 }}>
          <h2>Entities</h2>
          {entities.length === 0 && (
            <p>No entities yet for this project. Add one on the left.</p>
          )}
          <ul>
            {entities.map(entity => (
              <li key={entity.id} style={{ marginBottom: '0.5rem' }}>
                <strong>[{entity.type}] {entity.name}</strong>
                <br />
                <small>
                  {entity.fields.notes ?? 'No notes yet.'}
                </small>
                <br />
                <button type="button" onClick={() => handleEdit(entity)}>
                  Edit
                </button>{' '}
                <button type="button" onClick={() => handleDeleteEntity(entity.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default WorldBibleRoute;
