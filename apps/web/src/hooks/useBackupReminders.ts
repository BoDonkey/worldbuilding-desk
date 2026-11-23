import {useCallback, useEffect, useState} from 'react';
import type {Project} from '../entityTypes';
import {
  isBackupReminderTimeDue,
  readBackupReminderDays,
  readBackupReminderSnooze,
  snoozeBackupReminder
} from '../services/backup/backupReminder';
import {requestPersistentStorageOnce, STORAGE_MAY_BE_CLEARED_NOTE} from '../services/backup/storagePersistence';
import {FOLDER_MISSING_NOTE} from '../services/backup/scheduledBackups';
import {useScheduledBackupState} from './useScheduledBackups';

/**
 * Backup reminder state for a page (4.93): the author's threshold, per-project
 * snoozes, and why a backup may not be happening on its own: in the web build,
 * the browser refused to keep data; in the desktop app, automatic backups
 * (4.94) are paused because their folder is missing.
 * Time is read when the page opens; a page left open does not start nagging.
 */
export function useBackupReminders() {
  const [now] = useState(() => Date.now());
  const [thresholdDays] = useState(readBackupReminderDays);
  const [snoozedUntil, setSnoozedUntil] = useState<Record<string, number>>({});
  const [storageNote, setStorageNote] = useState<string | null>(null);
  const scheduled = useScheduledBackupState();
  const pausedNote =
    scheduled?.folder && scheduled.schedule !== 'off' && !scheduled.folderAvailable
      ? `${FOLDER_MISSING_NOTE} (${scheduled.folder})`
      : null;

  useEffect(() => {
    let live = true;
    void requestPersistentStorageOnce().then((result) => {
      if (live && result === 'refused') setStorageNote(STORAGE_MAY_BE_CLEARED_NOTE);
    });
    return () => {
      live = false;
    };
  }, []);

  const isTimeDue = useCallback(
    (project: Pick<Project, 'id' | 'createdAt' | 'lastBackupAt'>) =>
      isBackupReminderTimeDue({
        project,
        thresholdDays,
        snoozedUntil: snoozedUntil[project.id] ?? readBackupReminderSnooze(project.id),
        now
      }),
    [thresholdDays, snoozedUntil, now]
  );

  const snooze = useCallback((projectId: string) => {
    const until = snoozeBackupReminder(projectId);
    setSnoozedUntil((previous) => ({...previous, [projectId]: until}));
  }, []);

  return {now, isTimeDue, snooze, storageNote: storageNote ?? pausedNote};
}
