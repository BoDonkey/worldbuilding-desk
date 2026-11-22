import {ProjectDraftMilestoneButton} from '../components/Projects/ProjectDraftMilestoneButton';
import {useCallback, useEffect, useRef, useState} from 'react';
import type {FormEvent} from 'react';
import {useNavigate} from 'react-router';
import type {Project, ProjectMode} from '../entityTypes';
import {
  createDefaultSettings,
  getAllProjects,
  saveProject,
  deleteProject as deleteProjectFromStore,
  getDocumentsByProject,
  getEntitiesByProject,
  getRulesetByProjectId,
  getProjectVaultState,
  isProtectedProject,
  exportProjectBackupZip
} from '../services/storage';
import {getDefaultFeatureToggles} from '../projectMode';
import type {WorldRuleset} from '@worldbuilding-desk/rules-engine';
import {
  getSeriesBibleConfig,
  linkProjectToParent,
  unlinkProjectFromParent,
  syncChildWithParent
} from '../services/seriesBible/SeriesBibleService';
import {useAppStore} from '../store/appStore';
import {createSampleProject} from '../services/onboarding/createSampleProject';
import {createTrustDogfoodProject} from '../services/onboarding/createTrustDogfoodProject';
import {isDogfoodToolsEnabled} from '../services/onboarding/dogfoodTools';
import {PageHeader} from '../components/PageHeader';
import styles from '../styles/ProjectsRoute.module.css';
import {useConfirmDialog} from '../hooks/useConfirmDialog';
import {useBackupPassphraseFlow} from '../hooks/useBackupPassphraseFlow';
import {useProjectVault} from '../hooks/useProjectVault';
import {useProjectBackupImport} from '../hooks/useProjectBackupImport';
import {ProjectBackupImportPanel} from '../components/Projects/ProjectBackupImportPanel';
import {LockedProjectCard, ProjectVaultActions, ProjectVaultHelp} from '../components/Projects/ProjectVaultCard';
import {describeError} from '../services/errors';
import {RouteFeedback} from '../components/common';
import {SAMPLE_PROJECT_NAME} from '../fixtures/sampleProjectContent';

