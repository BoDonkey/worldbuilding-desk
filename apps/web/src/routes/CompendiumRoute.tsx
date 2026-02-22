import {useEffect, useMemo, useState} from 'react';
import type {
  CompendiumActionDefinition,
  CompendiumDomain,
  CompendiumEntry,
  CompendiumMilestone,
  CompendiumProgress,
  Project,
  UnlockableRecipe,
  WorldEntity
} from '../entityTypes';
import {
  getCompendiumActionLogs,
  getCompendiumEntriesByProject,
  getCompendiumMilestonesByProject,
  getCompendiumProgress,
  getRecipesByProject,
  recordCompendiumAction,
  saveCompendiumEntry,
  saveCompendiumMilestone,
  saveUnlockableRecipe,
  upsertCompendiumEntryFromEntity
} from '../services/compendiumService';
import {getEntitiesByProject} from '../entityStorage';

interface CompendiumRouteProps {
  activeProject: Project | null;
}

const DOMAIN_OPTIONS: Array<{value: CompendiumDomain; label: string}> = [
  {value: 'beast', label: 'Beast'},
  {value: 'flora', label: 'Flora'},
  {value: 'mineral', label: 'Mineral'},
  {value: 'artifact', label: 'Artifact'},
  {value: 'recipe', label: 'Recipe'},
  {value: 'custom', label: 'Custom'}
];

const RECIPE_CATEGORY_OPTIONS: UnlockableRecipe['category'][] = [
  'food',
  'crafting',
  'alchemy',
  'custom'
];

function getDefaultActions(domain: CompendiumDomain): CompendiumActionDefinition[] {
  if (domain === 'beast') {
    return [
      {id: 'discover', label: 'Discover', points: 1, repeatable: false},
      {id: 'kill', label: 'Kill', points: 3, repeatable: true},
      {id: 'skin', label: 'Skin', points: 2, repeatable: true}
    ];
  }
  if (domain === 'flora' || domain === 'mineral') {
    return [
      {id: 'discover', label: 'Discover', points: 1, repeatable: false},
      {id: 'harvest', label: 'Harvest', points: 2, repeatable: true}
    ];
  }
  return [{id: 'discover', label: 'Discover', points: 1, repeatable: false}];
}

