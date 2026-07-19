import {describe, expect, it} from 'vitest';
import {
  captureStateMutationAnchor,
  normalizeStateMutationPosition,
  resolveStateMutationAnchor,
  type EditorTextSnapshot
} from './stateMutationAnchor';

const snapshot = (text: string, editorStart = 1): EditorTextSnapshot => ({
  text,
  spans: [{textStart: 0, textEnd: text.length, editorStart}]
});

describe('state mutation anchors', () => {
  it('captures and resolves an exact cursor anchor', () => {
    const current = snapshot('Aria drinks the potion and raises the gate.');
    const anchor = captureStateMutationAnchor(current, 23);
    expect(resolveStateMutationAnchor({snapshot: current, anchor, originalPosition: 23})).toEqual({
      status: 'exact',
      position: 23,
      textOffset: 22
    });
  });

  it('moves an anchor when unique text is inserted before it', () => {
    const original = snapshot('Aria drinks the potion and raises the gate.');
    const anchor = captureStateMutationAnchor(original, 23);
    const updated = snapshot('At dawn, Aria drinks the potion and raises the gate.');
    expect(resolveStateMutationAnchor({snapshot: updated, anchor, originalPosition: 23})).toEqual({
      status: 'moved',
      position: 32,
      textOffset: 31
    });
  });

  it('normalizes a whole-document selection boundary to the last text position', () => {
    const current = snapshot('drink potion');
    const documentBoundary = current.text.length + 2;

    expect(normalizeStateMutationPosition(current, 0)).toBe(1);
    expect(normalizeStateMutationPosition(current, documentBoundary)).toBe(
      current.text.length + 1
    );
  });

  it('refuses to guess when the anchor is duplicated or removed', () => {
    const short = snapshot('drink potion');
    const anchor = captureStateMutationAnchor(short, 6);
    expect(
      resolveStateMutationAnchor({
        snapshot: snapshot('drink potion drink potion'),
        anchor,
        originalPosition: 6
      })
    ).toEqual({status: 'unresolved'});
    expect(
      resolveStateMutationAnchor({
        snapshot: snapshot('the bottle breaks'),
        anchor,
        originalPosition: 6
      })
    ).toEqual({status: 'unresolved'});
  });
});