function ProjectsRoute() {
  const {requestConfirm, confirmDialog} = useConfirmDialog();
  const {chooseExport, openBackup, backupDialogs} = useBackupPassphraseFlow();
  const activeProject = useAppStore((s) => s.activeProject);
  const onSelectProject = useAppStore((s) => s.setActiveProject);
  const persistProjectSettings = useAppStore((s) => s.saveProjectSettings);
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectRulesets, setProjectRulesets] = useState<
    Map<string, WorldRuleset>
  >(new Map());
  const [projectCounts, setProjectCounts] = useState<
    Map<string, {worldEntries: number; scenes: number}>
  >(new Map());
  const [name, setName] = useState('');
  const [newProjectMode, setNewProjectMode] = useState<ProjectMode>('general');
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isLoadingDogfood, setIsLoadingDogfood] = useState(false);
  const dogfoodToolsEnabled = isDogfoodToolsEnabled();
  // A first-run offer: shown while the author has at most one project (often the blank
  // first-run project) and has not loaded the sample yet.
  const showSampleOffer =
    projects.length <= 1 && !projects.some((project) => project.name === SAMPLE_PROJECT_NAME);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [exportingProjectId, setExportingProjectId] = useState<string | null>(null);
  const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null);
  const [updatingProjectId, setUpdatingProjectId] = useState<string | null>(null);

  // A load that finishes after the route closes must not change the app's active project.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadProjects = useCallback(async () => {
    const all = await getAllProjects();
    if (!mountedRef.current) return;
    setProjects(all);
    if (activeProject && !all.some((project) => project.id === activeProject.id)) {
      await onSelectProject(null);
    }

    const rulesetMap = new Map<string, WorldRuleset>();
    const countsMap = new Map<string, {worldEntries: number; scenes: number}>();
    for (const project of all) {
      const [ruleset, entities, documents] = await Promise.all([
        getRulesetByProjectId(project.id),
        getEntitiesByProject(project.id),
        getDocumentsByProject(project.id)
      ]);
      // A locked project's ruleset is still sealed.
      if (ruleset && (await getProjectVaultState(project.id)) !== 'locked') {
        rulesetMap.set(project.id, ruleset);
      }
      countsMap.set(project.id, {
        worldEntries: entities.length,
        scenes: documents.length
      });
    }
    setProjectRulesets(rulesetMap);
    setProjectCounts(countsMap);
  }, [activeProject, onSelectProject]);

  const backupImport = useProjectBackupImport({
    projects,
    activeProject,
    openBackup,
    loadProjects,
    onSelectProject,
    setFeedback
  });

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const vault = useProjectVault({
    projectIds: projects.map((project) => project.id),
    onMessage: setFeedback,
    onProjectsChanged: () => void loadProjects()
  });

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

      const defaultSettings = await createDefaultSettings(project.id);
      if (newProjectMode !== defaultSettings.projectMode) {
        await persistProjectSettings({
          ...defaultSettings,
          projectMode: newProjectMode,
          featureToggles: getDefaultFeatureToggles(newProjectMode)
        });
      }

      setProjects((prev) => [...prev, project]);
      setName('');
      setNewProjectMode('general');

      onSelectProject(project);
      setFeedback({tone: 'success', message: 'Project created.'});
      navigate('/workspace');
    } catch (error) {
      const message =
        describeError(error, 'Unable to create project.');
      setFeedback({tone: 'error', message});
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleExploreSample = async () => {
    setIsLoadingSample(true);
    setFeedback(null);
    try {
      const sampleProject = await createSampleProject({saveProjectSettings: persistProjectSettings});
      setProjects((prev) => [...prev, sampleProject]);
      onSelectProject(sampleProject);
      setFeedback({tone: 'success', message: 'Sample project loaded.'});
      navigate('/workspace');
    } catch (error) {
      const message =
        describeError(error, 'Unable to load the sample project.');
      setFeedback({tone: 'error', message});
    } finally {
      setIsLoadingSample(false);
    }
  };

  const handleLoadTrustDogfood = async () => {
    setIsLoadingDogfood(true);
    setFeedback(null);
    try {
      const project = await createTrustDogfoodProject({saveProjectSettings: persistProjectSettings});
      setProjects((prev) => [...prev, project]);
      onSelectProject(project);
      setFeedback({
        tone: 'success',
        message: 'Trust-dogfood fixture loaded: 5 scenes, 4 Source Notes, ruleset linked. Nothing is canon yet.'
      });
      navigate('/workspace');
    } catch (error) {
      setFeedback({tone: 'error', message: describeError(error, 'Unable to load the trust-dogfood fixture.')});
    } finally {
      setIsLoadingDogfood(false);
    }
  };

  const handleOpen = (project: Project) => {
    onSelectProject(project);
    navigate('/workspace');
  };

  const activeProjectCounts = activeProject
    ? projectCounts.get(activeProject.id) ?? {worldEntries: 0, scenes: 0}
    : null;
  const activeProjectHasRuleset = activeProject
    ? projectRulesets.has(activeProject.id)
    : false;

  const handleDelete = (project: Project) => {
    requestConfirm({
      title: `Delete project "${project.name}"?`,
      message: 'This removes the project and its ruleset. This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        setDeletingProjectId(project.id);
        setFeedback(null);
        try {
          await deleteProjectFromStore(project.id);
          setProjects((prev) => prev.filter((p) => p.id !== project.id));
          setProjectRulesets((prev) => {
            const newMap = new Map(prev);
            newMap.delete(project.id);
            return newMap;
          });

          if (activeProject && activeProject.id === project.id) {
            await onSelectProject(null);
          }
          setFeedback({tone: 'success', message: 'Project deleted.'});
        } catch (error) {
          const message =
            describeError(error, 'Unable to delete project.');
          setFeedback({tone: 'error', message});
        } finally {
          setDeletingProjectId(null);
        }
      }
    });
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
        describeError(error, 'Unable to update parent project.');
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
        describeError(error, 'Unable to sync with parent.');
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
        describeError(error, 'Unable to update inheritance.');
      setFeedback({tone: 'error', message});
    } finally {
      setUpdatingProjectId(null);
    }
  };

  const handleExportProjectBackup = async (project: Project) => {
    const choice = await chooseExport(project.name, {projectProtected: isProtectedProject(project.id)});
    if (!choice) return;
    setExportingProjectId(project.id);
    setFeedback(null);
    try {
      const result = await exportProjectBackupZip({
        projectId: project.id,
        projectName: project.name,
        passphrase: choice.passphrase
      });
      setFeedback({
        tone: 'success',
        message: result.encrypted
          ? `Encrypted backup exported for "${project.name}". Keep its passphrase somewhere safe; it cannot be recovered.`
          : `Backup exported for "${project.name}".`
      });
    } catch (error) {
      const message =
        describeError(error, 'Unable to export project backup.');
      setFeedback({tone: 'error', message});
    } finally {
      setExportingProjectId(null);
    }
  };


  return (
    <section className={styles.page}>
      <PageHeader
        eyebrow='Project library'
        title='Projects'
        description='Open a project and get back to writing. Create new worlds here; use the utility tools only when you need backup or migration work.'
      />
      <RouteFeedback feedback={feedback} onClear={() => setFeedback(null)} />
      {activeProject && projects.some((project) => project.id === activeProject.id) && (
        <section className={styles.heroCard}>
          <div className={styles.heroHeader}>
            <div>
              <h2 className={styles.heroTitle}>{activeProject.name}</h2>
              <p className={styles.heroCopy}>
                Resume writing, review canon, or adjust project settings. Advanced setup can stay out of the way until you need it.
              </p>
            </div>
            <div className={styles.inlineActions}>
              <button type='button' onClick={() => navigate('/workspace')}>
                Open Workspace
              </button>
              <button type='button' onClick={() => navigate('/world-bible')}>
                Open World
              </button>
              <button type='button' onClick={() => navigate('/settings')}>
                Settings
              </button>
            </div>
          </div>
          <div className={styles.checklistGrid}>
            <div className={styles.checklistCard}>
              <div className={styles.checklistMeta}>Scenes</div>
              <div className={styles.checklistTitle}>
                {activeProjectCounts?.scenes ?? 0} scene{(activeProjectCounts?.scenes ?? 0) === 1 ? '' : 's'}
              </div>
              <div className={styles.checklistHelp}>
                Drafts and imported manuscript scenes available in the workspace.
              </div>
            </div>
            <div className={styles.checklistCard}>
              <div className={styles.checklistMeta}>World Records</div>
              <div className={styles.checklistTitle}>
                {activeProjectCounts?.worldEntries ?? 0} entr{(activeProjectCounts?.worldEntries ?? 0) === 1 ? 'y' : 'ies'}
              </div>
              <div className={styles.checklistHelp}>
                Characters, places, factions, items, and other canon records.
              </div>
            </div>
            <div className={styles.checklistCard}>
              <div className={styles.checklistMeta}>Systems Layer</div>
              <div className={styles.checklistTitle}>
                {activeProjectHasRuleset ? 'Configured' : 'Lightweight'}
              </div>
              <div className={styles.checklistHelp}>
                {activeProjectHasRuleset
                  ? 'This project already has ruleset data and can grow into deeper system support.'
                  : 'This project is currently oriented around writing and canon, with no ruleset required.'}
              </div>
            </div>
          </div>
        </section>
      )}

      <ProjectBackupImportPanel projects={projects} backupImport={backupImport} />

      <div className={styles.layout}>
        {/* One grid cell for the whole left column, so the project list stays at the top right. */}
        <div className={styles.startColumn}>
        <form onSubmit={handleSubmit} className={styles.createCard}>
          <h2>Create New Project</h2>
          <p className={styles.sectionIntro}>
            Pick a name and starting mode. You can change behavior later in Settings.
          </p>
          <div className={styles.formRow}>
            <label className={styles.fieldLabel}>
              Project Name
              <input
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          </div>
          <div className={styles.formRow}>
            <label className={styles.fieldLabel}>
              Project Type
              <select
                value={newProjectMode}
                onChange={(e) => setNewProjectMode(e.target.value as ProjectMode)}
              >
                <option value='general'>General Fiction — narrative focus, no game systems</option>
                <option value='litrpg'>LitRPG — system notifications, status windows, stat blocks</option>
              </select>
            </label>
          </div>
          <button type='submit' disabled={isCreatingProject}>
            {isCreatingProject ? 'Creating...' : 'Create Project'}
          </button>
        </form>

        {showSampleOffer && (
        <p className={styles.sectionIntro}>
          New here?{' '}
          <button type='button' onClick={() => void handleExploreSample()} disabled={isLoadingSample}>
            {isLoadingSample ? 'Loading sample...' : 'Explore a sample project'}
          </button>{' '}
          — a short manuscript with a deliberate canon conflict already waiting to be found.
        </p>
        )}
        {dogfoodToolsEnabled ? (
          <p className={styles.sectionIntro} data-testid='dogfood-tools'>
            Dogfood tools (dev only):{' '}
            <button type='button' onClick={() => void handleLoadTrustDogfood()} disabled={isLoadingDogfood}>
              {isLoadingDogfood ? 'Loading fixture...' : 'Load trust-dogfood fixture'}
            </button>{' '}
            — seeds the Slice 1.1 runbook project (chapters, Source Notes, ruleset) with no canon, sheets, or
            state, so the run starts at review.
          </p>
        ) : null}
        </div>

        <section className={styles.listCard}>
          <h2>Existing Projects</h2>
          <ProjectVaultHelp />
          {projects.length === 0 && (
            <p className={styles.emptyState}>No projects yet. Create one to get started.</p>
          )}

      <ul className={styles.projectList}>
        {projects.map((project) => {
          const hasRuleset = projectRulesets.has(project.id);
          const ruleset = projectRulesets.get(project.id);
          const parentConfig = getSeriesBibleConfig(project);
          const parentOptions = projects.filter((p) => p.id !== project.id && vault.vaultStateOf(p.id) !== 'locked');

          if (vault.vaultStateOf(project.id) === 'locked') {
            return (
              <LockedProjectCard
                key={project.id}
                project={project}
                deleting={deletingProjectId === project.id}
                onUnlock={() => void vault.unlockAndOpen(project, handleOpen)}
                onDelete={() => handleDelete(project)}
              />
            );
          }

          return (
            <li key={project.id} className={styles.projectCard}>
              <div className={styles.projectHeader}>
              <strong className={styles.projectName}>{project.name}</strong>{' '}
              {activeProject && activeProject.id === project.id && (
                <span className={styles.activeBadge}>
                  (active)
                </span>
              )}
              </div>
              {hasRuleset && ruleset && (
                <div className={styles.projectStats}>
                  <strong>Ruleset:</strong> {ruleset.name}
                  <br />
                  Stats: {ruleset.statDefinitions.length}, Resources:{' '}
                  {ruleset.resourceDefinitions.length}, Rules:{' '}
                  {ruleset.rules.length}
                </div>
              )}
              <div className={styles.projectMetaSection}>
                <label className={styles.fieldLabel}>
                  Parent Project
                  <select
                    value={project.parentProjectId ?? ''}
                    onChange={(e) =>
                      handleParentSelection(project, e.target.value)
                    }
                    disabled={updatingProjectId === project.id}
                  >
                    <option value=''>No parent</option>
                    {parentOptions.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                    </option>
                  ))}
                  </select>
                  {project.parentProjectId && (
                    <span className={styles.sectionIntro}>
                      Inherits from{' '}
                      {
                        projects.find((p) => p.id === project.parentProjectId)
                          ?.name
                      }
                    </span>
                  )}
                </label>
                <div className={styles.toggleGroup}>
                  <label className={styles.toggleLabel}>
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
                    Inherit indexed context
                  </label>
                  <label className={styles.toggleLabel}>
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
                    Inherit project memory
                  </label>
                </div>
                {project.parentProjectId && (
                  <div className={styles.syncMeta}>
                    Parent canon version:{' '}
                    {parentConfig.canonVersion ?? 'n/a'}
                    <br />
                    Last synced:{' '}
                    {project.lastSyncedCanon ?? 'never'}
                    <button
                      type='button'
                      className={styles.syncButton}
                      onClick={() => handleSyncWithParent(project)}
                      disabled={syncingProjectId === project.id}
                    >
                      {syncingProjectId === project.id ? 'Syncing...' : 'Sync now'}
                    </button>
                  </div>
                )}
              </div>
              <div className={styles.projectActions}>
                <button type='button' onClick={() => handleOpen(project)}>
                  Open Project
                </button>

                <button
                  type='button'
                  onClick={() => void handleExportProjectBackup(project)}
                  disabled={exportingProjectId === project.id}
                  className={styles.backupButton}
                >
                  {exportingProjectId === project.id
                    ? 'Exporting...'
                    : 'Export Backup'}
                </button>

                {vault.vaultStateOf(project.id) !== 'locked' && (
                  <ProjectDraftMilestoneButton
                    projectId={project.id}
                    projectName={project.name}
                    className={styles.backupButton}
                  />
                )}

                <button
                  type='button'
                  onClick={() => handleDelete(project)}
                  disabled={deletingProjectId === project.id}
                  className={styles.dangerButton}
                >
                  {deletingProjectId === project.id ? 'Deleting...' : 'Delete'}
                </button>
                <ProjectVaultActions
                  state={vault.vaultStateOf(project.id)}
                  onProtect={() => vault.requestProtect(project)}
                  onLock={() => vault.lockProject(project.id)}
                  onChangePassphrase={() => vault.requestChangePassphrase(project)}
                  onRemoveProtection={() => vault.requestRemoveProtection(project)}
                />
              </div>
            </li>
          );
        })}
      </ul>
        </section>
      </div>

      {confirmDialog}
      {backupDialogs}
      {vault.vaultDialogs}
    </section>
  );
}

export default ProjectsRoute;
