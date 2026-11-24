// @vitest-environment jsdom
import {afterEach, describe, expect, it} from 'vitest';
import {hasEscapeTarget, isFocusModeShortcut, shouldLeaveOnEscape} from './useWorkspaceFocusMode';
import {APPEARANCE_DEFAULTS, APPEARANCE_KEYS, FOCUS_MODE_STARTS, readChoice} from '../services/editor/editorAppearance';

const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', {cancelable: true, ...init});

/** A keydown dispatched from `target`, optionally cancelled by an earlier handler. */
const escapeFrom = (target: Element, cancelled = false) => {
  const event = key({key: 'Escape', bubbles: true});
  if (cancelled) target.addEventListener('keydown', (e) => e.preventDefault(), {once: true});
  target.dispatchEvent(event);
  return event;
};

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('isFocusModeShortcut', () => {
  it('is Cmd or Ctrl with Shift and F', () => {
    expect(isFocusModeShortcut(key({code: 'KeyF', metaKey: true, shiftKey: true}))).toBe(true);
    expect(isFocusModeShortcut(key({code: 'KeyF', ctrlKey: true, shiftKey: true}))).toBe(true);
  });

  it('leaves Find (no Shift) and other combinations alone', () => {
    expect(isFocusModeShortcut(key({code: 'KeyF', metaKey: true}))).toBe(false);
    expect(isFocusModeShortcut(key({code: 'KeyF', shiftKey: true}))).toBe(false);
    expect(isFocusModeShortcut(key({code: 'KeyF', ctrlKey: true, shiftKey: true, altKey: true}))).toBe(false);
  });
});

describe('Escape', () => {
  it('leaves from the editor even though ProseMirror cancels the key', () => {
    document.body.innerHTML = '<div class="ProseMirror" contenteditable="true"><p id="p">Text</p></div>';
    const event = escapeFrom(document.getElementById('p')!, true);
    expect(shouldLeaveOnEscape(event)).toBe(true);
  });

  it('does not leave when an overlay is open', () => {
    document.body.innerHTML =
      '<div class="ProseMirror"><p id="p">Text</p></div><div data-escape-layer>Selection menu</div>';
    expect(hasEscapeTarget()).toBe(true);
    expect(shouldLeaveOnEscape(escapeFrom(document.getElementById('p')!))).toBe(false);

    document.body.innerHTML = '<div role="dialog">Snapshots</div><button id="b">x</button>';
    expect(shouldLeaveOnEscape(escapeFrom(document.getElementById('b')!))).toBe(false);
  });

  it('outside the editor, leaves only when no other handler claimed the key', () => {
    document.body.innerHTML = '<input id="find" /><button id="b">Leave</button>';
    expect(shouldLeaveOnEscape(escapeFrom(document.getElementById('find')!, true))).toBe(false);
    expect(shouldLeaveOnEscape(escapeFrom(document.getElementById('b')!))).toBe(true);
  });

  it('ignores other keys', () => {
    document.body.innerHTML = '<div class="ProseMirror"><p id="p">Text</p></div>';
    const event = key({key: 'Enter', bubbles: true});
    document.getElementById('p')!.dispatchEvent(event);
    expect(shouldLeaveOnEscape(event)).toBe(false);
  });
});

describe('focus mode start setting', () => {
  it('is off by default and for unknown stored values', () => {
    expect(readChoice(APPEARANCE_KEYS.focusModeStart, FOCUS_MODE_STARTS, APPEARANCE_DEFAULTS.focusModeStart)).toBe('off');
    localStorage.setItem(APPEARANCE_KEYS.focusModeStart, 'true');
    expect(readChoice(APPEARANCE_KEYS.focusModeStart, FOCUS_MODE_STARTS, APPEARANCE_DEFAULTS.focusModeStart)).toBe('off');
    localStorage.setItem(APPEARANCE_KEYS.focusModeStart, 'on');
    expect(readChoice(APPEARANCE_KEYS.focusModeStart, FOCUS_MODE_STARTS, APPEARANCE_DEFAULTS.focusModeStart)).toBe('on');
  });
});