function CompendiumRoute({activeProject}: CompendiumRouteProps) {
  const [entries, setEntries] = useState<CompendiumEntry[]>([]);
  const [milestones, setMilestones] = useState<CompendiumMilestone[]>([]);
  const [recipes, setRecipes] = useState<UnlockableRecipe[]>([]);
  const [progress, setProgress] = useState<CompendiumProgress | null>(null);
  const [logs, setLogs] = useState<Awaited<
    ReturnType<typeof getCompendiumActionLogs>
  >>([]);
  const [worldEntities, setWorldEntities] = useState<WorldEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecordingKey, setIsRecordingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const [entryName, setEntryName] = useState('');
  const [entryDomain, setEntryDomain] = useState<CompendiumDomain>('beast');
  const [entityToImportId, setEntityToImportId] = useState('');
  const [importDomain, setImportDomain] = useState<CompendiumDomain>('beast');

  const [recipeName, setRecipeName] = useState('');
  const [recipeCategory, setRecipeCategory] =
    useState<UnlockableRecipe['category']>('food');
  const [recipeMinLevel, setRecipeMinLevel] = useState<number>(1);
  const [recipeRequiredMilestones, setRecipeRequiredMilestones] = useState('');

  const [milestoneName, setMilestoneName] = useState('');
  const [milestonePoints, setMilestonePoints] = useState(10);
  const [milestoneDescription, setMilestoneDescription] = useState('');
  const [milestoneRecipeIds, setMilestoneRecipeIds] = useState('');

  const [quantityByActionKey, setQuantityByActionKey] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    if (!activeProject) {
      setEntries([]);
      setMilestones([]);
      setRecipes([]);
      setProgress(null);
      setLogs([]);
      setWorldEntities([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      getCompendiumEntriesByProject(activeProject.id),
      getCompendiumMilestonesByProject(activeProject.id),
      getRecipesByProject(activeProject.id),
      getCompendiumProgress(activeProject.id),
      getCompendiumActionLogs(activeProject.id),
      getEntitiesByProject(activeProject.id)
    ])
      .then(([loadedEntries, loadedMilestones, loadedRecipes, loadedProgress, loadedLogs, loadedEntities]) => {
        if (cancelled) return;
        setEntries(loadedEntries);
        setMilestones(loadedMilestones);
        setRecipes(loadedRecipes);
        setProgress(loadedProgress);
        setLogs(loadedLogs);
        setWorldEntities(loadedEntities);
      })
      .catch((error) => {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to load compendium data.';
        setFeedback({tone: 'error', message});
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  const completedActionSet = useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) {
      set.add(`${log.entryId}:${log.actionId}`);
    }
    return set;
  }, [logs]);

  const unlockedMilestoneSet = new Set(progress?.unlockedMilestoneIds ?? []);
  const unlockedRecipeSet = new Set(progress?.unlockedRecipeIds ?? []);
  const entryById = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries]
  );
  const worldEntityById = useMemo(
    () => new Map(worldEntities.map((entity) => [entity.id, entity])),
    [worldEntities]
  );

  const handleCreateEntry = async () => {
    if (!activeProject || !entryName.trim()) return;
    const now = Date.now();
    const next: CompendiumEntry = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      name: entryName.trim(),
      domain: entryDomain,
      actions: getDefaultActions(entryDomain),
      createdAt: now,
      updatedAt: now
    };

    setFeedback(null);
    try {
      await saveCompendiumEntry(next);
      setEntries((prev) => [...prev, next].sort((a, b) => a.name.localeCompare(b.name)));
      setEntryName('');
      setFeedback({tone: 'success', message: 'Compendium entry created.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create entry.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleImportEntity = async () => {
    if (!activeProject || !entityToImportId) return;
    const entity = worldEntityById.get(entityToImportId);
    if (!entity) return;
    setFeedback(null);
    try {
      const entry = await upsertCompendiumEntryFromEntity({
        projectId: activeProject.id,
        entity,
        domain: importDomain,
        defaultActions: getDefaultActions(importDomain)
      });
      setEntries((prev) => {
        const idx = prev.findIndex((item) => item.id === entry.id);
        if (idx === -1) return [...prev, entry].sort((a, b) => a.name.localeCompare(b.name));
        const next = [...prev];
        next[idx] = entry;
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setFeedback({tone: 'success', message: 'World Bible entity linked to compendium.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to import entity.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleCreateRecipe = async () => {
    if (!activeProject || !recipeName.trim()) return;
    const now = Date.now();
    const recipe: UnlockableRecipe = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      name: recipeName.trim(),
      category: recipeCategory,
      requirements: {
        minCharacterLevel: Math.max(1, Math.floor(recipeMinLevel)),
        requiredMilestoneIds: recipeRequiredMilestones
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      },
      createdAt: now,
      updatedAt: now
    };
    setFeedback(null);
    try {
      await saveUnlockableRecipe(recipe);
      setRecipes((prev) => [...prev, recipe].sort((a, b) => a.name.localeCompare(b.name)));
      setRecipeName('');
      setRecipeMinLevel(1);
      setRecipeRequiredMilestones('');
      setFeedback({tone: 'success', message: 'Unlockable recipe added.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save recipe.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleCreateMilestone = async () => {
    if (!activeProject || !milestoneName.trim()) return;
    const recipeIds = milestoneRecipeIds
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const milestone: CompendiumMilestone = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      name: milestoneName.trim(),
      description: milestoneDescription.trim() || undefined,
      pointsRequired: Math.max(0, Math.floor(milestonePoints)),
      unlockRecipeIds: recipeIds,
      permanentEffects: [],
      createdAt: Date.now()
    };
    setFeedback(null);
    try {
      await saveCompendiumMilestone(milestone);
      setMilestones((prev) =>
        [...prev, milestone].sort((a, b) => a.pointsRequired - b.pointsRequired)
      );
      setMilestoneName('');
      setMilestoneDescription('');
      setMilestonePoints(10);
      setMilestoneRecipeIds('');
      setFeedback({tone: 'success', message: 'Milestone added.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to save milestone.';
      setFeedback({tone: 'error', message});
    }
  };

  const handleRecordAction = async (
    entry: CompendiumEntry,
    action: CompendiumActionDefinition
  ) => {
    if (!activeProject) return;
    const key = `${entry.id}:${action.id}`;
    const quantity = action.repeatable
      ? Math.max(1, Math.floor(quantityByActionKey[key] || 1))
      : 1;

    setIsRecordingKey(key);
    setFeedback(null);
    try {
      const result = await recordCompendiumAction({
        projectId: activeProject.id,
        entryId: entry.id,
        actionId: action.id,
        quantity
      });
      setProgress(result.progress);
      if (result.log) {
        setLogs((prev) => [result.log!, ...prev]);
      }
      if (!result.log) {
        setFeedback({
          tone: 'success',
          message: 'Action already recorded (non-repeatable).'
        });
      } else if (
        result.unlockedMilestoneIds.length > 0 ||
        result.unlockedRecipeIds.length > 0
      ) {
        setFeedback({
          tone: 'success',
          message: `Action recorded. Unlocked ${result.unlockedMilestoneIds.length} milestone(s) and ${result.unlockedRecipeIds.length} recipe(s).`
        });
      } else {
        setFeedback({tone: 'success', message: 'Action recorded.'});
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to record action.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsRecordingKey(null);
    }
  };

  if (!activeProject) {
    return (
      <section>
        <h1>Compendium</h1>
        <p>
          No active project. Go to <strong>Projects</strong> to create or open a
          project first.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1>Compendium</h1>
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem'
        }}
      >
        <article style={{padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Progress</h2>
          {isLoading || !progress ? (
            <p>Loading progress...</p>
          ) : (
            <>
              <p style={{marginBottom: '0.25rem'}}>
                <strong>Total Points:</strong> {progress.totalPoints}
              </p>
              <p style={{marginBottom: '0.25rem'}}>
                <strong>Milestones Unlocked:</strong>{' '}
                {progress.unlockedMilestoneIds.length}
              </p>
              <p style={{marginBottom: 0}}>
                <strong>Recipes Unlocked:</strong> {progress.unlockedRecipeIds.length}
              </p>
            </>
          )}
        </article>

        <article style={{padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Add Entry</h2>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Name
            <input
              type='text'
              value={entryName}
              onChange={(e) => setEntryName(e.target.value)}
              style={{width: '100%'}}
            />
          </label>
          <label style={{display: 'block', marginBottom: '0.75rem'}}>
            Domain
            <select
              value={entryDomain}
              onChange={(e) => setEntryDomain(e.target.value as CompendiumDomain)}
              style={{width: '100%'}}
            >
              {DOMAIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type='button' onClick={() => void handleCreateEntry()}>
            Create Entry
          </button>
        </article>

        <article style={{padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Import from World Bible</h2>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Entity
            <select
              value={entityToImportId}
              onChange={(e) => setEntityToImportId(e.target.value)}
              style={{width: '100%'}}
            >
              <option value=''>Select an entity</option>
              {worldEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{display: 'block', marginBottom: '0.75rem'}}>
            Domain
            <select
              value={importDomain}
              onChange={(e) => setImportDomain(e.target.value as CompendiumDomain)}
              style={{width: '100%'}}
            >
              {DOMAIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type='button'
            onClick={() => void handleImportEntity()}
            disabled={!entityToImportId}
          >
            Link Entity
          </button>
        </article>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '1rem',
          alignItems: 'start'
        }}
      >
        <section style={{padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
          <h2 style={{marginTop: 0}}>Entries</h2>
          {entries.length === 0 && <p>No compendium entries yet.</p>}
          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {entries.map((entry) => (
              <li
                key={entry.id}
                style={{
                  border: '1px solid #eee',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  marginBottom: '0.75rem'
                }}
              >
                <div style={{display: 'flex', justifyContent: 'space-between', gap: '1rem'}}>
                  <div>
                    <strong>{entry.name}</strong>{' '}
                    <span style={{fontSize: '0.85rem', color: '#666'}}>
                      [{entry.domain}]
                    </span>
                    {entry.sourceEntityId && (
                      <div style={{fontSize: '0.8rem', color: '#666'}}>
                        Linked to World Bible entity
                      </div>
                    )}
                  </div>
                </div>
                <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem'}}>
                  {entry.actions.map((action) => {
                    const key = `${entry.id}:${action.id}`;
                    const alreadyDone = completedActionSet.has(key);
                    const disabled =
                      isRecordingKey === key || (!action.repeatable && alreadyDone);
                    const quantity = Math.max(1, Math.floor(quantityByActionKey[key] || 1));
                    return (
                      <div key={key} style={{display: 'flex', alignItems: 'center', gap: '0.35rem'}}>
                        {action.repeatable && (
                          <input
                            type='number'
                            min={1}
                            value={quantity}
                            onChange={(e) =>
                              setQuantityByActionKey((prev) => ({
                                ...prev,
                                [key]: Number(e.target.value)
                              }))
                            }
                            style={{width: '58px'}}
                          />
                        )}
                        <button
                          type='button'
                          onClick={() => void handleRecordAction(entry, action)}
                          disabled={disabled}
                        >
                          {isRecordingKey === key
                            ? 'Logging...'
                            : !action.repeatable && alreadyDone
                              ? `${action.label} complete`
                              : `${action.label} (+${action.points * quantity})`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div style={{display: 'grid', gap: '1rem'}}>
          <section style={{padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
            <h2 style={{marginTop: 0}}>Recipes</h2>
            <label style={{display: 'block', marginBottom: '0.5rem'}}>
              Name
              <input
                type='text'
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                style={{width: '100%'}}
              />
            </label>
            <label style={{display: 'block', marginBottom: '0.75rem'}}>
              Category
              <select
                value={recipeCategory}
                onChange={(e) =>
                  setRecipeCategory(e.target.value as UnlockableRecipe['category'])
                }
                style={{width: '100%'}}
              >
                {RECIPE_CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label style={{display: 'block', marginBottom: '0.5rem'}}>
              Min Character Level
              <input
                type='number'
                min={1}
                value={recipeMinLevel}
                onChange={(e) => setRecipeMinLevel(Number(e.target.value))}
                style={{width: '100%'}}
              />
            </label>
            <label style={{display: 'block', marginBottom: '0.75rem'}}>
              Required Milestone IDs (comma-separated)
              <input
                type='text'
                value={recipeRequiredMilestones}
                onChange={(e) => setRecipeRequiredMilestones(e.target.value)}
                style={{width: '100%'}}
              />
            </label>
            <button type='button' onClick={() => void handleCreateRecipe()}>
              Add Recipe
            </button>
            <ul style={{listStyle: 'none', padding: 0, marginTop: '0.75rem'}}>
              {recipes.map((recipe) => (
                <li key={recipe.id} style={{marginBottom: '0.35rem'}}>
                  {unlockedRecipeSet.has(recipe.id) ? 'Unlocked' : 'Locked'}: {recipe.name}
                  {recipe.requirements?.minCharacterLevel ? (
                    <> (lvl {recipe.requirements.minCharacterLevel}+)</>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section style={{padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
            <h2 style={{marginTop: 0}}>Milestones</h2>
            <label style={{display: 'block', marginBottom: '0.5rem'}}>
              Name
              <input
                type='text'
                value={milestoneName}
                onChange={(e) => setMilestoneName(e.target.value)}
                style={{width: '100%'}}
              />
            </label>
            <label style={{display: 'block', marginBottom: '0.5rem'}}>
              Points Required
              <input
                type='number'
                min={0}
                value={milestonePoints}
                onChange={(e) => setMilestonePoints(Number(e.target.value))}
                style={{width: '100%'}}
              />
            </label>
            <label style={{display: 'block', marginBottom: '0.5rem'}}>
              Description
              <input
                type='text'
                value={milestoneDescription}
                onChange={(e) => setMilestoneDescription(e.target.value)}
                style={{width: '100%'}}
              />
            </label>
            <label style={{display: 'block', marginBottom: '0.75rem'}}>
              Unlock Recipe IDs (comma-separated)
              <input
                type='text'
                value={milestoneRecipeIds}
                onChange={(e) => setMilestoneRecipeIds(e.target.value)}
                style={{width: '100%'}}
              />
            </label>
            <button type='button' onClick={() => void handleCreateMilestone()}>
              Add Milestone
            </button>
            <ul style={{listStyle: 'none', padding: 0, marginTop: '0.75rem'}}>
              {milestones.map((milestone) => (
                <li key={milestone.id} style={{marginBottom: '0.35rem'}}>
                  {unlockedMilestoneSet.has(milestone.id) ? 'Unlocked' : 'Locked'}:{' '}
                  {milestone.name} ({milestone.pointsRequired} pts)
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section style={{marginTop: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px'}}>
        <h2 style={{marginTop: 0}}>Recent Actions</h2>
        {logs.length === 0 ? (
          <p>No actions logged yet.</p>
        ) : (
          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {logs.slice(0, 12).map((log) => (
              <li key={log.id} style={{marginBottom: '0.35rem'}}>
                {(() => {
                  const entry = entryById.get(log.entryId);
                  const actionLabel =
                    entry?.actions.find((action) => action.id === log.actionId)
                      ?.label ?? log.actionId;
                  const entryLabel = entry?.name ?? log.entryId;
                  return (
                    <>
                      +{log.pointsAwarded} pts · {entryLabel} · {actionLabel} ·{' '}
                      {new Date(log.createdAt).toLocaleString()}
                    </>
                  );
                })()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

export default CompendiumRoute;
