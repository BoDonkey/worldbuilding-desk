import {useCallback, useState} from 'react';
import type {Project} from '../entityTypes';
import {exportProjectBackupZip, isProtectedProject, recordProjectBackup} from '../services/storage';
import {describeError} from '../services/errors';
import type {useBackupPassphraseFlow} from './useBackupPassphraseFlow';

type ChooseExport = ReturnType<typeof useBackupPassphraseFlow>['chooseExport'];

/**
 * **Export Backup** for one project: asks plain or encrypted through the
 * existing passphrase dialog, downloads the file, and records the backup time
 * on the project (4.93). Shared by the Projects page and the backup reminder.
 */
export function useProjectBackupExport(params: {
  chooseExport: ChooseExport;
  onMessage: (message: {tone: 'success' | 'error'; message: string}) => void;
  /** Called with the project as saved after a successful backup. */
  onBackedUp?: (project: Project) => void;
}) {
  const {chooseExport, onMessage, onBackedUp} = params;
  const [exportingProjectId, setExportingProjectId] = useState<string | null>(null);

  const exportBackup = useCallback(
    async (project: Pick<Project, 'id' | 'name'>): Promise<boolean> => {
      const choice = await chooseExport(project.name, {projectProtected: isProtectedProject(project.id)});
      if (!choice) return false;
      setExportingProjectId(project.id);
      try {
        const result = await exportProjectBackupZip({
          projectId: project.id,
          projectName: project.name,
          passphrase: choice.passphrase
        });
        const updated = await recordProjectBackup(project.id, result.backedUpAt);
        if (updated) onBackedUp?.(updated);
        onMessage({
          tone: 'success',
          message: result.encrypted
            ? `Encrypted backup exported for "${project.name}". Keep its passphrase somewhere safe; it cannot be recovered.`
            : `Backup exported for "${project.name}".`
        });
        return true;
      } catch (error) {
        onMessage({tone: 'error', message: describeError(error, 'Unable to export project backup.')});
        return false;
      } finally {
        setExportingProjectId(null);
      }
    },
    [chooseExport, onMessage, onBackedUp]
  );

  return {exportBackup, exportingProjectId};
}
