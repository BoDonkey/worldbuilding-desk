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

    const now = Date.now();
    const project: Project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: now,
      updatedAt: now
    };

    await saveProject(project);
    setProjects((prev) => [...prev, project]);
    setName('');

    onSelectProject(project);
  };

  const handleOpen = (project: Project) => {
    onSelectProject(project);
    // navigate('/world-bible');
  };

  const handleDelete = async (project: Project) => {
    // Delete ruleset if it exists
    if (project.rulesetId) {
      await deleteRuleset(project.rulesetId);
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
        <button type='submit'>Create Project</button>
      </form>

      <h2>Existing Projects</h2>
      {projects.length === 0 && <p>No projects yet. Create one above.</p>}

      <ul>
        {projects.map((project) => {
          const hasRuleset = projectRulesets.has(project.id);
          const ruleset = projectRulesets.get(project.id);

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
                  style={{background: '#fee2e2', color: '#dc2626'}}
                >
                  Delete
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
