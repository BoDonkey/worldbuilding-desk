import {useEffect, useState} from 'react';
import type {FormEvent} from 'react';
import type {Project} from '../entityTypes';
import type {WorldRuleset} from '@litrpg-tool/rules-engine';
import {
  getAllProjects,
  saveProject,
  deleteProject as deleteProjectFromStore
} from '../projectStorage';
import {getRulesetByProjectId, deleteRuleset} from '../services/rulesetService';
import {WorldBuildingWizard} from '@litrpg-tool/rules-ui';
import '@rules-ui/styles/wizard.css';
import {
  getSeriesBibleConfig,
  linkProjectToParent,
  unlinkProjectFromParent,
  syncChildWithParent
} from '../services/seriesBible/SeriesBibleService';

interface ProjectsRouteProps {
  activeProject: Project | null;
  onSelectProject(project: Project | null): void;
}

function ProjectsRoute({activeProject, onSelectProject}: ProjectsRouteProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectRulesets, setProjectRulesets] = useState<
    Map<string, WorldRuleset>
  >(new Map());
  const [name, setName] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [wizardProjectId, setWizardProjectId] = useState<string | null>(null);
  const [wizardInitialRuleset, setWizardInitialRuleset] = useState<WorldRuleset | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null);
  const [updatingProjectId, setUpdatingProjectId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const all = await getAllProjects();
      setProjects(all);

      // Load rulesets for each project
      const rulesetMap = new Map<string, WorldRuleset>();
      for (const project of all) {
        if (project.rulesetId) {
          const ruleset = await getRulesetByProjectId(project.id);
          if (ruleset) {
            rulesetMap.set(project.id, ruleset);
          }
        }
      }
      setProjectRulesets(rulesetMap);
    })();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    setIsCreatingProject(true);
    setFeedback(null);
    try {
      const now = Date.now();
      const project: Project = {
        id: crypto.randomUUID(),
        name: name.trim(),
        inheritRag: true,
        inheritShodh: true,
        createdAt: now,
        updatedAt: now
      };

      await saveProject(project);
      setProjects((prev) => [...prev, project]);
      setName('');

      onSelectProject(project);
      setFeedback({tone: 'success', message: 'Project created.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create project.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleOpen = (project: Project) => {
    onSelectProject(project);
    // navigate('/world-bible');
  };

  const handleDelete = async (project: Project) => {
    const confirmed = window.confirm(`Delete project "${project.name}"?`);
    if (!confirmed) return;

    setDeletingProjectId(project.id);
    setFeedback(null);
    try {
      // Delete ruleset if it exists
      if (project.rulesetId) {
        await deleteRuleset(project.rulesetId, project.id);
      }

      await deleteProjectFromStore(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      setProjectRulesets((prev) => {
        const newMap = new Map(prev);
        newMap.delete(project.id);
        return newMap;
      });

      if (activeProject && activeProject.id === project.id) {
        onSelectProject(null);
      }
      setFeedback({tone: 'success', message: 'Project deleted.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to delete project.';
      setFeedback({tone: 'error', message});
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleCreateRuleset = (projectId: string) => {
    const existingRuleset = projectRulesets.get(projectId);
    setWizardProjectId(projectId);
    setWizardInitialRuleset(existingRuleset || null);
    setShowWizard(true);
  };

  const handleWizardComplete = async (ruleset: WorldRuleset) => {
    if (!wizardProjectId) return;

    // Import the saveRuleset function
    const {saveRuleset} = await import('../services/rulesetService');

    await saveRuleset(ruleset, wizardProjectId);

    // Update project with rulesetId
    const project = projects.find((p) => p.id === wizardProjectId);
    if (project) {
      const updatedProject = {
        ...project,
        rulesetId: ruleset.id,
        updatedAt: Date.now()
      };
      await saveProject(updatedProject);
      setProjects((prev) =>
        prev.map((p) => (p.id === wizardProjectId ? updatedProject : p))
      );
    }

    // Update local state
    setProjectRulesets((prev) => new Map(prev).set(wizardProjectId, ruleset));

    setShowWizard(false);
    setWizardProjectId(null);
    setWizardInitialRuleset(null);
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
    setWizardProjectId(null);
    setWizardInitialRuleset(null);
  };

  const updateProjectState = (updated: Project | null) => {
    if (!updated) return;
    setProjects((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
    if (activeProject && activeProject.id === updated.id) {
      onSelectProject(updated);
    }
  };

  const handleParentSelection = async (
    project: Project,
    parentProjectId: string
  ) => {
    setUpdatingProjectId(project.id);
    setFeedback(null);
    try {
      if (!parentProjectId) {
        const updated = await unlinkProjectFromParent(project.id);
        updateProjectState(updated);
        setFeedback({tone: 'success', message: 'Parent project removed.'});
        return;
      }
      const updated = await linkProjectToParent(project.id, {
        parentProjectId,
        inheritRag: project.inheritRag ?? true,
        inheritShodh: project.inheritShodh ?? true,
        canonVersion: project.canonVersion
      });
      updateProjectState(updated);
      setFeedback({tone: 'success', message: 'Parent project updated.'});
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to update parent project.';
      setFeedback({tone: 'error', message});
    } finally {
      setUpdatingProjectId(null);
    }
  };

  const handleSyncWithParent = async (project: Project) => {
    setSyncingProjectId(project.id);
    setFeedback(null);
    try {
      const updated = await syncChildWithParent(project.id);
      updateProjectState(updated);
      setFeedback({tone: 'success', message: 'Project synced with parent canon.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to sync with parent.';
      setFeedback({tone: 'error', message});
    } finally {
      setSyncingProjectId(null);
    }
  };

  const handleInheritanceToggle = async (
    project: Project,
    field: 'inheritRag' | 'inheritShodh',
    value: boolean
  ) => {
    setUpdatingProjectId(project.id);
    setFeedback(null);
    try {
      const updated = {
        ...project,
        [field]: value,
        updatedAt: Date.now()
      };
      await saveProject(updated);
      updateProjectState(updated);
      setFeedback({tone: 'success', message: 'Project inheritance updated.'});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update inheritance.';
      setFeedback({tone: 'error', message});
    } finally {
      setUpdatingProjectId(null);
    }
  };

  if (showWizard) {
    return (
      <section
        style={{height: '100vh', display: 'flex', flexDirection: 'column'}}
      >
        <div style={{padding: '1rem', borderBottom: '1px solid #e5e7eb'}}>
          <button onClick={handleWizardCancel} style={{marginBottom: '0.5rem'}}>
            ← Back to Projects
          </button>
          <h1>{wizardInitialRuleset ? 'Edit World Ruleset' : 'Create World Ruleset'}</h1>
        </div>
        <div style={{flex: 1, overflow: 'hidden'}}>
          <WorldBuildingWizard
            onComplete={handleWizardComplete}
            onCancel={handleWizardCancel}
            initialRuleset={wizardInitialRuleset || undefined}
          />
        </div>
      </section>
    );
  }

  return (
    <section>
      <h1>Projects</h1>
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

      <form
        onSubmit={handleSubmit}
        style={{maxWidth: 400, marginBottom: '1rem'}}
      >
        <h2>Create New Project</h2>
        <div style={{marginBottom: '0.75rem'}}>
          <label>
            Project Name
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
        <button type='submit' disabled={isCreatingProject}>
          {isCreatingProject ? 'Creating...' : 'Create Project'}
        </button>
      </form>

      <h2>Existing Projects</h2>
      {projects.length === 0 && <p>No projects yet. Create one above to get started.</p>}

      <ul>
        {projects.map((project) => {
          const hasRuleset = projectRulesets.has(project.id);
          const ruleset = projectRulesets.get(project.id);
          const parentConfig = getSeriesBibleConfig(project);
          const parentOptions = projects.filter((p) => p.id !== project.id);

          return (
            <li
              key={project.id}
              style={{
                marginBottom: '1rem',
                padding: '1rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            >
              <strong>{project.name}</strong>{' '}
              {activeProject && activeProject.id === project.id && (
                <span style={{color: '#10b981', fontWeight: 600}}>
                  (active)
                </span>
              )}
              {hasRuleset && ruleset && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#6b7280'
                  }}
                >
                  <strong>Ruleset:</strong> {ruleset.name}
                  <br />
                  Stats: {ruleset.statDefinitions.length}, Resources:{' '}
                  {ruleset.resourceDefinitions.length}, Rules:{' '}
                  {ruleset.rules.length}
                </div>
              )}
              <div
                style={{
                  marginTop: '0.75rem',
                  borderTop: '1px solid #e5e7eb',
                  paddingTop: '0.75rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <label>
                  Parent Project
                  <br />
                  <select
                    value={project.parentProjectId ?? ''}
                    onChange={(e) =>
                      handleParentSelection(project, e.target.value)
                    }
                    disabled={updatingProjectId === project.id}
                    style={{width: '100%'}}
                  >
                    <option value=''>No parent</option>
                    {parentOptions.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                  {project.parentProjectId && (
                    <span style={{display: 'block', color: '#6b7280'}}>
                      Inherits from{' '}
                      {
                        projects.find((p) => p.id === project.parentProjectId)
                          ?.name
                      }
                    </span>
                  )}
                </label>
                <div style={{display: 'flex', gap: '1rem'}}>
                  <label style={{display: 'flex', gap: '0.25rem'}}>
                    <input
                      type='checkbox'
                      disabled={
                        !project.parentProjectId || updatingProjectId === project.id
                      }
                      checked={project.inheritRag ?? true}
                      onChange={(e) =>
                        handleInheritanceToggle(project, 'inheritRag', e.target.checked)
                      }
                    />
                    Inherit RAG data
                  </label>
                  <label style={{display: 'flex', gap: '0.25rem'}}>
                    <input
                      type='checkbox'
                      disabled={
                        !project.parentProjectId || updatingProjectId === project.id
                      }
                      checked={project.inheritShodh ?? true}
                      onChange={(e) =>
                        handleInheritanceToggle(
                          project,
                          'inheritShodh',
                          e.target.checked
                        )
                      }
                    />
                    Inherit memories
                  </label>
                </div>
                {project.parentProjectId && (
                  <div style={{fontSize: '0.8rem', color: '#6b7280'}}>
                    Parent canon version:{' '}
                    {parentConfig.canonVersion ?? 'n/a'}
                    <br />
                    Last synced:{' '}
                    {project.lastSyncedCanon ?? 'never'}
                    <button
                      type='button'
                      style={{marginLeft: '0.5rem', fontSize: '0.75rem'}}
                      onClick={() => handleSyncWithParent(project)}
                      disabled={syncingProjectId === project.id}
                    >
                      {syncingProjectId === project.id ? 'Syncing...' : 'Sync now'}
                    </button>
                  </div>
                )}
              </div>
              <div
                style={{
                  marginTop: '0.75rem',
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}
              >
                <button type='button' onClick={() => handleOpen(project)}>
                  Open Project
                </button>

                {hasRuleset ? (
                  <button
                    type='button'
                    onClick={() => handleCreateRuleset(project.id)}
                    style={{background: '#f3f4f6', color: '#374151'}}
                  >
                    Edit Ruleset
                  </button>
                ) : (
                  <button
                    type='button'
                    onClick={() => handleCreateRuleset(project.id)}
                    style={{background: '#4f46e5', color: 'white'}}
                  >
                    Create Ruleset
                  </button>
                )}

                <button
                  type='button'
                  onClick={() => handleDelete(project)}
                  disabled={deletingProjectId === project.id}
                  style={{background: '#fee2e2', color: '#dc2626'}}
                >
                  {deletingProjectId === project.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default ProjectsRoute;
