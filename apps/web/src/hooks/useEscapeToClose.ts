import {useEffect} from 'react';

/**
 * Closes a modal/dialog when the user presses Escape while it is open.
 *
 * Extracted from the (formerly) bespoke Escape handlers on the Scratchpad
 * and Corkboard modals in WorkspaceRoute.tsx so every dialog shares one
 * implementation.
 */
export function useEscapeToClose(onClose: () => void, isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);
}

export default useEscapeToClose;
