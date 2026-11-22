import {useCallback, useEffect, useRef, useState} from 'react';
import {getHTMLFromFragment, type Editor, type JSONContent} from '@tiptap/core';
import {Fragment} from 'prosemirror-model';
import type {Transaction} from 'prosemirror-state';
import type {SceneSnapshot} from '../entityTypes';
import {WORKSPACE_COMMAND_EVENT, type WorkspaceCommandId} from '../commands/workspaceCommands';
import {
  buildPassageRewrite,
  findPassage,
  isPassageUnchanged,
  mapPassageRange,
  passageSlice,
  passageText,
  savePassageAlternative,
  type PassageRange
} from '../services/editor/passageRewrite';
import {takeSceneSnapshot} from '../services/editor/sceneSnapshots';
import {describeError} from '../services/errors';
import {pushAppToast} from '../store/notificationStore';

/** Opens Rewrite beside original on a passage, or on a saved alternative. */
export const PASSAGE_REWRITE_EVENT = 'wbd:open-passage-rewrite';

export type PassageRewriteRequest =
  | {documentId: string; range: PassageRange}
  | {documentId: string; alternative: SceneSnapshot};

export const requestPassageRewrite = (detail: PassageRewriteRequest) =>
  window.dispatchEvent(new CustomEvent<PassageRewriteRequest>(PASSAGE_REWRITE_EVENT, {detail}));

export interface PassageRewriteSession {
  token: number;
  originalText: string;
  originalHtml: string;
  /** The editable copy's starting text: the original, or a saved alternative. */
  rewriteHtml: string;
  alternativeName?: string;
}

/**
 * Rewrite beside the original (slice 4.97) for the scene editor. The passage's
 * range is mapped through every edit while the rewrite is open, so typing
 * elsewhere in the scene is fine; editing the passage itself makes the
 * rewrite stale, and Use rewrite then refuses rather than replace other text.
 */
export function usePassageRewrite({editor, projectId, documentId}: {
  editor: Editor | null;
  projectId?: string;
  documentId?: string;
}) {
  const [session, setSession] = useState<PassageRewriteSession | null>(null);
  const [isStale, setStale] = useState(false);
  const [isWorking, setWorking] = useState(false);
  const rangeRef = useRef<PassageRange | null>(null);
  const sessionRef = useRef<PassageRewriteSession | null>(null);
  const enabled = Boolean(editor && projectId && documentId);

  const close = useCallback(() => {
    sessionRef.current = null;
    rangeRef.current = null;
    setSession(null);
    setStale(false);
  }, []);

  const start = useCallback((range: PassageRange, rewriteHtml?: string, alternativeName?: string) => {
    if (!editor) return;
    if (sessionRef.current) {
      pushAppToast({tone: 'error', message: 'Finish or discard the open rewrite first.'});
      return;
    }
    const originalText = passageText(editor.state.doc, range);
    if (!originalText.trim()) {
      pushAppToast({tone: 'error', message: 'Select a passage to rewrite.'});
      return;
    }
    const originalHtml = getHTMLFromFragment(passageSlice(editor.state.doc, range).content, editor.schema);
    const next = {token: Date.now(), originalText, originalHtml, rewriteHtml: rewriteHtml ?? originalHtml, alternativeName};
    rangeRef.current = range;
    sessionRef.current = next;
    setSession(next);
    setStale(false);
  }, [editor]);

  // Close on another scene; follow the passage through every edit.
  useEffect(() => close, [close, documentId]);
  useEffect(() => {
    if (!editor) return;
    const onTransaction = ({transaction}: {transaction: Transaction}) => {
      const current = sessionRef.current;
      if (!current || !transaction.docChanged) return;
      rangeRef.current = rangeRef.current && mapPassageRange(rangeRef.current, transaction);
      setStale(!isPassageUnchanged(editor.state.doc, rangeRef.current, current.originalText));
    };
    editor.on('transaction', onTransaction);
    return () => {
      editor.off('transaction', onTransaction);
    };
  }, [editor]);

  useEffect(() => {
    if (!enabled || !editor) return;
    const onCommand = (event: Event) => {
      const id = (event as CustomEvent<{id?: WorkspaceCommandId}>).detail?.id;
      if (id !== 'rewrite-beside-original') return;
      const {from, to} = editor.state.selection;
      start({from, to});
    };
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<PassageRewriteRequest>).detail;
      if (!detail || detail.documentId !== documentId) return;
      if ('range' in detail) {
        start(detail.range);
        return;
      }
      const range = detail.alternative.passage && findPassage(editor.state.doc, detail.alternative.passage.originalText);
      if (!range) {
        pushAppToast({
          tone: 'error',
          message: 'The original passage is no longer in this scene exactly once. Copy the alternative instead.'
        });
        return;
      }
      start(range, detail.alternative.content, detail.alternative.name);
    };
    window.addEventListener(WORKSPACE_COMMAND_EVENT, onCommand);
    window.addEventListener(PASSAGE_REWRITE_EVENT, onRequest);
    return () => {
      window.removeEventListener(WORKSPACE_COMMAND_EVENT, onCommand);
      window.removeEventListener(PASSAGE_REWRITE_EVENT, onRequest);
    };
  }, [documentId, editor, enabled, start]);

  /** Replaces the passage with the rewrite, one undoable change, after a snapshot. */
  const applyRewrite = useCallback((rewrite: JSONContent) => {
    const current = sessionRef.current;
    if (!editor || !current || !projectId || !documentId) return;
    const before = editor.getHTML();
    const result = buildPassageRewrite(
      editor.state,
      rangeRef.current,
      current.originalText,
      Fragment.fromJSON(editor.schema, rewrite.content ?? [])
    );
    if (!result.ok) {
      if (result.reason === 'changed') setStale(true);
      else pushAppToast({tone: 'error', message: 'The rewrite is empty. Discard it to keep the original.'});
      return;
    }
    close();
    editor.view.dispatch(result.transaction.scrollIntoView());
    editor.commands.focus();
    takeSceneSnapshot({projectId, sceneId: documentId, content: before, kind: 'before-rewrite'}).catch(() =>
      pushAppToast({tone: 'error', message: 'The rewrite was used, but the snapshot before it could not be saved.'})
    );
    pushAppToast({message: 'Rewrite used. Undo brings back the original.'});
  }, [close, documentId, editor, projectId]);

  /** Saves the rewrite as an alternative in the scene's Snapshots, and leaves the scene alone. */
  const keepBoth = useCallback(async (rewriteHtml: string, name: string) => {
    const current = sessionRef.current;
    if (!current || !projectId || !documentId) return;
    setWorking(true);
    try {
      const saved = await savePassageAlternative({
        projectId,
        sceneId: documentId,
        originalHtml: current.originalHtml,
        originalText: current.originalText,
        rewriteHtml,
        name
      });
      close();
      pushAppToast({message: `Saved "${saved.name}" in this scene's Snapshots.`});
    } catch (error) {
      pushAppToast({tone: 'error', message: describeError(error, 'Unable to save the alternative.')});
    } finally {
      setWorking(false);
    }
  }, [close, documentId, projectId]);

  return {session, isStale, isWorking, applyRewrite, keepBoth, discard: close};
}
