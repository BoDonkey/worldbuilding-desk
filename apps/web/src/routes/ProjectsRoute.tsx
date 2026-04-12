import {useCallback, useEffect, useRef, useState} from 'react';
import type {ChangeEvent, FormEvent} from 'react';
import {useNavigate} from 'react-router-dom';
import type {Project, ProjectMode} from '../entityTypes';
import {createDefaultSettings, saveProjectSettings} from '../settingsStorage';
import {getDefaultFeatureToggles} from '../projectMode';
import type {WorldRuleset} from '@litrpg-tool/rules-engine';
import {
  getAllProjects,
  getProjectById,
  saveProject,
  deleteProject as deleteProjectFromStore
} from '../projectStorage';
import {getDocumentsByProject} from '../writingStorage';
import {getEntitiesByProject} from '../entityStorage';
import {getRulesetByProjectId, deleteRuleset} from '../services/rules';
import {
  getSeriesBibleConfig,
  linkProjectToParent,
  unlinkProjectFromParent,
  syncChildWithParent
} from '../services/seriesBible/SeriesBibleService';
import {exportProjectBackupZip} from '../services/storage';
import {
  importProjectBackup,
  parseProjectBackupZip,
  previewProjectBackupConflicts
} from '../services/storage';
import type {
  ProjectBackupConflictSummary,
  ProjectBackupImportMode,
  ProjectSnapshotImportPreview
} from '../services/storage';
import type {ProjectSnapshot} from '../services/storage';
import {
  buildProjectSnapshot,
  diffSnapshotCounts,
  validateSnapshotCounts
} from '../services/storage';
import {useAppStore} from '../store/appStore';
import styles from '../styles/ProjectsRoute.module.css';

