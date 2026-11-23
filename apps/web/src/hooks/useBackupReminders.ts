import {useCallback, useEffect, useState} from 'react';
import type {Project} from '../entityTypes';
import {
  isBackupReminderTimeDue,
  readBackupReminderDays,
  readBackupReminderSnooze,
  snoozeBackupReminder
} from '../services/backup/backupReminder';
import {requestPersistentStorageOnce, STORAGE_MAY_BE_CLEARED_NOTE} from '../services/backup/storagePersistence';

/**
 * Backup reminder state for a page (4.93): the author's threshold, per-project
 * snoozes, and, in the web build, whether the browser agreed to keep data.
 * Time is read when the page opens; a page left open does not start nagging.
 */
export function useBackupReminders() {
  const [now] = useState(() => Date.now());
  const [thresholdDays] = useState(readBackupReminderDays);
  const [snoozedUntil, setSnoozedUntil] = useState<Record<string, number>>({});
  const [storageNote, setStorageNote] = useState<string | null>(null);

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

  return {now, isTimeDue, snooze, storageNote};
}
