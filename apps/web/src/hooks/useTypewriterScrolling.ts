import {useEffect, type RefObject} from 'react';
import type {Editor as TipTapEditorInstance} from '@tiptap/react';
import {isTypingChange, typewriterScrollTarget} from '../services/editor/typewriterScroll';

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Typewriter scrolling in the manuscript editor (slice 4.92). After a key
 * press changes the text or moves the caret, the scroll area moves so the
 * caret line sits a third of the way down. Clicks, drags, and the author's
 * own scrolling never scroll it; the next key press does. Jumps instead of
 * animating when the system asks for reduced motion. The bottom padding that
 * lets the last line reach that height is CSS (`data-editor-typewriter`).
 */
export function useTypewriterScrolling(params: {
  enabled: boolean;
  editorRef: RefObject<TipTapEditorInstance | null>;
  editorScrollRef: RefObject<HTMLDivElement | null>;
  editorReadyToken: number;
}): void {
  const {enabled, editorRef, editorScrollRef, editorReadyToken} = params;

  useEffect(() => {
    const editor = editorRef.current;
    const scrollElement = editorScrollRef.current;
    if (!enabled || !editor || !scrollElement) return;
    const dom = editor.view.dom;
    let lastKeyAt = 0;
    let lastPointerAt = 0;
    let frame: number | null = null;

    const onKey = () => {
      lastKeyAt = Date.now();
    };
    const onPointer = () => {
      lastPointerAt = Date.now();
    };
    const align = () => {
      frame = null;
      if (editor.isDestroyed) return;
      const caret = editor.view.coordsAtPos(editor.state.selection.head);
      const view = scrollElement.getBoundingClientRect();
      const target = typewriterScrollTarget({
        caretTop: caret.top,
        viewTop: view.top,
        viewHeight: scrollElement.clientHeight,
        scrollTop: scrollElement.scrollTop,
        maxScrollTop: scrollElement.scrollHeight - scrollElement.clientHeight
      });
      if (target === null) return;
      scrollElement.scrollTo({top: target, behavior: prefersReducedMotion() ? 'auto' : 'smooth'});
    };
    const onTransaction = ({transaction}: {transaction: {docChanged: boolean; selectionSet: boolean}}) => {
      const typing = isTypingChange({
        changed: transaction.docChanged || transaction.selectionSet,
        hasFocus: editor.view.hasFocus(),
        lastKeyAt,
        lastPointerAt,
        now: Date.now()
      });
      if (!typing || frame !== null) return;
      // After the browser has laid out the change, so the caret is measured where it is.
      frame = window.requestAnimationFrame(align);
    };

    dom.addEventListener('keydown', onKey, true);
    dom.addEventListener('beforeinput', onKey, true);
    dom.addEventListener('compositionend', onKey, true);
    dom.addEventListener('pointerdown', onPointer, true);
    scrollElement.addEventListener('wheel', onPointer, {passive: true});
    editor.on('transaction', onTransaction);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      dom.removeEventListener('keydown', onKey, true);
      dom.removeEventListener('beforeinput', onKey, true);
      dom.removeEventListener('compositionend', onKey, true);
      dom.removeEventListener('pointerdown', onPointer, true);
      scrollElement.removeEventListener('wheel', onPointer);
      editor.off('transaction', onTransaction);
    };
  }, [editorReadyToken, editorRef, editorScrollRef, enabled]);
}
