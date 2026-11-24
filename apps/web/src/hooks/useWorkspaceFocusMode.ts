import {useCallback, useEffect, useState} from 'react';
import {useAccessibility} from '../contexts/AccessibilityContext';
import {WORKSPACE_COMMAND_EVENT, type WorkspaceCommandId} from '../commands/workspaceCommands';
import {useFocusModeStore} from '../store/focusModeStore';

/** True for Cmd/Ctrl+Shift+F, the focus mode shortcut. */
export const isFocusModeShortcut = (event: KeyboardEvent): boolean =>
  (event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && event.code === 'KeyF';

/**
 * Something else that Escape should close first: a dialog, a menu, a listbox,
 * or an overlay marked `data-escape-layer` (the selection menu, popovers).
 */
export const hasEscapeTarget = (doc: Document = document): boolean =>
  Boolean(doc.querySelector(
    '[role="dialog"], [role="alertdialog"], [aria-modal="true"], [role="menu"], [role="listbox"], [data-escape-layer]'
  ));

/**
 * Whether an Escape keydown should leave focus mode. ProseMirror cancels every
 * Escape typed in the editor, so from there only an open overlay blocks it;
 * from anywhere else (the find box, a button) it leaves only if no other
 * handler cancelled the key, checked once they have all run.
 */
export const shouldLeaveOnEscape = (event: KeyboardEvent, doc: Document = document): boolean => {
  if (event.key !== 'Escape' || hasEscapeTarget(doc)) return false;
  const target = event.target;
  return target instanceof Element && Boolean(target.closest('.ProseMirror')) ? true : !event.defaultPrevented;
};

const focusEditor = () => {
  window.requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('[data-workspace-root] .ProseMirror')?.focus({preventScroll: true});
  });
};

/**
 * Workspace focus mode (slice 4.91). While on, `data-focus-mode="on"` on the
 * root hides the navigation rail, drawers, header, toolbar, and footer by CSS
 * (`[data-focus-hide]`), so every panel stays mounted: autosave, review, and
 * the drawers' state carry on and come back as they were. Toggled by the
 * footer button, the command palette, or Cmd/Ctrl+Shift+F; Escape leaves when
 * nothing else is open for it to close. Focus goes back to the editor.
 */
export function useWorkspaceFocusMode(params: {
  isNarrowViewport: boolean;
  closeSceneDrawer: () => void;
  closeContextDrawer: () => void;
}) {
  const {isNarrowViewport, closeSceneDrawer, closeContextDrawer} = params;
  const {focusModeStart} = useAccessibility();
  const isOn = useFocusModeStore((state) => state.isOn);
  const setOn = useFocusModeStore((state) => state.setOn);
  const [announcement, setAnnouncement] = useState('');

  // Each visit to the Workspace starts from the setting; leaving turns it off.
  useEffect(() => {
    setOn(focusModeStart === 'on');
    return () => setOn(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once per mount
  }, [setOn]);

  useEffect(() => {
    const root = document.documentElement;
    if (isOn) root.setAttribute('data-focus-mode', 'on');
    else root.removeAttribute('data-focus-mode');
    return () => root.removeAttribute('data-focus-mode');
  }, [isOn]);

  const setFocusMode = useCallback(
    (on: boolean) => {
      if (on && isNarrowViewport) {
        // On a narrow screen the drawers are overlays that trap focus; close them.
        closeSceneDrawer();
        closeContextDrawer();
      }
      setOn(on);
      setAnnouncement(on ? 'Focus mode on. Press Escape to leave.' : 'Focus mode off.');
      focusEditor();
    },
    [closeContextDrawer, closeSceneDrawer, isNarrowViewport, setOn]
  );

  useEffect(() => {
    const onCommand = (event: Event) => {
      const id = (event as CustomEvent<{id?: WorkspaceCommandId}>).detail?.id;
      if (id === 'toggle-focus-mode') setFocusMode(!useFocusModeStore.getState().isOn);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isFocusModeShortcut(event)) {
        event.preventDefault();
        setFocusMode(!useFocusModeStore.getState().isOn);
        return;
      }
      if (event.key !== 'Escape' || !useFocusModeStore.getState().isOn || hasEscapeTarget()) return;
      // Overlays are checked now, before their own handlers close them; whether
      // another handler claimed the key is known only after they have all run.
      window.setTimeout(() => {
        if (useFocusModeStore.getState().isOn && shouldLeaveOnEscape(event)) setFocusMode(false);
      }, 0);
    };
    window.addEventListener(WORKSPACE_COMMAND_EVENT, onCommand);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener(WORKSPACE_COMMAND_EVENT, onCommand);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [setFocusMode]);

  return {isOn, announcement};
}
