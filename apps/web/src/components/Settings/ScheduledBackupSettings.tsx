import {useId, useState} from 'react';
import {runScheduledBackupsNow, useScheduledBackupState} from '../../hooks/useScheduledBackups';
import {describeBackupRun, FOLDER_MISSING_NOTE, getBackupsApi} from '../../services/backup/scheduledBackups';
import {describeError} from '../../services/errors';
import {InlineAlert} from '../common';

const KEEP_OPTIONS = [3, 5, 10, 20, 50] as const;

const SCHEDULE_LABELS: Record<ElectronBackupSchedule, string> = {
  off: 'Off',
  daily: 'Once a day',
  'on-close': 'When SagaSpine closes'
};

/**
 * Settings → Backups, desktop only (4.94): a folder (one synced by iCloud
 * Drive, Dropbox, or OneDrive keeps a copy off this computer), a schedule,
 * and how many copies to keep per project. Shows the last run's result.
 */
export function ScheduledBackupSettings() {
  const snapshot = useScheduledBackupState();
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const scheduleId = useId();
  const keepId = useId();
  const hintId = useId();
  const api = getBackupsApi();
  if (!api || !snapshot) return null;

  const act = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(describeError(caught, 'The backup setting could not be saved.'));
    }
  };
  const keepOptions = KEEP_OPTIONS.includes(snapshot.keep as (typeof KEEP_OPTIONS)[number])
    ? KEEP_OPTIONS
    : [...KEEP_OPTIONS, snapshot.keep].sort((a, b) => a - b);

  return (
    <div>
      <h3>Automatic backups</h3>
      <p id={hintId}>
        SagaSpine can save a backup of each project that changed into a folder you choose. Pick one that iCloud Drive,
        Dropbox, or OneDrive syncs to keep a copy off this computer. Projects protected with a passphrase are skipped,
        because the passphrase is never stored; back those up with <strong>Export Backup</strong>.
      </p>
      <p>
        Folder: <strong data-testid='backup-folder'>{snapshot.folder ?? 'none chosen'}</strong>{' '}
        <button
          type='button'
          onClick={() =>
            void act(async () => {
              const result = await api.chooseFolder();
              if (result.error) setError(result.error);
            })
          }
        >
          {snapshot.folder ? 'Change folder…' : 'Choose folder…'}
        </button>
      </p>
      {snapshot.folder && !snapshot.folderAvailable ? <InlineAlert variant='error' message={FOLDER_MISSING_NOTE} /> : null}
      <p>
        <label htmlFor={scheduleId}>Back up</label>{' '}
        <select
          id={scheduleId}
          aria-describedby={hintId}
          value={snapshot.schedule}
          disabled={!snapshot.folder}
          onChange={(event) =>
            void act(() => api.setPreferences({schedule: event.target.value as ElectronBackupSchedule}))
          }
        >
          {(Object.keys(SCHEDULE_LABELS) as ElectronBackupSchedule[]).map((schedule) => (
            <option key={schedule} value={schedule}>
              {SCHEDULE_LABELS[schedule]}
            </option>
          ))}
        </select>{' '}
        <label htmlFor={keepId}>Copies to keep per project</label>{' '}
        <select
          id={keepId}
          value={String(snapshot.keep)}
          disabled={!snapshot.folder}
          onChange={(event) => void act(() => api.setPreferences({keep: Number(event.target.value)}))}
        >
          {keepOptions.map((keep) => (
            <option key={keep} value={String(keep)}>
              {keep}
            </option>
          ))}
        </select>
      </p>
      <p>
        <button
          type='button'
          disabled={!snapshot.folder || running}
          onClick={() => {
            setRunning(true);
            void act(() => runScheduledBackupsNow()).finally(() => setRunning(false));
          }}
        >
          {running ? 'Backing up…' : 'Back up changed projects now'}
        </button>
      </p>
      <p role='status' data-testid='backup-last-run'>
        {describeBackupRun(snapshot.lastRun, Date.now())}
      </p>
      {snapshot.lastRun?.written.length ? (
        <ul>
          {snapshot.lastRun.written.map((item) => (
            <li key={item.fileName ?? item.projectName}>
              {item.projectName}: {item.fileName}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <InlineAlert variant='error' message={error} onDismiss={() => setError(null)} /> : null}
    </div>
  );
}
