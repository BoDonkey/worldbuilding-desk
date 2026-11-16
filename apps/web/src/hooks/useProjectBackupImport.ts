import {useRef, useState} from 'react';
import type {ChangeEvent} from 'react';
import type {Project} from '../entityTypes';
import {
  getProjectById,
  importProjectBackup,
  parseProjectBackupZip,
  previewProjectBackupConflicts,
  findProjectBackupCollisions,
  describeProjectBackupCopy,
  buildProjectSnapshot,
  diffSnapshotCounts,
  validateSnapshotCounts,
  type ProjectBackupConflictSummary,
  type ProjectBackupImportMode,
  type ProjectSnapshotImportPreview,
  type ProjectSnapshot
} from '../services/storage';
import {describeError} from '../services/errors';
import type {useBackupPassphraseFlow} from './useBackupPassphraseFlow';

type Feedback = {tone: 'success' | 'error'; message: string};

/**
 * Importing and validating a project backup from the Projects page (3.48;
 * moved out of ProjectsRoute unchanged): reading the file, the preview, the
 * new-or-merge choice with its collision and conflict notices, applying the
 * import with a count check, and checking a backup without importing it.
 */
export function useProjectBackupImport({
  projects,
  activeProject,
  openBackup,
  loadProjects,
  onSelectProject,
  setFeedback
}: {
  projects: Project[];
  activeProject: Project | null;
  openBackup: ReturnType<typeof useBackupPassphraseFlow>['openBackup'];
  loadProjects: () => Promise<void>;
  onSelectProject: (project: Project) => void;
  setFeedback: (feedback: Feedback | null) => void;
}) {
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [importPreview, setImportPreview] = useState<ProjectSnapshotImportPreview | null>(null);
  const [importSnapshot, setImportSnapshot] = useState<ProjectSnapshot | null>(null);
  const [importMode, setImportMode] = useState<ProjectBackupImportMode>('new');
  const [importTargetProjectId, setImportTargetProjectId] = useState('');
  const [importCopyNotice, setImportCopyNotice] = useState<string | null>(null);
  const [importConflicts, setImportConflicts] =
    useState<ProjectBackupConflictSummary | null>(null);
  const [isValidatingBackup, setIsValidatingBackup] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const validateFileInputRef = useRef<HTMLInputElement | null>(null);

  const openHiddenFileInput = (
    input: HTMLInputElement | null,
    failureMessage: string
  ) => {
    if (!input) {
      setFeedback({tone: 'error', message: failureMessage});
      return;
    }

    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
      input.click();
    } catch (error) {
      const message =
        describeError(error, failureMessage);
      setFeedback({tone: 'error', message});
    }
  };

  const clearImportState = () => {
    setImportPreview(null);
    setImportSnapshot(null);
    setImportMode('new');
    setImportTargetProjectId('');
    setImportConflicts(null);
    setImportCopyNotice(null);
  };

  // 3.24b: say when an import copies records that another project also has.
  const collisionCheckRef = useRef(0);
  const refreshImportCollisions = async (
    snapshot: ProjectSnapshot,
    mode: ProjectBackupImportMode,
    targetProjectId: string
  ) => {
    const check = ++collisionCheckRef.current;
    setImportCopyNotice(null);
    if (mode === 'merge' && !targetProjectId) return;
    try {
      const report = await findProjectBackupCollisions({
        snapshot,
        targetProjectId: mode === 'new' ? null : targetProjectId
      });
      if (check !== collisionCheckRef.current || report.recordCount === 0) return;
      setImportCopyNotice(describeProjectBackupCopy(report, mode));
    } catch {
      // The notice is informational; import runs its own checks.
    }
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
    openHiddenFileInput(
      importFileInputRef.current,
      'Could not open the backup import file picker.'
    );
  };

  const handleSelectValidateFile = () => {
    openHiddenFileInput(
      validateFileInputRef.current,
      'Could not open the backup validation file picker.'
    );
  };

  const handleBackupFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsingImport(true);
    setFeedback(null);
    try {
      const parsed = await openBackup(file.name, (passphrase) => parseProjectBackupZip(file, passphrase));
      if (!parsed) return;
      setImportSnapshot(parsed.snapshot);
      setImportPreview(parsed.preview);
      setImportMode('new');
      setImportConflicts(null);
      const defaultTarget = activeProject?.id ?? projects[0]?.id ?? '';
      setImportTargetProjectId(defaultTarget);
      void refreshImportCollisions(parsed.snapshot, 'new', defaultTarget);
      setFeedback({
        tone: 'success',
        message: `Loaded backup preview for "${parsed.preview.sourceProjectName}".`
      });
    } catch (error) {
      clearImportState();
      const message =
        describeError(error, 'Unable to parse backup zip.');
      setFeedback({tone: 'error', message});
    } finally {
      setIsParsingImport(false);
      event.target.value = '';
    }
  };

  const handleImportModeChange = async (mode: ProjectBackupImportMode) => {
    setImportMode(mode);
    if (importSnapshot) void refreshImportCollisions(importSnapshot, mode, importTargetProjectId);
    if (mode !== 'merge' || !importSnapshot) {
      setImportConflicts(null);
      return;
    }
    await refreshImportConflicts(importSnapshot, importTargetProjectId);
  };

  const handleImportTargetProjectChange = async (projectId: string) => {
    setImportTargetProjectId(projectId);
    if (importSnapshot) void refreshImportCollisions(importSnapshot, importMode, projectId);
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
        describeError(error, 'Unable to import backup.');
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
      const parsed = await openBackup(file.name, (passphrase) => parseProjectBackupZip(file, passphrase));
      if (!parsed) return;
      const result = validateSnapshotCounts(parsed.snapshot);
      setFeedback({
        tone: result.ok ? 'success' : 'error',
        message: result.ok
          ? `Backup "${file.name}" passed integrity checks.`
          : `Backup "${file.name}" has count mismatches: ${result.mismatches.join(' | ')}`
      });
    } catch (error) {
      const message =
        describeError(error, 'Unable to validate backup zip.');
      setFeedback({tone: 'error', message});
    } finally {
      setIsValidatingBackup(false);
      event.target.value = '';
    }
  };

  return {
    isParsingImport,
    isApplyingImport,
    isValidatingBackup,
    importPreview,
    importSnapshot,
    importMode,
    importTargetProjectId,
    importCopyNotice,
    importConflicts,
    importFileInputRef,
    validateFileInputRef,
    clearImportState,
    handleSelectBackupFile,
    handleSelectValidateFile,
    handleBackupFileChange,
    handleImportModeChange,
    handleImportTargetProjectChange,
    handleApplyBackupImport,
    handleValidateBackupFile
  };
}
