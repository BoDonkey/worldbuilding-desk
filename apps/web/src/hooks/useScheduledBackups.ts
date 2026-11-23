import {useEffect, useState} from 'react';
import {
  buildProjectBackup,
  getAllProjects,
  isProtectedProject,
  recordProjectBackup
} from '../services/storage';
import {getBackupsApi, isDailyBackupDue, runScheduledBackups} from '../services/backup/scheduledBackups';
import {pushAppToast} from '../store/notificationStore';

/** First check after start, so a backup never slows opening the app. */
const STARTUP_DELAY_MS = 15_000;
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

let inFlight: Promise<ElectronBackupRunResult | null> | null = null;

/**
 * Runs one automatic backup pass now (4.94), or joins the one already
 * running. Used by the schedule, the on-close run, and **Back up now** in
 * Settings.
 */
export function runScheduledBackupsNow(): Promise<ElectronBackupRunResult | null> {
  const api = getBackupsApi();
  if (!api) return Promise.resolve(null);
  inFlight ??= runScheduledBackups({
    api,
    getAllProjects,
    isProtectedProject,
    buildProjectBackup,
    recordProjectBackup
  }).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** The main process's backup choices and last run, kept current. Null outside the desktop app. */
export function useScheduledBackupState(): ElectronBackupSnapshot | null {
  const [snapshot, setSnapshot] = useState<ElectronBackupSnapshot | null>(null);
  useEffect(() => {
    const api = getBackupsApi();
    if (!api) return;
    let live = true;
    const unsubscribe = api.onChange((next) => {
      if (live) setSnapshot(next);
    });
    api
      .get()
      .then((next) => {
        if (live) setSnapshot(next);
      })
      .catch((error) => console.warn('Unable to read backup settings.', error));
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  return snapshot;
}

/**
 * The schedule itself, mounted once in the app shell. Daily: checks shortly
 * after start, every ten minutes, and when the choices change. On close: the
 * main process holds the window open and asks for a run here.
 */
export function useScheduledBackupRunner(): void {
  useEffect(() => {
    const api = getBackupsApi();
    if (!api) return;
    const check = async () => {
      try {
        if (isDailyBackupDue(await api.get(), Date.now())) await runScheduledBackupsNow();
      } catch (error) {
        console.warn('Automatic backup failed.', error);
      }
    };
    const startTimer = window.setTimeout(() => void check(), STARTUP_DELAY_MS);
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    // A change is the author's own choice in Settings, so it may run at once.
    const stopChange = api.onChange(() => void check());
    const stopClose = api.onRunBeforeClose(() => {
      pushAppToast({tone: 'info', message: 'Backing up your projects before SagaSpine closes…'});
      void runScheduledBackupsNow()
        .catch((error) => console.warn('Backup before closing failed.', error))
        .finally(() => void api.closeRunFinished());
    });
    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(interval);
      stopChange();
      stopClose();
    };
  }, []);
}
