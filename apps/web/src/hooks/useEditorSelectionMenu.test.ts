import {describe, expect, it} from 'vitest';
import {clampIntoViewport, normalizeSelectionSurface} from './useEditorSelectionMenu';

const viewport = {width: 1000, height: 800};

describe('clampIntoViewport', () => {
  it('leaves a menu that fits where it is', () => {
    expect(clampIntoViewport({left: 100, right: 400, top: 100, bottom: 140}, viewport)).toEqual({dx: 0, dy: 0});
  });

  it('pulls a menu back in from the left, right, and top edges', () => {
    expect(clampIntoViewport({left: -120, right: 180, top: 100, bottom: 140}, viewport).dx).toBe(128);
    expect(clampIntoViewport({left: 800, right: 1100, top: 100, bottom: 140}, viewport).dx).toBe(-108);
    expect(clampIntoViewport({left: 100, right: 400, top: -20, bottom: 20}, viewport).dy).toBe(28);
  });

  it('lines up a menu wider than the window with its left margin', () => {
    expect(clampIntoViewport({left: 10, right: 1200, top: 100, bottom: 140}, viewport).dx).toBe(-2);
  });
});

describe('normalizeSelectionSurface', () => {
  it('matches names regardless of case and punctuation', () => {
    expect(normalizeSelectionSurface('  Sera   Kestrel, ')).toBe('sera kestrel');
  });
});
