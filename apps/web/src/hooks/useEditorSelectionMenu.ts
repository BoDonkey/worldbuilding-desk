import {useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject} from 'react';
import type {Editor as TipTapEditorInstance} from '@tiptap/react';
import type {LoreInspectorRecord} from '../services/workspace/workspaceConsultation';

/** What the selection menu acts on, and where it sits. */
export interface SelectionMenuState {
  selectedText: string;
  from: number;
  to: number;
  x: number;
  y: number;
  matchType: 'character' | 'entity' | null;
  matchName?: string;
  matchRecord?: {name: string; html: string; lore: LoreInspectorRecord};
}

type QuickSnippetRecord = {name: string; html: string; lore: LoreInspectorRecord};

export interface SelectionQuickSnippetLookup {
  characters: Record<string, QuickSnippetRecord>;
  entities: Record<string, QuickSnippetRecord>;
}

/** Lowercases and strips punctuation so a selection can match a record name. */
export function normalizeSelectionSurface(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Space kept between the menu and the window edge. */
const VIEWPORT_MARGIN = 8;

/** How far to move a menu so it sits fully inside the window. */
export function clampIntoViewport(
  rect: {left: number; right: number; top: number; bottom: number},
  viewport: {width: number; height: number}
): {dx: number; dy: number} {
  let dx = 0;
  if (rect.left < VIEWPORT_MARGIN) dx = VIEWPORT_MARGIN - rect.left;
  else if (rect.right > viewport.width - VIEWPORT_MARGIN) {
    dx = Math.max(viewport.width - VIEWPORT_MARGIN - rect.right, VIEWPORT_MARGIN - rect.left);
  }
  let dy = 0;
  if (rect.top < VIEWPORT_MARGIN) dy = VIEWPORT_MARGIN - rect.top;
  else if (rect.bottom > viewport.height - VIEWPORT_MARGIN) {
    dy = Math.max(viewport.height - VIEWPORT_MARGIN - rect.bottom, VIEWPORT_MARGIN - rect.top);
  }
  return {dx, dy};
}

/** The nearest ancestor that scrolls, whose box is where the text is visible. */
function scrollingAncestor(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const {overflowY} = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }
  return null;
}

function selectionPosition(editor: TipTapEditorInstance, from: number, to: number): {x: number; y: number} {
  const startCoords = editor.view.coordsAtPos(from);
  const endCoords = editor.view.coordsAtPos(to);
  return {
    x: (startCoords.left + endCoords.right) / 2,
    y: Math.max(16, Math.min(startCoords.top, endCoords.top) - 10)
  };
}

/**
 * The menu of actions for selected text. It opens only when the author
 * right-clicks a selection (or presses the context-menu key), so selecting
 * text to cut, copy, or drag never puts a menu over the page. It opens at the
 * pointer, kept inside the window, and moves with the text as the page
 * scrolls. It closes when the selection changes or scrolls out of view, on
 * Escape, or when `suppressed` turns on.
 */
export function useEditorSelectionMenu(params: {
  editorRef: RefObject<TipTapEditorInstance | null>;
  editorReadyToken: number;
  suppressed: boolean;
  quickSnippets?: SelectionQuickSnippetLookup;
}) {
  const {editorRef, editorReadyToken, suppressed, quickSnippets} = params;
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState | null>(null);
  const selectionMenuRef = useRef<HTMLDivElement | null>(null);
  // Where the menu sits relative to the start of the selection, so it can
  // follow the text when the page scrolls.
  const anchorOffsetRef = useRef({x: 0, y: 0});
  const closeSelectionMenu = useCallback(() => setSelectionMenu(null), []);

  /** Opens at `point` (the pointer), or above the selection for the keyboard. */
  const openSelectionMenu = useCallback((point?: {x: number; y: number}): boolean => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed || suppressed) return false;
    const {from, to} = editor.state.selection;
    if (from === to) return false;
    const selectedText = editor.state.doc.textBetween(from, to).trim();
    if (!selectedText) return false;
    const normalized = normalizeSelectionSurface(selectedText);
    const characterMatch = normalized ? quickSnippets?.characters[normalized] : undefined;
    const entityMatch = normalized ? quickSnippets?.entities[normalized] : undefined;
    const matchRecord = characterMatch ?? entityMatch;
    const position = point ?? selectionPosition(editor, from, to);
    const anchor = editor.view.coordsAtPos(from);
    anchorOffsetRef.current = {x: position.x - anchor.left, y: position.y - anchor.top};
    setSelectionMenu({
      selectedText,
      from,
      to,
      ...position,
      matchType: characterMatch ? 'character' : entityMatch ? 'entity' : null,
      matchName: matchRecord?.name,
      matchRecord
    });
    return true;
  }, [editorRef, quickSnippets, suppressed]);

  /** Call on every selection change: the menu belongs to the selection it opened on. */
  const syncSelectionMenu = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const {from, to} = editor.state.selection;
    setSelectionMenu((current) =>
      current && (current.from !== from || current.to !== to) ? null : current
    );
  }, [editorRef]);

  // Right-click on a selection opens the menu instead of the browser's own.
  // A character name's stat menu handles its right-click first (capture phase).
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view.dom;
    const onContextMenu = (event: MouseEvent) => {
      // The context-menu key reports no pointer position.
      const fromPointer = event.clientX !== 0 || event.clientY !== 0;
      if (openSelectionMenu(fromPointer ? {x: event.clientX, y: event.clientY} : undefined)) {
        event.preventDefault();
      }
    };
    dom.addEventListener('contextmenu', onContextMenu);
    return () => dom.removeEventListener('contextmenu', onContextMenu);
  }, [editorReadyToken, editorRef, openSelectionMenu]);

  useEffect(() => {
    if (suppressed) setSelectionMenu(null);
  }, [suppressed]);

  // Once rendered, nudge the menu so none of it falls outside the window.
  useLayoutEffect(() => {
    const menu = selectionMenuRef.current;
    if (!selectionMenu || !menu) return;
    const {dx, dy} = clampIntoViewport(menu.getBoundingClientRect(), {
      width: window.innerWidth,
      height: window.innerHeight
    });
    if (dx === 0 && dy === 0) return;
    anchorOffsetRef.current = {x: anchorOffsetRef.current.x + dx, y: anchorOffsetRef.current.y + dy};
    setSelectionMenu((current) => (current ? {...current, x: current.x + dx, y: current.y + dy} : current));
  }, [selectionMenu]);

  const isOpen = selectionMenu !== null;
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectionMenu(null);
    };
    const followText = () => {
      const editor = editorRef.current;
      if (!editor || editor.isDestroyed) return;
      const scroller = scrollingAncestor(editor.view.dom);
      setSelectionMenu((current) => {
        if (!current) return current;
        const anchor = editor.view.coordsAtPos(current.from);
        if (scroller) {
          const visible = scroller.getBoundingClientRect();
          if (anchor.bottom < visible.top || anchor.top > visible.bottom) return null;
        }
        return {
          ...current,
          x: anchor.left + anchorOffsetRef.current.x,
          y: anchor.top + anchorOffsetRef.current.y
        };
      });
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', followText, true);
    window.addEventListener('resize', followText);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', followText, true);
      window.removeEventListener('resize', followText);
    };
  }, [editorRef, isOpen]);

  return {selectionMenu, selectionMenuRef, setSelectionMenu, closeSelectionMenu, syncSelectionMenu};
}
