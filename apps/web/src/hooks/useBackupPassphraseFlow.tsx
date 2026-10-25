import {useCallback, useMemo, useState} from 'react';
import {ExportBackupDialog, UnlockBackupDialog} from '../components/Projects/BackupPassphraseDialog';
import {BackupPassphraseError, BackupPassphraseRequiredError} from '../services/storage';

interface ExportRequest {
  projectName: string;
  projectProtected: boolean;
  resolve: (choice: {passphrase?: string} | null) => void;
}

interface UnlockRequest {
  fileName: string;
  busy: boolean;
  error: string | null;
  attempt: (passphrase: string) => void;
  cancel: () => void;
}

/**
 * The passphrase steps of backup export and import (slice 5.14), as promises
 * the Projects page awaits. Render `backupDialogs` once.
 *
 * - `chooseExport` resolves with the author's choice (a passphrase, or none
 *   for a plain zip), or null when they cancel.
 * - `openBackup` runs `read` on the file; when it turns out to be encrypted it
 *   asks for the passphrase and tries again, keeping the dialog open after a
 *   wrong one. It resolves with the result, or null when the author cancels.
 *   Nothing is read from an encrypted file before its passphrase opens it.
 */
export function useBackupPassphraseFlow() {
  const [exportRequest, setExportRequest] = useState<ExportRequest | null>(null);
  const [unlockRequest, setUnlockRequest] = useState<UnlockRequest | null>(null);

  const chooseExport = useCallback(
    (projectName: string, options: {projectProtected?: boolean} = {}) =>
      new Promise<{passphrase?: string} | null>((resolve) => {
        setExportRequest({projectName, projectProtected: Boolean(options.projectProtected), resolve});
      }),
    []
  );

  const openBackup = useCallback(
    async <T,>(fileName: string, read: (passphrase?: string) => Promise<T>): Promise<T | null> => {
      try {
        return await read();
      } catch (error) {
        if (!(error instanceof BackupPassphraseRequiredError)) throw error;
      }
      return new Promise<T | null>((resolve, reject) => {
        const update = (changes: Partial<UnlockRequest>) =>
          setUnlockRequest((current) => (current ? {...current, ...changes} : current));
        setUnlockRequest({
          fileName,
          busy: false,
          error: null,
          cancel: () => {
            setUnlockRequest(null);
            resolve(null);
          },
          attempt: (passphrase) => {
            update({busy: true, error: null});
            read(passphrase).then(
              (result) => {
                setUnlockRequest(null);
                resolve(result);
              },
              (error: unknown) => {
                if (error instanceof BackupPassphraseError) {
                  update({busy: false, error: error.message});
                  return;
                }
                setUnlockRequest(null);
                reject(error);
              }
            );
          }
        });
      });
    },
    []
  );

  const backupDialogs = useMemo(
    () => (
      <>
        {exportRequest && (
          <ExportBackupDialog
            projectName={exportRequest.projectName}
            projectProtected={exportRequest.projectProtected}
            busy={false}
            onExport={(passphrase) => {
              setExportRequest(null);
              exportRequest.resolve(passphrase ? {passphrase} : {});
            }}
            onCancel={() => {
              setExportRequest(null);
              exportRequest.resolve(null);
            }}
          />
        )}
        {unlockRequest && (
          <UnlockBackupDialog
            fileName={unlockRequest.fileName}
            busy={unlockRequest.busy}
            error={unlockRequest.error}
            onUnlock={unlockRequest.attempt}
            onCancel={unlockRequest.cancel}
          />
        )}
      </>
    ),
    [exportRequest, unlockRequest]
  );

  return {chooseExport, openBackup, backupDialogs};
}
