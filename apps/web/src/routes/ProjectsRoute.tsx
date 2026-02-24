import {useCallback, useEffect, useRef, useState} from 'react';
import type {ChangeEvent, FormEvent} from 'react';
import type {Project} from '../entityTypes';
import type {WorldRuleset} from '@litrpg-tool/rules-engine';
import {
  getAllProjects,
  getProjectById,
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
import {exportProjectBackupZip} from '../services/projectBackupExport';
import {
  importProjectBackup,
  parseProjectBackupZip,
  previewProjectBackupConflicts
} from '../services/projectBackupImport';
import type {
  ProjectBackupConflictSummary,
  ProjectBackupImportMode,
  ProjectSnapshotImportPreview
} from '../services/projectBackupImport';
import type {ProjectSnapshot} from '../services/projectSnapshotService';
import {
  buildProjectSnapshot,
  diffSnapshotCounts,
  validateSnapshotCounts
} from '../services/projectSnapshotService';

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
    for (const project of all) {
      if (!project.rulesetId) continue;
      const ruleset = await getRulesetByProjectId(project.id);
      if (ruleset) {
        rulesetMap.set(project.id, ruleset);
      }
    }
    setProjectRulesets(rulesetMap);
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
      <details
        style={{
          marginBottom: '1rem',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          backgroundColor: '#f9fafb',
          padding: '0.75rem 0.9rem'
        }}
      >
        <summary style={{cursor: 'pointer', fontWeight: 600}}>
          Projects Wizard Help
        </summary>
        <div style={{marginTop: '0.6rem', fontSize: '0.9rem', color: '#374151'}}>
          <p style={{margin: '0 0 0.4rem 0'}}>
            Step 1: create or open a project.
          </p>
          <p style={{margin: '0 0 0.4rem 0'}}>
            Step 2: optionally set parent project inheritance and sync behavior.
          </p>
          <p style={{margin: 0}}>
            Step 3: create or edit a ruleset, then continue to World Bible and Workspace.
          </p>
        </div>
      </details>

      <div style={{marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
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

      {importPreview && importSnapshot && (
        <section
          style={{
            marginBottom: '1rem',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            backgroundColor: '#f8fafc',
            padding: '0.9rem'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}
          >
            <h2 style={{margin: 0}}>Backup Import Preview</h2>
            <div style={{display: 'flex', gap: '0.5rem'}}>
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

          <p style={{margin: '0.5rem 0', fontSize: '0.85rem', color: '#374151'}}>
            Source: <strong>{importPreview.sourceProjectName}</strong> ({importPreview.sourceProjectId}) ·
            Snapshot: {new Date(importPreview.generatedAt).toLocaleString()}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.6rem',
              marginBottom: '0.75rem'
            }}
          >
            <label>
              Import Mode
              <select
                value={importMode}
                onChange={(e) =>
                  void handleImportModeChange(e.target.value as ProjectBackupImportMode)
                }
                style={{width: '100%'}}
                disabled={isApplyingImport}
              >
                <option value='new'>Create New Project</option>
                <option value='merge'>Merge Into Existing Project</option>
              </select>
            </label>
            {importMode === 'merge' && (
              <label>
                Target Project
                <select
                  value={importTargetProjectId}
                  onChange={(e) =>
                    void handleImportTargetProjectChange(e.target.value)
                  }
                  style={{width: '100%'}}
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

          <div style={{fontSize: '0.82rem', color: '#4b5563', marginBottom: '0.75rem'}}>
            Counts: {importPreview.counts.categories} categories · {importPreview.counts.entities}{' '}
            entities · {importPreview.counts.writingDocuments} scenes ·{' '}
            {importPreview.counts.characters} characters · {importPreview.counts.characterSheets}{' '}
            sheets
          </div>

          {importMode === 'merge' && importConflicts && (
            <div
              style={{
                fontSize: '0.82rem',
                color: '#6b7280',
                borderTop: '1px solid #e5e7eb',
                paddingTop: '0.6rem'
              }}
            >
              Merge conflict preview: {importConflicts.sameNameCategoryCount} category name match(es),{' '}
              {importConflicts.sameNameEntityCount} entity name match(es),{' '}
              {importConflicts.sameNameDocumentCount} scene title match(es), settings exists:{' '}
              {importConflicts.hasTargetSettings ? 'yes' : 'no'}, ruleset exists:{' '}
              {importConflicts.hasTargetRuleset ? 'yes' : 'no'}.
            </div>
          )}
        </section>
      )}

      <form
        onSubmit={handleSubmit}
        style={{maxWidth: 400, marginBottom: '1rem'}}
      >
        <p style={{marginTop: 0, marginBottom: '0.75rem', fontSize: '0.82rem', color: '#4b5563'}}>
          Step 1 of 3: create a project shell.
        </p>
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
      <p style={{marginTop: 0, marginBottom: '0.75rem', fontSize: '0.82rem', color: '#4b5563'}}>
        Steps 2-3 of 3: configure inheritance, then open or author ruleset.
      </p>
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

                <button
                  type='button'
                  onClick={() => void handleExportProjectBackup(project)}
                  disabled={exportingProjectId === project.id}
                  style={{background: '#ecfeff', color: '#0f766e'}}
                >
                  {exportingProjectId === project.id
                    ? 'Exporting...'
                    : 'Export Backup (.zip)'}
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
