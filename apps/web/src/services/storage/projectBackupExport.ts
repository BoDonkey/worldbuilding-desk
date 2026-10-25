import {buildProjectSnapshot, serializeProjectSnapshot} from './projectSnapshotService';
import {buildSingleFileZip} from '../../utils/zip';
import {encryptBackup, ENCRYPTED_BACKUP_EXTENSION} from './backupEncryption';

function sanitizeFileNamePart(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'project';
}

function downloadBlob(fileName: string, data: Uint8Array, type: string): void {
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(data);
  const blob = new Blob([bytes], {type});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a project backup: a zip, or with a passphrase an encrypted
 * `.sagabackup` file that holds the same zip (slice 5.14).
 */
export async function exportProjectBackupZip(params: {
  projectId: string;
  projectName: string;
  passphrase?: string;
}): Promise<{fileName: string; encrypted: boolean}> {
  const snapshot = await buildProjectSnapshot(params.projectId);
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
    downloadBlob(fileName, encrypted, 'application/octet-stream');
    return {fileName, encrypted: true};
  }
  const fileName = `${baseName}.zip`;
  downloadBlob(fileName, zipBytes, 'application/zip');
  return {fileName, encrypted: false};
}