function ProjectsRoute() {
  const activeProject = useAppStore((s) => s.activeProject);
  const onSelectProject = useAppStore((s) => s.setActiveProject);
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
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [exportingProjectId, setExportingProjectId] = useState<string | null>(null);
  const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null);
  const [updatingProjectId, setUpdatingProjectId] = useState<string | null>(null);
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [importPreview, setImportPreview] = useState<ProjectSnapshotImportPreview | null>(null);
  const [importSnapshot, setImportSnapshot] = useState<ProjectSnapshot | null>(null);
  const [importMode, setImportMode] = useState<ProjectBackupImportMode>('new');
  const [importTargetProjectId, setImportTargetProjectId] = useState('');
  const [importConflicts, setImportConflicts] =
    useState<ProjectBackupConflictSummary | null>(null);
  const [isValidatingBackup, setIsValidatingBackup] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const validateFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadProjects = useCallback(async () => {
    const all = await getAllProjects();
    setProjects(all);

    const rulesetMap = new Map<string, WorldRuleset>();
    const countsMap = new Map<string, {worldEntries: number; scenes: number}>();
    for (const project of all) {
      const [ruleset, entities, documents] = await Promise.all([
        getRulesetByProjectId(project.id),
        getEntitiesByProject(project.id),
        getDocumentsByProject(project.id)
      ]);
      if (ruleset) {
        rulesetMap.set(project.id, ruleset);
      }
      countsMap.set(project.id, {
        worldEntries: entities.length,
        scenes: documents.length
      });
    }
    setProjectRulesets(rulesetMap);
    setProjectCounts(countsMap);
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

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
        await saveProjectSettings({
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
        error instanceof Error ? error.message : 'Unable to create project.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsCreatingProject(false);
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

  const handleExportProjectBackup = async (project: Project) => {
    setExportingProjectId(project.id);
    setFeedback(null);
    try {
      await exportProjectBackupZip({
        projectId: project.id,
        projectName: project.name
      });
      setFeedback({
        tone: 'success',
        message: `Backup exported for "${project.name}".`
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to export project backup.';
      setFeedback({tone: 'error', message});
    } finally {
      setExportingProjectId(null);
    }
  };

  const clearImportState = () => {
    setImportPreview(null);
    setImportSnapshot(null);
    setImportMode('new');
    setImportTargetProjectId('');
    setImportConflicts(null);
  };

  const refreshImportConflicts = async (
    snapshot: ProjectSnapshot,
    targetProjectId: string
  ) => {
    if (!targetProjectId) {
      setImportConflicts(null);
      return;
    }
    try {
      const conflicts = await previewProjectBackupConflicts({
        snapshot,
        targetProjectId
      });
      setImportConflicts(conflicts);
    } catch {
      setImportConflicts(null);
    }
  };

  const handleSelectBackupFile = () => {
    importFileInputRef.current?.click();
  };

  const handleSelectValidateFile = () => {
    validateFileInputRef.current?.click();
  };

  const handleBackupFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsingImport(true);
    setFeedback(null);
    try {
      const parsed = await parseProjectBackupZip(file);
      setImportSnapshot(parsed.snapshot);
      setImportPreview(parsed.preview);
      setImportMode('new');
      setImportConflicts(null);
      const defaultTarget = activeProject?.id ?? projects[0]?.id ?? '';
      setImportTargetProjectId(defaultTarget);
      setFeedback({
        tone: 'success',
        message: `Loaded backup preview for "${parsed.preview.sourceProjectName}".`
      });
    } catch (error) {
      clearImportState();
      const message =
        error instanceof Error ? error.message : 'Unable to parse backup zip.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsParsingImport(false);
      event.target.value = '';
    }
  };

  const handleImportModeChange = async (mode: ProjectBackupImportMode) => {
    setImportMode(mode);
    if (mode !== 'merge' || !importSnapshot) {
      setImportConflicts(null);
      return;
    }
    await refreshImportConflicts(importSnapshot, importTargetProjectId);
  };

  const handleImportTargetProjectChange = async (projectId: string) => {
    setImportTargetProjectId(projectId);
    if (importMode !== 'merge' || !importSnapshot) {
      setImportConflicts(null);
      return;
    }
    await refreshImportConflicts(importSnapshot, projectId);
  };

  const handleApplyBackupImport = async () => {
    if (!importSnapshot) return;
    if (importMode === 'merge' && !importTargetProjectId) {
      setFeedback({tone: 'error', message: 'Choose a target project to merge into.'});
      return;
    }

    setIsApplyingImport(true);
    setFeedback(null);
    try {
      const result = await importProjectBackup({
        snapshot: importSnapshot,
        mode: importMode,
        targetProjectId: importMode === 'merge' ? importTargetProjectId : undefined
      });
      await loadProjects();
      const importedProject = await getProjectById(result.projectId);
      if (importedProject) {
        onSelectProject(importedProject);
      }
      const importedSnapshot = await buildProjectSnapshot(result.projectId);
      const countDiffs = diffSnapshotCounts({
        expected: importSnapshot.counts,
        actual: importedSnapshot.counts
      });
      clearImportState();
      setFeedback({
        tone: countDiffs.length > 0 ? 'error' : 'success',
        message:
          (result.mode === 'new'
            ? `Imported backup into new project "${result.projectName}".`
            : `Merged backup into "${result.projectName}".`) +
          (countDiffs.length > 0
            ? ` Count check mismatch: ${countDiffs.join(' | ')}`
            : ' Count check passed.')
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to import backup.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsApplyingImport(false);
    }
  };

  const handleValidateBackupFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsValidatingBackup(true);
    setFeedback(null);
    try {
      const parsed = await parseProjectBackupZip(file);
      const result = validateSnapshotCounts(parsed.snapshot);
      setFeedback({
        tone: result.ok ? 'success' : 'error',
        message: result.ok
          ? `Backup "${file.name}" passed integrity checks.`
          : `Backup "${file.name}" has count mismatches: ${result.mismatches.join(' | ')}`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to validate backup zip.';
      setFeedback({tone: 'error', message});
    } finally {
      setIsValidatingBackup(false);
      event.target.value = '';
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>Projects</h1>
        <p className={styles.pageIntro}>
          Open a project and get back to writing. Create new worlds here; use the utility tools only when you need backup or migration work.
        </p>
      </div>
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
      {activeProject && (
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

      <details className={styles.helpPanel}>
        <summary>Backup and import tools</summary>
        <div className={styles.helpBody}>
          <div className={styles.utilityBar}>
            <button
              type='button'
              onClick={handleSelectBackupFile}
              disabled={isParsingImport}
            >
              {isParsingImport ? 'Loading Backup...' : 'Import Backup (.zip)'}
            </button>
            <input
              ref={importFileInputRef}
              type='file'
              accept='.zip,application/zip'
              onChange={(e) => void handleBackupFileChange(e)}
              style={{display: 'none'}}
            />
            <button
              type='button'
              onClick={handleSelectValidateFile}
              disabled={isValidatingBackup}
            >
              {isValidatingBackup ? 'Validating...' : 'Validate Backup (.zip)'}
            </button>
            <input
              ref={validateFileInputRef}
              type='file'
              accept='.zip,application/zip'
              onChange={(e) => void handleValidateBackupFile(e)}
              style={{display: 'none'}}
            />
          </div>
          <p>
            Use these when migrating projects, checking archive integrity, or restoring a backup. They are not part of normal writing flow.
          </p>
        </div>
      </details>

      {importPreview && importSnapshot && (
        <section className={styles.importPreviewCard}>
          <div className={styles.importPreviewHeader}>
            <h2>Backup Import Preview</h2>
            <div className={styles.inlineActions}>
              <button
                type='button'
                onClick={() => void handleApplyBackupImport()}
                disabled={isApplyingImport}
              >
                {isApplyingImport ? 'Importing...' : 'Apply Import'}
              </button>
              <button type='button' onClick={clearImportState} disabled={isApplyingImport}>
                Cancel
              </button>
            </div>
          </div>

          <p className={styles.importMeta}>
            Source: <strong>{importPreview.sourceProjectName}</strong> ({importPreview.sourceProjectId}) ·
            Snapshot: {new Date(importPreview.generatedAt).toLocaleString()}
          </p>

          <div className={styles.importControls}>
            <label className={styles.fieldLabel}>
              Import Mode
              <select
                value={importMode}
                onChange={(e) =>
                  void handleImportModeChange(e.target.value as ProjectBackupImportMode)
                }
                disabled={isApplyingImport}
              >
                <option value='new'>Create New Project</option>
                <option value='merge'>Merge Into Existing Project</option>
              </select>
            </label>
            {importMode === 'merge' && (
              <label className={styles.fieldLabel}>
                Target Project
                <select
                  value={importTargetProjectId}
                  onChange={(e) =>
                    void handleImportTargetProjectChange(e.target.value)
                  }
                  disabled={isApplyingImport}
                >
                  <option value=''>Select project</option>
                  {projects.map((project) => (
                    <option key={`merge-target-${project.id}`} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className={styles.countsText}>
            Counts: {importPreview.counts.categories} categories · {importPreview.counts.entities}{' '}
            entities · {importPreview.counts.writingDocuments} scenes ·{' '}
            {importPreview.counts.characters} characters · {importPreview.counts.characterSheets}{' '}
            sheets
          </div>

          {importMode === 'merge' && importConflicts && (
            <div className={styles.conflictPreview}>
              Merge conflict preview: {importConflicts.sameNameCategoryCount} category name match(es),{' '}
              {importConflicts.sameNameEntityCount} entity name match(es),{' '}
              {importConflicts.sameNameDocumentCount} scene title match(es), settings exists:{' '}
              {importConflicts.hasTargetSettings ? 'yes' : 'no'}, ruleset exists:{' '}
              {importConflicts.hasTargetRuleset ? 'yes' : 'no'}.
            </div>
          )}
        </section>
      )}

      <div className={styles.layout}>
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
                <option value='game'>Game / TTRPG — rules-heavy, mechanics-forward</option>
              </select>
            </label>
          </div>
          <button type='submit' disabled={isCreatingProject}>
            {isCreatingProject ? 'Creating...' : 'Create Project'}
          </button>
        </form>

        <section className={styles.listCard}>
          <h2>Existing Projects</h2>
          <p className={styles.sectionIntro}>
            Open a project to continue writing. Canon inheritance and backups remain available per project when needed.
          </p>
          {projects.length === 0 && (
            <p className={styles.emptyState}>No projects yet. Create one to get started.</p>
          )}

      <ul className={styles.projectList}>
        {projects.map((project) => {
          const hasRuleset = projectRulesets.has(project.id);
          const ruleset = projectRulesets.get(project.id);
          const parentConfig = getSeriesBibleConfig(project);
          const parentOptions = projects.filter((p) => p.id !== project.id);

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
                    Inherit RAG data
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
                    Inherit memories
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
                    : 'Export Backup (.zip)'}
                </button>

                <button
                  type='button'
                  onClick={() => handleDelete(project)}
                  disabled={deletingProjectId === project.id}
                  className={styles.dangerButton}
                >
                  {deletingProjectId === project.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
        </section>
      </div>
    </section>
  );
}

export default ProjectsRoute;
