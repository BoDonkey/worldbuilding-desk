import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  DAY_MS,
  DEFAULT_BACKUP_REMINDER_DAYS,
  describeBackupReminder,
  describeLastBackup,
  isBackupReminderDue,
  projectHasRealContent,
  readBackupReminderDays,
  readBackupReminderSnooze,
  snoozeBackupReminder,
  writeBackupReminderDays
} from './backupReminder';

const NOW = Date.UTC(2026, 10, 23, 12);
const created = NOW - 30 * DAY_MS;

function due(overrides: Partial<Parameters<typeof isBackupReminderDue>[0]> = {}) {
  return isBackupReminderDue({
    project: {createdAt: created, lastBackupAt: undefined},
    hasContent: true,
    thresholdDays: 7,
    snoozedUntil: null,
    now: NOW,
    ...overrides
  });
}

// Node tests have no localStorage; preferences read it through `window`.
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key)
    }
  });
  return () => vi.unstubAllGlobals();
});

describe('backup reminder threshold', () => {
  it('is due once the last backup is at least the threshold old', () => {
    expect(due({project: {createdAt: created, lastBackupAt: NOW - 7 * DAY_MS}})).toBe(true);
    expect(due({project: {createdAt: created, lastBackupAt: NOW - 7 * DAY_MS + 1}})).toBe(false);
  });

  it('counts from creation for a project never backed up', () => {
    expect(due({project: {createdAt: NOW - 8 * DAY_MS}})).toBe(true);
    expect(due({project: {createdAt: NOW - 2 * DAY_MS}})).toBe(false);
  });

  it('is never due when reminders are off', () => {
    expect(due({thresholdDays: null})).toBe(false);
  });

  it('defaults to 7 days, and remembers a choice or off', () => {
    expect(readBackupReminderDays()).toBe(DEFAULT_BACKUP_REMINDER_DAYS);
    writeBackupReminderDays(14);
    expect(readBackupReminderDays()).toBe(14);
    writeBackupReminderDays(null);
    expect(readBackupReminderDays()).toBeNull();
    window.localStorage.setItem('backupReminderDays', 'garbage');
    expect(readBackupReminderDays()).toBe(DEFAULT_BACKUP_REMINDER_DAYS);
  });
});

describe('backup reminder snooze', () => {
  it('hides the reminder for one day, then lets it return', () => {
    const until = snoozeBackupReminder('p1', NOW);
    expect(until).toBe(NOW + DAY_MS);
    expect(readBackupReminderSnooze('p1')).toBe(until);
    expect(readBackupReminderSnooze('p2')).toBeNull();
    expect(due({snoozedUntil: until})).toBe(false);
    expect(due({snoozedUntil: until, now: until})).toBe(true);
  });
});

describe('backup reminder content check', () => {
  it('skips projects with no real content', () => {
    expect(projectHasRealContent({documents: [], entityCount: 0})).toBe(false);
    expect(projectHasRealContent({documents: [{content: '<p><br></p>'}, {content: '  &nbsp; '}], entityCount: 0})).toBe(false);
    expect(due({hasContent: false})).toBe(false);
  });

  it('counts a scene with words or any world record', () => {
    expect(projectHasRealContent({documents: [{content: '<p>The gate held.</p>'}], entityCount: 0})).toBe(true);
    expect(projectHasRealContent({documents: [], entityCount: 1})).toBe(true);
  });
});

describe('backup reminder wording', () => {
  it('describes the last backup on a project card', () => {
    expect(describeLastBackup(undefined, NOW)).toBe('Never backed up');
    expect(describeLastBackup(NOW - 1000, NOW)).toBe('Last backup: today');
    expect(describeLastBackup(NOW - DAY_MS, NOW)).toBe('Last backup: 1 day ago');
    expect(describeLastBackup(NOW - 9 * DAY_MS - 5, NOW)).toBe('Last backup: 9 days ago');
  });

  it('names the project in the reminder', () => {
    expect(describeBackupReminder({name: 'Ashfall', lastBackupAt: undefined}, NOW)).toMatch(/^"Ashfall" has never been backed up\./);
    expect(describeBackupReminder({name: 'Ashfall', lastBackupAt: NOW - 9 * DAY_MS}, NOW)).toMatch(/last backed up 9 days ago\./);
  });
});
