import type {Project} from '../../entityTypes';
import {describeBackupReminder} from '../../services/backup/backupReminder';
import styles from './BackupReminder.module.css';

export interface BackupReminderProps {
  project: Pick<Project, 'id' | 'name' | 'lastBackupAt'>;
  now: number;
  /** Shown when the browser has not agreed to keep SagaSpine data. */
  storageNote?: string | null;
  busy?: boolean;
  onBackUp: () => void;
  onSnooze: () => void;
}

/**
 * The quiet backup reminder (4.93) on Projects and at the top of the
 * Workspace. Never modal: it sits in the page and writing goes on around it.
 */
export function BackupReminder({project, now, storageNote, busy, onBackUp, onSnooze}: BackupReminderProps) {
  return (
    <section className={styles.reminder} aria-label={`Backup reminder for ${project.name}`} data-testid='backup-reminder'>
      <div className={styles.message}>
        <span>{describeBackupReminder(project, now)}</span>
        {storageNote ? <span className={styles.note}>{storageNote}</span> : null}
      </div>
      <div className={styles.actions}>
        <button type='button' onClick={onBackUp} disabled={busy}>
          {busy ? 'Exporting...' : 'Back up now'}
        </button>
        <button type='button' className={styles.laterButton} onClick={onSnooze} disabled={busy}>
          Remind me later
        </button>
      </div>
    </section>
  );
}
