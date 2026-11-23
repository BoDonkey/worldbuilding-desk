import {buildProjectSnapshot, serializeProjectSnapshot, type ProjectSnapshot} from './projectSnapshotService';
import {buildSingleFileZip} from '../../utils/zip';
import {encryptBackup, ENCRYPTED_BACKUP_EXTENSION} from './backupEncryption';
import {sanitizeFileNamePart, triggerBytesDownload} from '../../utils/downloadJson';

/**
 * The backup file's contents for one project: the snapshot (marked as backed
 * up at the moment it was made, so a project restored from it shows that
 * time, 4.93) and the zip that holds it. Shared by Export Backup and the
 * scheduled backups (4.94).
 */
export async function buildProjectBackup(projectId: string): Promise<{snapshot: ProjectSnapshot; zipBytes: Uint8Array}> {
  const built = await buildProjectSnapshot(projectId);
  const snapshot = {...built, project: {...built.project, lastBackupAt: built.generatedAt}};
  const snapshotBytes = new TextEncoder().encode(serializeProjectSnapshot(snapshot));
  const zipBytes = buildSingleFileZip({
    fileName: 'project-snapshot.json',
    fileData: snapshotBytes
  });
  return {snapshot, zipBytes};
}

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
  const {snapshot, zipBytes} = await buildProjectBackup(params.projectId);
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
