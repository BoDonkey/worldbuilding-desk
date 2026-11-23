import {buildProjectSnapshot, serializeProjectSnapshot} from './projectSnapshotService';
import {buildSingleFileZip} from '../../utils/zip';
import {encryptBackup, ENCRYPTED_BACKUP_EXTENSION} from './backupEncryption';
import {sanitizeFileNamePart, triggerBytesDownload} from '../../utils/downloadJson';

/**
 * Downloads a project backup: a zip, or with a passphrase an encrypted
 * `.sagabackup` file that holds the same zip (slice 5.14). The caller records
 * `backedUpAt` with `recordProjectBackup` once the download has started.
 */
export async function exportProjectBackupZip(params: {
  projectId: string;
  projectName: string;
  passphrase?: string;
}): Promise<{fileName: string; encrypted: boolean; backedUpAt: number}> {
  const built = await buildProjectSnapshot(params.projectId);
  // The file is the backup made at this moment, so a project restored from it
  // was last backed up then (4.93).
  const snapshot = {...built, project: {...built.project, lastBackupAt: built.generatedAt}};
  const snapshotJson = serializeProjectSnapshot(snapshot);
  const snapshotBytes = new TextEncoder().encode(snapshotJson);
  const zipBytes = buildSingleFileZip({
    fileName: 'project-snapshot.json',
    fileData: snapshotBytes
  });
  const stamp = new Date(snapshot.generatedAt).toISOString().slice(0, 10);
  const baseName = `${sanitizeFileNamePart(params.projectName)}-backup-${stamp}`;
  if (params.passphrase) {
    const encrypted = await encryptBackup(zipBytes, params.passphrase);
    const fileName = `${baseName}${ENCRYPTED_BACKUP_EXTENSION}`;
    triggerBytesDownload(fileName, encrypted, 'application/octet-stream');
    return {fileName, encrypted: true, backedUpAt: snapshot.generatedAt};
  }
  const fileName = `${baseName}.zip`;
  triggerBytesDownload(fileName, zipBytes, 'application/zip');
  return {fileName, encrypted: false, backedUpAt: snapshot.generatedAt};
}
