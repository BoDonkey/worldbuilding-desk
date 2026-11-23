import type {Project, WritingDocument} from '../../entityTypes';
import {readPreference, writePreference} from '../../utils/browserPreferences';

/**
 * Backup reminder rules (slice 4.93). Projects live only in this computer's
 * app data; a backup file is the only copy outside it. These rules decide when
 * to suggest one. The reminder is never modal and never blocks writing.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_BACKUP_REMINDER_DAYS = 7;
export const BACKUP_REMINDER_DAY_OPTIONS = [3, 7, 14, 30] as const;

const REMINDER_DAYS_KEY = 'backupReminderDays';
const REMINDER_OFF = 'off';
/** Per project: `backupReminderSnooze:<projectId>` (removed with the project). */
const SNOOZE_KEY_PREFIX = 'backupReminderSnooze';

/** Days before a reminder shows, or null when the author turned reminders off. */
export function readBackupReminderDays(): number | null {
  const raw = readPreference(REMINDER_DAYS_KEY);
  if (raw === REMINDER_OFF) return null;
  const days = Number(raw);
  return raw !== null && Number.isInteger(days) && days > 0 ? days : DEFAULT_BACKUP_REMINDER_DAYS;
}

export function writeBackupReminderDays(days: number | null): void {
  writePreference(REMINDER_DAYS_KEY, days === null ? REMINDER_OFF : String(days));
}

export function readBackupReminderSnooze(projectId: string): number | null {
  const until = Number(readPreference(`${SNOOZE_KEY_PREFIX}:${projectId}`));
  return Number.isFinite(until) && until > 0 ? until : null;
}

/** "Remind me later": quiet for one day. */
export function snoozeBackupReminder(projectId: string, now = Date.now()): number {
  const until = now + DAY_MS;
  writePreference(`${SNOOZE_KEY_PREFIX}:${projectId}`, String(until));
  return until;
}

/**
 * A project worth backing up: it has a world record, or a scene with at least
 * one word in it. A new project with one empty scene does not count.
 */
export function projectHasRealContent(params: {
  documents: Pick<WritingDocument, 'content'>[];
  entityCount: number;
}): boolean {
  if (params.entityCount > 0) return true;
  return params.documents.some((document) => /[\p{L}\p{N}]/u.test(stripMarkup(document.content ?? '')));
}

function stripMarkup(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
}

/**
 * Whether the time alone could make a reminder due: past the threshold since
 * the last backup (or since the project was created, if never backed up), and
 * not snoozed. Checked before reading the project's content.
 */
export function isBackupReminderTimeDue(params: {
  project: Pick<Project, 'createdAt' | 'lastBackupAt'>;
  thresholdDays: number | null;
  snoozedUntil: number | null;
  now: number;
}): boolean {
  const {project, thresholdDays, snoozedUntil, now} = params;
  if (thresholdDays === null) return false;
  if (snoozedUntil !== null && now < snoozedUntil) return false;
  const since = project.lastBackupAt ?? project.createdAt;
  return now - since >= thresholdDays * DAY_MS;
}

export function isBackupReminderDue(params: {
  project: Pick<Project, 'createdAt' | 'lastBackupAt'>;
  hasContent: boolean;
  thresholdDays: number | null;
  snoozedUntil: number | null;
  now: number;
}): boolean {
  return params.hasContent && isBackupReminderTimeDue(params);
}

/** Whole days since `at`, by elapsed time. */
function daysSince(at: number, now: number): number {
  return Math.max(0, Math.floor((now - at) / DAY_MS));
}

function describeAge(at: number, now: number): string {
  const days = daysSince(at, now);
  if (days === 0) return 'today';
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** The project card line: "Last backup: 9 days ago" or "Never backed up". */
export function describeLastBackup(lastBackupAt: number | undefined, now: number): string {
  return lastBackupAt === undefined ? 'Never backed up' : `Last backup: ${describeAge(lastBackupAt, now)}`;
}

/** The reminder sentence for one project. */
export function describeBackupReminder(
  project: Pick<Project, 'name' | 'lastBackupAt'>,
  now: number
): string {
  return project.lastBackupAt === undefined
    ? `"${project.name}" has never been backed up. A backup file is the only copy of it outside this computer's app data.`
    : `"${project.name}" was last backed up ${describeAge(project.lastBackupAt, now)}. A backup file is the only copy of it outside this computer's app data.`;
}
