import {useCallback, useEffect, useMemo, useRef, useState, type RefObject} from 'react';
import type {Editor as TipTapEditorInstance} from '@tiptap/react';
import type {EditorState} from 'prosemirror-state';
import type {CharacterSnapshot} from '../services/state/characterSnapshot';
import {
  findCharacterPeekTargetForLore,
  findCharacterPeekTargetsAt,
  type CharacterPeekTarget,
  type CharacterStatCardTemplate
} from '../services/state/characterPeek';

export const STAT_PEEK_SHORTCUT_LABEL = 'Cmd/Ctrl+Alt+S';

export interface EditorCharacterStatPeek {
  targets: CharacterPeekTarget[];
  getSnapshot: (sheetId: string, editorPosition: number) => CharacterSnapshot | null;
  template?: CharacterStatCardTemplate;
  sceneTitle: string;
}

export interface StatPeekState {
  source: 'hover' | 'keyboard';
  candidates: CharacterPeekTarget[];
  sheetId: string | null;
  editorPosition: number;
  left: number;
  top: number;
  anchorTop: number;
  anchorBottom: number;
}

export interface StatPeekMenuState {
  x: number;
  y: number;
  candidates: CharacterPeekTarget[];
  editorPosition: number;
  anchorTop: number;
  anchorBottom: number;
  selection: {selectedText: string; from: number; to: number} | null;
}

const isStatPeekShortcut = (event: KeyboardEvent): boolean =>
  (event.metaKey || event.ctrlKey) &&
  event.altKey &&
  !event.shiftKey &&
  event.code === 'KeyS' &&
  !event.getModifierState?.('AltGraph');

/** Characters named at an editor range, within the block that holds its start. */
const findStatPeekCandidates = (
  state: EditorState,
  targets: CharacterPeekTarget[],
  from: number,
  to: number
): CharacterPeekTarget[] => {
  const $from = state.doc.resolve(from);
  if (!$from.parent.isTextblock) return [];
  const start = $from.start();
  const size = $from.parent.content.size;
  // One placeholder character per inline leaf keeps text offsets equal to positions.
  const text = $from.parent.textBetween(0, size, undefined, '￼');
  return findCharacterPeekTargetsAt({
    text,
    from: from - start,
    to: Math.min(to, start + size) - start,
    targets
  });
};

interface UseEditorStatPeekParams {
  editorRef: RefObject<TipTapEditorInstance | null>;
  editorScrollRef: RefObject<HTMLDivElement | null>;
  editorReadyToken: number;
  characterStatPeek?: EditorCharacterStatPeek;
  statPeekRequest: {sheetId: string; token: number} | null;
  /** Closes the selection bubble; a peek or its menu replaces it. */
  closeSelectionBubble: () => void;
  /** Closes the lore and stat-block popovers; a peek replaces them. */
  closeOtherPopovers: () => void;
}

/**
 * Stat peek in the editor (Slice 4.47): hover on a character mention, the
 * keyboard shortcut, the right-click menu on a name, and requests from the
 * command palette. Read-only: it shows state, never changes it.
 */
