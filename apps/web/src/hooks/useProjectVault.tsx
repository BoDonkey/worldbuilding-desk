import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {Project} from '../entityTypes';
import {
  ChangeProjectPassphraseDialog,
  ProjectPassphraseDialog,
  ProtectProjectDialog
} from '../components/Projects/ProjectVaultDialogs';
import {
  changeProjectVaultPassphrase,
  disableProjectVault,
  enableProjectVault,
  getProjectById,
  getProjectVaultState,
  lockProjectVault,
  subscribeVaultChanges,
  unlockProjectVault,
  type VaultState
} from '../services/storage';
import {describeError} from '../services/errors';

type DialogKind = 'protect' | 'unlock' | 'remove' | 'change';

interface DialogRequest {
  kind: DialogKind;
  project: Project;
  busy: boolean;
  error: string | null;
  done?: (unlocked: boolean) => void;
}

export interface ProjectVaultMessage {
  tone: 'success' | 'error';
  message: string;
}

/**
 * Passphrase protection on the Projects page (slice 5.15b). Tracks which
 * projects are protected and locked, and runs the protect, unlock, change,
 * and remove dialogs. Render `vaultDialogs` once.
 */
export function useProjectVault(options: {
  projectIds: readonly string[];
  onMessage: (message: ProjectVaultMessage) => void;
  /** Protection was turned on or off: the page should re-read its projects. */
  onProjectsChanged: () => void;
}) {
  const {projectIds, onMessage, onProjectsChanged} = options;
  const [states, setStates] = useState<Record<string, VaultState | null>>({});
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const dialogRef = useRef<DialogRequest | null>(null);
  useEffect(() => {
    dialogRef.current = dialog;
  }, [dialog]);
  const idsKey = projectIds.join('|');

  const refresh = useCallback(async (ids: readonly string[]) => {
    const entries = await Promise.all(ids.map(async (id) => [id, await getProjectVaultState(id)] as const));
    setStates((current) => ({...current, ...Object.fromEntries(entries)}));
  }, []);

  useEffect(() => {
    void refresh(idsKey ? idsKey.split('|') : []);
  }, [idsKey, refresh]);

  useEffect(() => subscribeVaultChanges((projectId) => void refresh([projectId])), [refresh]);

  const vaultStateOf = useCallback((projectId: string): VaultState | null => states[projectId] ?? null, [states]);

  const open = (kind: DialogKind, project: Project, done?: (unlocked: boolean) => void) =>
    setDialog({kind, project, busy: false, error: null, done});
  const update = (changes: Partial<DialogRequest>) =>
    setDialog((current) => (current ? {...current, ...changes} : current));
  const close = (unlocked = false) => {
    const current = dialogRef.current;
    dialogRef.current = null;
    setDialog(null);
    current?.done?.(unlocked);
  };

  const run = async (work: () => Promise<void>, success: string | null, fallback: string, unlocked = false) => {
    update({busy: true, error: null});
    try {
      await work();
      close(unlocked);
      if (success) onMessage({tone: 'success', message: success});
    } catch (error) {
      update({busy: false, error: describeError(error, fallback)});
    }
  };

  /** Resolves true once the project is unlocked, false if the author cancels. */
  const requestUnlock = useCallback(
    (project: Project) => new Promise<boolean>((resolve) => open('unlock', project, resolve)),
    []
  );

  /** Asks for the passphrase, then opens the unlocked project with `open`. */
  const unlockAndOpen = useCallback(
    async (project: Project, open: (unlocked: Project) => void) => {
      if (!(await requestUnlock(project))) return;
      const unlocked = await getProjectById(project.id);
      if (unlocked) open(unlocked);
    },
    [requestUnlock]
  );

  const lockProject = useCallback((projectId: string) => {
    lockProjectVault(projectId);
    // Reloading clears everything this session showed or cached from the project.
    window.location.reload();
  }, []);

  const vaultDialogs = useMemo(() => {
    if (!dialog) return null;
    const {project} = dialog;
    switch (dialog.kind) {
      case 'protect':
        return (
          <ProtectProjectDialog
            projectName={project.name}
            busy={dialog.busy}
            error={dialog.error}
            onCancel={() => close()}
            onProtect={(passphrase, label) =>
              void run(
                async () => {
                  await enableProjectVault(project.id, passphrase, {label});
                  onProjectsChanged();
                },
                `"${project.name}" is now protected. It locks when the app restarts or another project opens.`,
                'Unable to protect this project. Nothing was changed.'
              )
            }
          />
        );
      case 'unlock':
        return (
          <ProjectPassphraseDialog
            titleId='unlock-project-title'
            title='Unlock project'
            message={`“${project.name}” is protected. Enter its passphrase to open it.`}
            submitLabel='Unlock'
            busyLabel='Unlocking…'
            busy={dialog.busy}
            error={dialog.error}
            onCancel={() => close(false)}
            onSubmit={(passphrase) =>
              void run(
                async () => {
                  await unlockProjectVault(project.id, passphrase);
                  onProjectsChanged();
                },
                null,
                'Unable to unlock this project.',
                true
              )
            }
          />
        );
      case 'remove':
        return (
          <ProjectPassphraseDialog
            titleId='remove-protection-title'
            title={`Remove protection from “${project.name}”`}
            message='The project will be saved on this computer without encryption, and anyone using it can open the project. Enter the passphrase to confirm.'
            submitLabel='Remove Protection'
            busyLabel='Removing…'
            busy={dialog.busy}
            error={dialog.error}
            onCancel={() => close()}
            onSubmit={(passphrase) =>
              void run(
                async () => {
                  await disableProjectVault(project.id, passphrase);
                  onProjectsChanged();
                },
                `"${project.name}" is no longer protected.`,
                'Unable to remove protection. The project is still protected.'
              )
            }
          />
        );
      case 'change':
        return (
          <ChangeProjectPassphraseDialog
            projectName={project.name}
            busy={dialog.busy}
            error={dialog.error}
            onCancel={() => close()}
            onChange={(current, next) =>
              void run(
                () => changeProjectVaultPassphrase(project.id, current, next),
                `The passphrase for "${project.name}" was changed.`,
                'Unable to change the passphrase. The old one still works.'
              )
            }
          />
        );
    }
    // run/close/update only touch state setters and stable callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, onMessage, onProjectsChanged]);

  return {
    vaultStateOf,
    requestProtect: (project: Project) => open('protect', project),
    requestUnlock,
    unlockAndOpen,
    requestRemoveProtection: (project: Project) => open('remove', project),
    requestChangePassphrase: (project: Project) => open('change', project),
    lockProject,
    vaultDialogs
  };
}
