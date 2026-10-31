import {act, render} from '@testing-library/react';
import {beforeAll, describe, expect, it} from 'vitest';
import type {Editor as TipTapEditorInstance} from '@tiptap/react';
import TipTapEditor from './TipTapEditor';

// jsdom has no layout; ProseMirror asks for rects when scrolling the caret into view.
beforeAll(() => {
  const emptyRects = () => Object.assign([], {item: () => null}) as unknown as DOMRectList;
  Range.prototype.getClientRects = emptyRects;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  Element.prototype.getClientRects = emptyRects;
});

const flushTimers = () => act(() => new Promise((resolve) => setTimeout(resolve, 5)));

function renderEditor(initial: string) {
  const emitted: string[] = [];
  let editor: TipTapEditorInstance | null = null;
  const props = {
    onChange: (html: string) => emitted.push(html),
    onEditorReady: (instance: TipTapEditorInstance) => {
      editor = instance;
    }
  };
  const view = render(<TipTapEditor content={initial} {...props} />);
  const rerender = (content: string) => view.rerender(<TipTapEditor content={content} {...props} />);
  return {emitted, rerender, getEditor: () => editor as unknown as TipTapEditorInstance};
}

describe('TipTapEditor external content sync', () => {
  it('ignores a late echo of text the editor already emitted', async () => {
    const {emitted, rerender, getEditor} = renderEditor('<p>A</p>');
    const editor = getEditor();
    act(() => {
      editor.commands.focus('end');
      editor.commands.insertContent('B');
      editor.commands.insertContent('C');
    });
    expect(emitted).toEqual(['<p>AB</p>', '<p>ABC</p>']);
    const selection = editor.state.selection.from;
    await flushTimers();

    // A slow parent render delivers the older keystroke after the newer one.
    rerender('<p>AB</p>');
    await flushTimers();

    expect(editor.getHTML()).toBe('<p>ABC</p>');
    expect(editor.state.selection.from).toBe(selection);
  });

  it('still applies a genuine external replacement', async () => {
    const {rerender, getEditor} = renderEditor('<p>A</p>');
    act(() => {
      getEditor().commands.focus('end');
      getEditor().commands.insertContent('B');
    });
    await flushTimers();

    rerender('<p>Revised scene</p>');
    await flushTimers();

    expect(getEditor().getHTML()).toBe('<p>Revised scene</p>');
  });
});