export function useEditorStatPeek({
  editorRef,
  editorScrollRef,
  editorReadyToken,
  characterStatPeek,
  statPeekRequest,
  closeSelectionBubble,
  closeOtherPopovers
}: UseEditorStatPeekParams) {
  const [statPeek, setStatPeek] = useState<StatPeekState | null>(null);
  const [statPeekMenu, setStatPeekMenu] = useState<StatPeekMenuState | null>(null);
  const statPeekMenuRef = useRef<HTMLDivElement | null>(null);

  const handleLoreHighlightHover = useCallback(
    (
      loreId: string,
      editorPosition: number,
      anchorRect: {left: number; top: number; bottom: number}
    ) => {
      const target = characterStatPeek
        ? findCharacterPeekTargetForLore(characterStatPeek.targets, loreId)
        : null;
      const hasSnapshot = Boolean(
        target && characterStatPeek?.getSnapshot(target.sheetId, editorPosition)
      );
      setStatPeek((current) => {
        // A peek opened on purpose stays until the author closes it.
        if (current?.source === 'keyboard') return current;
        if (!target || !hasSnapshot) return null;
        return {
          source: 'hover',
          candidates: [target],
          sheetId: target.sheetId,
          editorPosition,
          left: anchorRect.left,
          top: anchorRect.bottom + 8,
          anchorTop: anchorRect.top,
          anchorBottom: anchorRect.bottom
        };
      });
      if (!target || !hasSnapshot) return;
      closeOtherPopovers();
    },
    [characterStatPeek, closeOtherPopovers]
  );

  /** Ends a hover peek; a peek opened on purpose stays. */
  const handleLoreHighlightLeave = useCallback(() => {
    setStatPeek((current) => (current?.source === 'hover' ? null : current));
  }, []);

  const openStatPeek = useCallback(
    (params: {
      candidates: CharacterPeekTarget[];
      editorPosition: number;
      anchorTop?: number;
      anchorBottom?: number;
      left?: number;
    }) => {
      const editor = editorRef.current;
      if (!editor || editor.isDestroyed) return;
      const coords = editor.view.coordsAtPos(params.editorPosition);
      const anchorTop = params.anchorTop ?? coords.top;
      const anchorBottom = params.anchorBottom ?? coords.bottom;
      closeSelectionBubble();
      closeOtherPopovers();
      setStatPeekMenu(null);
      setStatPeek({
        source: 'keyboard',
        candidates: params.candidates,
        sheetId: params.candidates.length === 1 ? params.candidates[0].sheetId : null,
        editorPosition: params.editorPosition,
        left: params.left ?? coords.left,
        top: anchorBottom + 8,
        anchorTop,
        anchorBottom
      });
    },
    [closeOtherPopovers, closeSelectionBubble, editorRef]
  );

  const openStatPeekAtSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed || !characterStatPeek) return;
    const {from, to} = editor.state.selection;
    openStatPeek({
      candidates: findStatPeekCandidates(editor.state, characterStatPeek.targets, from, to),
      editorPosition: from
    });
  }, [characterStatPeek, editorRef, openStatPeek]);

  const closeStatPeek = useCallback(() => {
    setStatPeek((current) => {
      if (current?.source === 'keyboard') {
        window.requestAnimationFrame(() => {
          const editor = editorRef.current;
          if (editor && !editor.isDestroyed) editor.view.focus();
        });
      }
      return null;
    });
  }, [editorRef]);

  const statPeekSnapshot = useMemo(
    () =>
      statPeek?.sheetId && characterStatPeek
        ? characterStatPeek.getSnapshot(statPeek.sheetId, statPeek.editorPosition)
        : null,
    [characterStatPeek, statPeek]
  );

  useEffect(() => {
    if (!characterStatPeek) {
      setStatPeek(null);
      setStatPeekMenu(null);
    }
  }, [characterStatPeek]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !characterStatPeek) return;
    const dom = editor.view.dom;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isStatPeekShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
      openStatPeekAtSelection();
    };
    dom.addEventListener('keydown', onKeyDown, true);
    return () => dom.removeEventListener('keydown', onKeyDown, true);
  }, [characterStatPeek, editorReadyToken, editorRef, openStatPeekAtSelection]);

  useEffect(() => {
    const container = editorScrollRef.current;
    const editor = editorRef.current;
    if (!container || !editor || !characterStatPeek) return;
    // Capture phase, so a character name gets this menu before the editor's own
    // right-click handling (AI Expand on a selection), which the menu keeps.
    const onContextMenu = (event: MouseEvent) => {
      if (editor.isDestroyed || !(event.target instanceof Node)) return;
      if (!editor.view.dom.contains(event.target)) return;
      const hit = editor.view.posAtCoords({left: event.clientX, top: event.clientY});
      if (!hit) return;
      const {from, to} = editor.state.selection;
      const inSelection = from !== to && hit.pos >= from && hit.pos <= to;
      const range = inSelection ? {from, to} : {from: hit.pos, to: hit.pos};
      const candidates = findStatPeekCandidates(
        editor.state,
        characterStatPeek.targets,
        range.from,
        range.to
      );
      if (candidates.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      const selectedText = from !== to ? editor.state.doc.textBetween(from, to) : '';
      closeSelectionBubble();
      setStatPeek(null);
      setStatPeekMenu({
        x: event.clientX,
        y: event.clientY,
        candidates,
        editorPosition: range.from,
        anchorTop: event.clientY - 8,
        anchorBottom: event.clientY + 8,
        selection: selectedText.trim() ? {selectedText, from, to} : null
      });
    };
    container.addEventListener('contextmenu', onContextMenu, true);
    return () => container.removeEventListener('contextmenu', onContextMenu, true);
  }, [characterStatPeek, closeSelectionBubble, editorReadyToken, editorRef, editorScrollRef]);

  useEffect(() => {
    if (!statPeekMenu) return;
    statPeekMenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus({
      preventScroll: true
    });
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && statPeekMenuRef.current?.contains(event.target)) {
        return;
      }
      setStatPeekMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setStatPeekMenu(null);
      editorRef.current?.view.focus();
    };
    window.addEventListener('pointerdown', closeOnOutside, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutside, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [editorRef, statPeekMenu]);

  const lastStatPeekRequestTokenRef = useRef<number | null>(null);
  useEffect(() => {
    if (!statPeekRequest || !characterStatPeek) return;
    if (lastStatPeekRequestTokenRef.current === statPeekRequest.token) return;
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    const target = characterStatPeek.targets.find(
      (candidate) => candidate.sheetId === statPeekRequest.sheetId
    );
    if (!target) return;
    lastStatPeekRequestTokenRef.current = statPeekRequest.token;
    openStatPeek({candidates: [target], editorPosition: editor.state.selection.from});
  }, [characterStatPeek, editorReadyToken, editorRef, openStatPeek, statPeekRequest]);

  return {
    statPeek,
    setStatPeek,
    statPeekMenu,
    setStatPeekMenu,
    statPeekMenuRef,
    statPeekSnapshot,
    openStatPeek,
    closeStatPeek,
    handleLoreHighlightHover,
    handleLoreHighlightLeave
  };
}

export type EditorStatPeekControls = ReturnType<typeof useEditorStatPeek>;
