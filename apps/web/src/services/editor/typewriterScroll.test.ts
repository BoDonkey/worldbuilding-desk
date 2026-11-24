import {describe, expect, it} from 'vitest';
import {isTypingChange, typewriterScrollTarget} from './typewriterScroll';

const base = {viewTop: 100, viewHeight: 600, scrollTop: 1000, maxScrollTop: 5000};

describe('typewriterScrollTarget', () => {
  it('scrolls so the caret line sits a third of the way down', () => {
    // The target line is at 100 + 200 = 300; a caret at 650 is 350 too low.
    expect(typewriterScrollTarget({...base, caretTop: 650})).toBe(1350);
    // A caret above the line scrolls back up.
    expect(typewriterScrollTarget({...base, caretTop: 150})).toBe(850);
  });

  it('leaves the area alone within the tolerance', () => {
    expect(typewriterScrollTarget({...base, caretTop: 303})).toBeNull();
    expect(typewriterScrollTarget({...base, caretTop: 297})).toBeNull();
  });

  it('stops at the top and the bottom of the scroll range', () => {
    expect(typewriterScrollTarget({...base, scrollTop: 50, caretTop: 120})).toBe(0);
    expect(typewriterScrollTarget({...base, scrollTop: 0, caretTop: 120})).toBeNull();
    expect(typewriterScrollTarget({...base, scrollTop: 4900, caretTop: 900})).toBe(5000);
    expect(typewriterScrollTarget({...base, scrollTop: 5000, caretTop: 900})).toBeNull();
  });

  it('does nothing for an area with no height', () => {
    expect(typewriterScrollTarget({...base, viewHeight: 0, caretTop: 650})).toBeNull();
  });

  it('takes another ratio', () => {
    expect(typewriterScrollTarget({...base, caretTop: 650, ratio: 0.5})).toBe(1250);
  });
});

describe('isTypingChange', () => {
  const now = 10_000;
  const typed = {changed: true, hasFocus: true, lastKeyAt: now - 50, lastPointerAt: 0, now};

  it('is true for an edit or caret move just after a key press', () => {
    expect(isTypingChange(typed)).toBe(true);
  });

  it('is false after a click, a drag, or a wheel scroll', () => {
    expect(isTypingChange({...typed, lastPointerAt: now - 10})).toBe(false);
  });

  it('is false long after the last key, without focus, or with no change', () => {
    expect(isTypingChange({...typed, lastKeyAt: now - 2000})).toBe(false);
    expect(isTypingChange({...typed, hasFocus: false})).toBe(false);
    expect(isTypingChange({...typed, changed: false})).toBe(false);
  });
});
