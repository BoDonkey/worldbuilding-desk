// @vitest-environment jsdom
import {describe, expect, it} from 'vitest';
import {
  clearSavedEditorScrollTop,
  readSavedEditorScrollTop,
  writeSavedEditorScrollTop
} from './editorScrollStore';

describe('editorScrollStore', () => {
  it('remembers a position per scroll key and mirrors it on window', () => {
    writeSavedEditorScrollTop('scene-a', 640);
    writeSavedEditorScrollTop('scene-b', 120);
    expect(readSavedEditorScrollTop('scene-a')).toBe(640);
    expect(readSavedEditorScrollTop('scene-b')).toBe(120);
    expect(window.__wbdEditorScrollPositions?.['scene-a']).toBe(640);
  });

  it('reads 0 for an unknown key and ignores non-finite positions', () => {
    expect(readSavedEditorScrollTop('never-saved')).toBe(0);
    writeSavedEditorScrollTop('scene-c', 300);
    writeSavedEditorScrollTop('scene-c', Number.NaN);
    expect(readSavedEditorScrollTop('scene-c')).toBe(300);
  });

  it('clears a saved position back to the top', () => {
    writeSavedEditorScrollTop('scene-d', 900);
    clearSavedEditorScrollTop('scene-d');
    expect(readSavedEditorScrollTop('scene-d')).toBe(0);
    expect(window.__wbdEditorScrollPositions?.['scene-d']).toBe(0);
  });
});
