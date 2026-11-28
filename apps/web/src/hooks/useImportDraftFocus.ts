import {useCallback, useEffect, useRef, useState} from 'react';
import type {RefObject} from 'react';

interface FocusableDraft {
  id: string;
  parseError?: string;
  status?: 'imported' | 'failed';
}

/** The next draft still to import after `afterId`, wrapping to the top; null when none is left. */
export function nextPendingDraftId(drafts: FocusableDraft[], afterId: string): string | null {
  const pending = (draft: FocusableDraft) => !draft.parseError && draft.status !== 'imported';
  const start = drafts.findIndex((draft) => draft.id === afterId);
  const ordered = start === -1 ? drafts : [...drafts.slice(start + 1), ...drafts.slice(0, start)];
  return ordered.find(pending)?.id ?? null;
}

/**
 * Keeps the author's place in a batch World Bible import (slice 4.99). After
 * **Import**, focus moves to the next draft still to import. After **Import
 * and open**, it moves there once the record editor closes, so finishing a
 * long record does not leave the author at the bottom of the page.
 */
export function useImportDraftFocus<T extends FocusableDraft>({
  drafts,
  listRef,
  isRecordEditorOpen
}: {
  drafts: T[];
  listRef: RefObject<HTMLElement | null>;
  isRecordEditorOpen: boolean;
}) {
  const [focusDraftId, setFocusDraftId] = useState<string | null>(null);
  const returnAfterEditorRef = useRef<string | null>(null);
  const wasEditorOpenRef = useRef(isRecordEditorOpen);
  const draftsRef = useRef(drafts);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    if (!focusDraftId) return;
    const card = listRef.current?.querySelector<HTMLElement>(
      `[data-import-draft-id="${CSS.escape(focusDraftId)}"]`
    );
    setFocusDraftId(null);
    if (!card) return;
    card.scrollIntoView?.({block: 'start'});
    const target = card.querySelector<HTMLElement>('input[type="text"]') ?? card;
    target.focus({preventScroll: true});
  }, [focusDraftId, listRef]);

  useEffect(() => {
    const wasOpen = wasEditorOpenRef.current;
    wasEditorOpenRef.current = isRecordEditorOpen;
    const afterId = returnAfterEditorRef.current;
    if (!wasOpen || isRecordEditorOpen || !afterId) return;
    returnAfterEditorRef.current = null;
    setFocusDraftId(nextPendingDraftId(draftsRef.current, afterId));
  }, [isRecordEditorOpen]);

  /** Call after a draft imported without opening it. */
  const focusNextAfter = useCallback((draftId: string) => {
    setFocusDraftId(nextPendingDraftId(draftsRef.current, draftId));
  }, []);

  /** Call after **Import and open**; focus returns when the editor closes. */
  const returnAfterEditor = useCallback((draftId: string) => {
    returnAfterEditorRef.current = draftId;
  }, []);

  return {focusNextAfter, returnAfterEditor};
}
