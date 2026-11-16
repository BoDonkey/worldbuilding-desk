import type {Project} from '../../entityTypes';
import type {ProjectBackupImportMode} from '../../services/storage';
import type {useProjectBackupImport} from '../../hooks/useProjectBackupImport';
import styles from '../../styles/ProjectsRoute.module.css';

/** The Projects page backup tools and import preview (3.48; moved out of ProjectsRoute). */
export function ProjectBackupImportPanel({
  projects,
  backupImport
}: {
  projects: Project[];
  backupImport: ReturnType<typeof useProjectBackupImport>;
}) {
  const {
    isParsingImport, isApplyingImport, isValidatingBackup, importPreview, importSnapshot,
    importMode, importTargetProjectId, importCopyNotice, importConflicts,
    importFileInputRef, validateFileInputRef, clearImportState, handleSelectBackupFile,
    handleSelectValidateFile, handleBackupFileChange, handleImportModeChange,
    handleImportTargetProjectChange, handleApplyBackupImport, handleValidateBackupFile
  } = backupImport;
  return (
    <>
      <details className={styles.helpPanel}>
        <summary>Backup and import tools</summary>
        <div className={styles.helpBody}>
          <div className={styles.utilityBar}>
            <button
              type='button'
              onClick={handleSelectBackupFile}
              disabled={isParsingImport}
            >
              {isParsingImport ? 'Loading Backup...' : 'Import Backup'}
            </button>
            <input
              ref={importFileInputRef}
              type='file'
              accept='.zip,application/zip,.sagabackup'
              onChange={(e) => void handleBackupFileChange(e)}
              className={styles.hiddenFileInput}
              tabIndex={-1}
              aria-hidden='true'
            />
            <button
              type='button'
              onClick={handleSelectValidateFile}
              disabled={isValidatingBackup}
            >
              {isValidatingBackup ? 'Validating...' : 'Validate Backup'}
            </button>
            <input
              ref={validateFileInputRef}
              type='file'
              accept='.zip,application/zip,.sagabackup'
              onChange={(e) => void handleValidateBackupFile(e)}
              className={styles.hiddenFileInput}
              tabIndex={-1}
              aria-hidden='true'
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

          {importCopyNotice && (
            <p role='note' className={styles.conflictPreview}>{importCopyNotice}</p>
          )}

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
    </>
  );
}
