import type {ProjectAISettings} from '../../entityTypes';
import {describeError} from '../errors';
import {LLMService} from '../llm/LLMService';
import {
  brainstormFocusKey,
  type WorldCanvasBrainstormFocus,
  type WorldCanvasBrainstormItem
} from './worldCanvasBrainstorm';

export interface PendingBrainstormItem extends WorldCanvasBrainstormItem {
  id: string;
}

interface BrainstormSessionEntry {
  items: PendingBrainstormItem[];
  /** Every item shown for this focus this session, so a repeat request asks for new ideas. */
  shownTexts: string[];
}

/**
 * Unreviewed brainstorm results live in memory only: never in IndexedDB, localStorage, backups, or
 * the retrieval index. Holding them at module scope (rather than in component state) means moving to another
 * route and back does not silently throw away a consultation the author paid for; a reload or
 * closing the window does, after the browser's leave-page confirm.
 */
const brainstormSession = new Map<string, BrainstormSessionEntry>();
const disclosedProjects = new Set<string>();

/** Test-only: clears the in-memory brainstorm session. */
export function resetWorldCanvasBrainstormSession(): void {
  brainstormSession.clear();
  disclosedProjects.clear();
}

export const brainstormSessionKey = (projectId: string, focus: WorldCanvasBrainstormFocus) =>
  `${projectId}:${brainstormFocusKey(focus)}`;

export const getPendingBrainstormItems = (key: string): PendingBrainstormItem[] =>
  brainstormSession.get(key)?.items ?? [];

export const getShownBrainstormTexts = (key: string): string[] =>
  brainstormSession.get(key)?.shownTexts ?? [];

export function setPendingBrainstormItems(
  key: string,
  items: PendingBrainstormItem[],
  newlyShown: string[] = []
): void {
  brainstormSession.set(key, {
    items,
    shownTexts: [...getShownBrainstormTexts(key), ...newlyShown]
  });
}

export const hasPendingBrainstormItems = (): boolean =>
  [...brainstormSession.values()].some((entry) => entry.items.length > 0);

export const hasBrainstormDisclosure = (projectId: string): boolean =>
  disclosedProjects.has(projectId);

export const markBrainstormDisclosed = (projectId: string): void => {
  disclosedProjects.add(projectId);
};

export const handleBrainstormBeforeUnload = (event: BeforeUnloadEvent): void => {
  if (!hasPendingBrainstormItems()) return;
  event.preventDefault();
  // Legacy browsers (and Electron's webContents) need returnValue set to prompt.
  event.returnValue = '';
};

const NOT_CONFIGURED_MESSAGE = 'AI provider is not configured. Add one in Settings to brainstorm.';

/** Resolves whether a request could be sent at all, without sending one. */
export function getBrainstormProviderIssue(aiConfig: ProjectAISettings | undefined): string | null {
  if (!aiConfig) return NOT_CONFIGURED_MESSAGE;
  try {
    new LLMService(aiConfig);
    return null;
  } catch (error) {
    return describeError(error, NOT_CONFIGURED_MESSAGE, {record: false});
  }
}
