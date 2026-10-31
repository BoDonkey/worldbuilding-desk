/*
 * Remembered manuscript scroll positions, per editor scroll key, for the
 * current app session. Kept in memory and mirrored on `window` so a remounted
 * editor (and browser tests) can read the last position. Never persisted.
 */

declare global {
  interface Window {
    __wbdEditorScrollPositions?: Record<string, number>;
  }
}

const editorScrollPositions = new Map<string, number>();

const getWindowEditorScrollStore = () => {
  if (typeof window === 'undefined') return null;
  window.__wbdEditorScrollPositions ??= {};
  return window.__wbdEditorScrollPositions;
};

/** The saved position, or 0 when none is saved or it is not a positive number. */
export const readSavedEditorScrollTop = (scrollKey: string): number => {
  const store = getWindowEditorScrollStore();
  const candidates = [editorScrollPositions.get(scrollKey), store?.[scrollKey]];
  return (
    candidates.find(
      (candidate): candidate is number =>
        typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0
    ) ?? 0
  );
};

export const writeSavedEditorScrollTop = (scrollKey: string, scrollTop: number): void => {
  if (!Number.isFinite(scrollTop)) return;
  editorScrollPositions.set(scrollKey, scrollTop);
  const store = getWindowEditorScrollStore();
  if (!store) return;
  store[scrollKey] = scrollTop;
};

export const clearSavedEditorScrollTop = (scrollKey: string): void => {
  editorScrollPositions.set(scrollKey, 0);
  const store = getWindowEditorScrollStore();
  if (store) {
    store[scrollKey] = 0;
  }
};
