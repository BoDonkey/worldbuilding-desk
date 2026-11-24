import {useCallback, useEffect, useRef, useState, type RefObject} from 'react';
import type {Editor as TipTapEditorInstance} from '@tiptap/react';
import {TextSelection} from 'prosemirror-state';
import {setCurrentSceneFind} from '../components/Editor/extensions/CurrentSceneFindExtension';
import {
  findCurrentSceneMatches,
  resolveCurrentSceneFindIndex,
  type CurrentSceneFindMatch
} from '../services/workspace/currentSceneFind';
import {revealEditorPosition} from './useEditorScrollMemory';

/**
 * Find in the current scene: the bar's open state, query, and matches, the
 * Cmd/Ctrl+F and Escape shortcuts, the match decorations, and revealing the
 * active match. Resets when the scene changes.
 */
export function useCurrentSceneFind(params: {
  editorRef: RefObject<TipTapEditorInstance | null>;
  editorScrollRef: RefObject<HTMLDivElement | null>;
  editorReadyToken: number;
  editorScrollKey: string;
  documentId: string;
  content: string;
  /**
   * The bar also resets when this changes. It is the Workspace's open-AI-context
   * handler, kept from before the hook was split out.
   */
  resetSignal: unknown;
}) {
  const {
    editorRef,
    editorScrollRef,
    editorReadyToken,
    editorScrollKey,
    documentId,
    content,
    resetSignal
  } = params;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQueryState] = useState('');
  const [matches, setMatches] = useState<CurrentSceneFindMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQueryState('');
    setMatches([]);
    setActiveIndex(-1);
    window.requestAnimationFrame(() => {
      editorRef.current?.view.dom.focus({preventScroll: true});
    });
  }, [editorRef]);

  const navigate = useCallback(
    (direction: 'next' | 'previous') => {
      setActiveIndex((currentIndex) =>
        resolveCurrentSceneFindIndex(currentIndex, matches.length, direction)
      );
    },
    [matches.length]
  );

  /** A new query starts again at the first match. */
  const setQuery = useCallback((nextQuery: string) => {
    setQueryState(nextQuery);
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    const handleFindShortcut = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey && // Cmd/Ctrl+Shift+F is focus mode
        event.key.toLocaleLowerCase() === 'f'
      ) {
        event.preventDefault();
        open();
        return;
      }
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', handleFindShortcut);
    return () => window.removeEventListener('keydown', handleFindShortcut);
  }, [close, isOpen, open]);

  useEffect(() => {
    setIsOpen(false);
    setQueryState('');
    setMatches([]);
    setActiveIndex(-1);
  }, [documentId, resetSignal]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !isOpen || !query.trim()) {
      setMatches([]);
      setActiveIndex(-1);
      return;
    }

    const segments: Array<{text: string; position: number}> = [];
    editor.state.doc.descendants((node, position) => {
      if (node.isText && node.text) {
        segments.push({text: node.text, position});
      }
    });
    const nextMatches = findCurrentSceneMatches(segments, query);
    setMatches(nextMatches);
    setActiveIndex((currentIndex) => {
      if (!nextMatches.length) return -1;
      return currentIndex >= 0 && currentIndex < nextMatches.length ? currentIndex : 0;
    });
  }, [content, editorReadyToken, editorRef, isOpen, query]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    if (!isOpen || !matches.length) {
      editor.view.dispatch(setCurrentSceneFind(editor.state.tr, null));
      return;
    }

    const activeMatch = matches[activeIndex];
    let transaction = setCurrentSceneFind(editor.state.tr, {
      matches,
      activeIndex
    });
    if (activeMatch) {
      transaction = transaction
        .setSelection(
          TextSelection.create(editor.state.doc, activeMatch.from, activeMatch.to)
        )
        .scrollIntoView();
    }
    editor.view.dispatch(transaction);

    if (!activeMatch) return;
    window.requestAnimationFrame(() => {
      const scrollElement = editorScrollRef.current;
      if (scrollElement) {
        revealEditorPosition(editor, scrollElement, activeMatch.from, editorScrollKey);
      }
      inputRef.current?.focus();
    });
  }, [activeIndex, editorReadyToken, editorRef, editorScrollKey, editorScrollRef, isOpen, matches]);

  // The input ref is returned beside the controls, not inside them, so that
  // reading a control during render is not a ref read.
  return {
    find: {isOpen, query, setQuery, matches, activeIndex, open, close, navigate},
    findInputRef: inputRef
  };
}

export type CurrentSceneFindControls = ReturnType<typeof useCurrentSceneFind>['find'];
