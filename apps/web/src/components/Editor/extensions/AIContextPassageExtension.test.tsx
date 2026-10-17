import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {afterEach, describe, expect, it} from 'vitest';
import {
  aiContextPassageKey,
  createAIContextPassageExtension,
  setAIContextPassage
} from './AIContextPassageExtension';

let editor: Editor | null = null;

const createEditor = () => {
  editor = new Editor({
    extensions: [StarterKit, createAIContextPassageExtension()],
    content: '<p>Sera waits beside the gate.</p>'
  });
  return editor;
};

const markedText = (instance: Editor) =>
  Array.from(instance.view.dom.querySelectorAll('.ai-context-passage'))
    .map((node) => node.textContent)
    .join('');

describe('AIContextPassageExtension', () => {
  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  it('marks the passage without changing the saved content or undo history', () => {
    const instance = createEditor();
    const before = instance.getHTML();

    instance.view.dispatch(setAIContextPassage(instance.state.tr, {from: 1, to: 5}));

    expect(markedText(instance)).toBe('Sera');
    expect(instance.getHTML()).toBe(before);
    expect(instance.can().undo()).toBe(false);
  });

  it('follows edits before the passage and clears when the passage is deleted', () => {
    const instance = createEditor();
    instance.view.dispatch(setAIContextPassage(instance.state.tr, {from: 1, to: 5}));

    instance.view.dispatch(instance.state.tr.insertText('Old ', 1));
    expect(markedText(instance)).toBe('Sera');

    const range = aiContextPassageKey.getState(instance.state);
    instance.view.dispatch(instance.state.tr.delete(range!.from, range!.to));
    expect(aiContextPassageKey.getState(instance.state)).toBeNull();
    expect(markedText(instance)).toBe('');
  });

  it('does not grow when the author types at either edge', () => {
    const instance = createEditor();
    instance.view.dispatch(setAIContextPassage(instance.state.tr, {from: 1, to: 5}));

    instance.view.dispatch(instance.state.tr.insertText('X', 5));
    instance.view.dispatch(instance.state.tr.insertText('Y', 1));

    expect(markedText(instance)).toBe('Sera');
  });

  it('removes the mark when cleared', () => {
    const instance = createEditor();
    instance.view.dispatch(setAIContextPassage(instance.state.tr, {from: 1, to: 5}));
    instance.view.dispatch(setAIContextPassage(instance.state.tr, null));

    expect(markedText(instance)).toBe('');
  });
});
