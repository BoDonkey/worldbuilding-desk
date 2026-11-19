import {useEffect, type RefObject} from 'react';
import type {Editor as TipTapEditorInstance} from '@tiptap/react';
import {TextSelection} from 'prosemirror-state';
import {
  reviewFocusFlashKey,
  setReviewFocusFlash
} from '../components/Editor/extensions/ReviewFocusFlashExtension';
import {revealEditorPosition} from './useEditorScrollMemory';

/**
 * Jumps to a review finding: selects the first match of `focusQuery` in the
 * scene, reveals it, and flashes it for 1.8 seconds. `focusToken` repeats the
 * jump for the same text. When the flash decoration does not render, the
 * matched element gets a fallback flash class instead.
 */
export function useEditorReviewFocus(params: {
  editorRef: RefObject<TipTapEditorInstance | null>;
  editorScrollRef: RefObject<HTMLDivElement | null>;
  editorReadyToken: number;
  editorScrollKey: string;
  documentId: string;
  focusQuery: string | null;
  focusToken: number;
}): void {
  const {
    editorRef,
    editorScrollRef,
    editorReadyToken,
    editorScrollKey,
    documentId,
    focusQuery,
    focusToken
  } = params;

  useEffect(() => {
    const query = focusQuery?.trim();
    const editor = editorRef.current;
    if (!editor || !query) return;

    const loweredQuery = query.toLowerCase();
    let matchFrom = -1;
    let matchTo = -1;

    editor.state.doc.descendants((node, pos) => {
      if (matchFrom >= 0 || !node.isText || !node.text) {
        return;
      }
      const index = node.text.toLowerCase().indexOf(loweredQuery);
      if (index < 0) {
        return;
      }
      matchFrom = pos + index;
      matchTo = pos + index + query.length;
    });

    if (matchFrom < 0 || matchTo <= matchFrom) return;

    editor.commands.focus();
    const flashToken = focusToken || Date.now();
    editor.view.dispatch(
      setReviewFocusFlash(editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, matchFrom, matchTo)
      ), {
        from: matchFrom,
        to: matchTo,
        token: flashToken
      }).scrollIntoView()
    );
    window.requestAnimationFrame(() => {
      const scrollElement = editorScrollRef.current;
      if (!scrollElement) return;
      revealEditorPosition(editor, scrollElement, matchFrom, editorScrollKey);

      const flashSelector = `[data-review-focus-token="${flashToken}"]`;
      if (!editor.view.dom.querySelector(flashSelector)) {
        const domAtMatch = editor.view.domAtPos(matchFrom);
        const fallbackElement =
          domAtMatch.node.nodeType === Node.TEXT_NODE
            ? domAtMatch.node.parentElement
            : domAtMatch.node instanceof HTMLElement
              ? domAtMatch.node
              : null;
        fallbackElement?.classList.add('review-focus-flash');
        fallbackElement?.setAttribute(
          'data-review-focus-fallback-token',
          String(flashToken)
        );
      }
    });
    const clearFallbackFlash = () => {
      editor.view.dom
        .querySelectorAll(`[data-review-focus-fallback-token="${flashToken}"]`)
        .forEach((element) => {
          element.classList.remove('review-focus-flash');
          element.removeAttribute('data-review-focus-fallback-token');
        });
    };
    const clearToken = window.setTimeout(() => {
      const current = reviewFocusFlashKey.getState(editor.state);
      if (current?.token === flashToken) {
        editor.view.dispatch(setReviewFocusFlash(editor.state.tr, null));
      }
      clearFallbackFlash();
    }, 1800);
    return () => {
      window.clearTimeout(clearToken);
      clearFallbackFlash();
    };
  }, [documentId, editorReadyToken, editorRef, editorScrollKey, editorScrollRef, focusQuery, focusToken]);
}
