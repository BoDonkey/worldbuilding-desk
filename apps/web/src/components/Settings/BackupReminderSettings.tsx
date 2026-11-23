import {useId, useState} from 'react';
import {
  BACKUP_REMINDER_DAY_OPTIONS,
  readBackupReminderDays,
  writeBackupReminderDays
} from '../../services/backup/backupReminder';

/**
 * Settings → Backups (4.93): how long after the last backup the reminder
 * appears, or no reminders. Applies to every project on this computer.
 */
export function BackupReminderSettings() {
  const [days, setDays] = useState(readBackupReminderDays);
  const selectId = useId();
  const hintId = useId();
  return (
    <div>
      <label htmlFor={selectId}>Remind me to back up</label>{' '}
      <select
        id={selectId}
        aria-describedby={hintId}
        value={days === null ? 'off' : String(days)}
        onChange={(event) => {
          const next = event.target.value === 'off' ? null : Number(event.target.value);
          writeBackupReminderDays(next);
          setDays(next);
        }}
      >
        {BACKUP_REMINDER_DAY_OPTIONS.map((option) => (
          <option key={option} value={String(option)}>
            {option} days after the last backup
          </option>
        ))}
        <option value='off'>Never (reminders off)</option>
      </select>
      <p id={hintId}>
        Projects are saved on this computer only. <strong>Export Backup</strong> on the Projects page makes a copy you
        can keep somewhere else. The reminder appears on Projects and in the Workspace once a project has writing or
        world records in it, and never blocks writing. This choice applies to every project on this computer.
      </p>
    </div>
  );
}
