import {useEffect, useRef} from 'react';
import type {RefObject} from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'area[href]',
  'iframe',
  'object',
  'embed',
  'audio[controls]',
  'video[controls]',
  'summary',
  '[contenteditable]:not([contenteditable="false"])'
].join(',');

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute('aria-hidden') !== 'true'
  );
}

/**
 * Constrains Tab/Shift+Tab focus to the focusable children of a dialog
 * container while it is open, and restores focus to whatever element
 * triggered the dialog once it closes.
 *
 * Attach `containerRef` to the element carrying `role="dialog"`.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, isOpen: boolean): void {
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const container = containerRef.current;
    const focusables = getFocusableElements(container);
    const initialFocusTarget = focusables[0] ?? container;
    initialFocusTarget?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements(container);
      if (focusableElements.length === 0) {
        event.preventDefault();
        container?.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !container?.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !container?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    container?.addEventListener('keydown', onKeyDown);

    return () => {
      container?.removeEventListener('keydown', onKeyDown);
      const toRestore = previouslyFocusedElementRef.current;
      if (toRestore && typeof toRestore.focus === 'function') {
        toRestore.focus();
      }
      previouslyFocusedElementRef.current = null;
    };
  }, [isOpen, containerRef]);
}

export default useFocusTrap;
