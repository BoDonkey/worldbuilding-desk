import {useCallback, useEffect, useRef, useState} from 'react';
import type {Dispatch, SetStateAction} from 'react';
import type {LLMMessage} from '../services/llm/types';
import type {CraftCitation} from '../services/craft/types';
import type {AITextProvenance} from '../services/editor/aiTextProvenance';

export type AssistantChatMessage = LLMMessage & {
  contextSources?: string[];
  /** Present only on a writing-coach response: craft reference sources, kept
   * visually distinct from contextSources because they are never the
   * author's canon or manuscript evidence. */
  craftCitations?: CraftCitation[];
  /** Present only on model-written replies; inserting such a reply marks it as AI text. */
  provenance?: AITextProvenance;
};

const MAX_SAVED_MESSAGES = 100;
/** `scope` keeps a separate history per surface; the Workspace drawer uses the unscoped key. */
const storageKey = (projectId: string, scope?: string) =>
  scope ? `wbd:assistant-conversation:${scope}:${projectId}` : `wbd:assistant-conversation:${projectId}`;

const getSessionStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const isCraftCitation = (value: unknown): value is CraftCitation =>
  Boolean(value) &&
  typeof value === 'object' &&
  typeof (value as Partial<CraftCitation>).id === 'string' &&
  typeof (value as Partial<CraftCitation>).label === 'string' &&
  ((value as Partial<CraftCitation>).url === undefined ||
    typeof (value as Partial<CraftCitation>).url === 'string');

const isAssistantChatMessage = (value: unknown): value is AssistantChatMessage => {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<AssistantChatMessage>;
  return (
    (message.role === 'user' || message.role === 'assistant' || message.role === 'system') &&
    typeof message.content === 'string' &&
    (message.contextSources === undefined ||
      (Array.isArray(message.contextSources) &&
        message.contextSources.every((source) => typeof source === 'string'))) &&
    (message.craftCitations === undefined ||
      (Array.isArray(message.craftCitations) && message.craftCitations.every(isCraftCitation))) &&
    (message.provenance === undefined ||
      (typeof message.provenance === 'object' &&
        message.provenance !== null &&
        typeof message.provenance.origin === 'string' &&
        typeof message.provenance.at === 'number'))
  );
};

export const loadAssistantConversation = (
  projectId: string,
  storage: Storage | null = getSessionStorage(),
  scope?: string
): AssistantChatMessage[] => {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(storageKey(projectId, scope)) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter(isAssistantChatMessage).slice(-MAX_SAVED_MESSAGES)
      : [];
  } catch {
    return [];
  }
};

const saveAssistantConversation = (
  projectId: string,
  messages: AssistantChatMessage[],
  scope?: string,
  storage: Storage | null = getSessionStorage()
): void => {
  if (!storage) return;
  try {
    storage.setItem(
      storageKey(projectId, scope),
      JSON.stringify(messages.slice(-MAX_SAVED_MESSAGES))
    );
  } catch {
    // Conversation continuity is helpful UI state, not a reason to block chat.
  }
};

export const useAssistantConversation = (
  projectId: string,
  scope?: string
): [AssistantChatMessage[], Dispatch<SetStateAction<AssistantChatMessage[]>>] => {
  const [messages, setMessagesState] = useState<AssistantChatMessage[]>(() =>
    loadAssistantConversation(projectId, undefined, scope)
  );
  const projectIdRef = useRef(projectId);

  useEffect(() => {
    if (projectIdRef.current === projectId) return;
    projectIdRef.current = projectId;
    setMessagesState(loadAssistantConversation(projectId, undefined, scope));
  }, [projectId, scope]);

  const setMessages = useCallback<Dispatch<SetStateAction<AssistantChatMessage[]>>>(
    (update) => {
      setMessagesState((previous) => {
        const next =
          typeof update === 'function'
            ? update(previous)
            : update;
        const bounded = next.slice(-MAX_SAVED_MESSAGES);
        saveAssistantConversation(projectIdRef.current, bounded, scope);
        return bounded;
      });
    },
    [scope]
  );

  return [messages, setMessages];
};
