import {afterEach, describe, expect, it} from 'vitest';
import {Editor} from '@tiptap/core';
import {defaultEditorConfig} from '../config/editorConfig';
import {applySceneRevision} from '../services/assistant/sceneRevision';
import {buildScenesMarkdown} from '../utils/sceneExport';
import type {AITextProvenance} from '../services/editor/aiTextProvenance';
import {AI_TEXT_MARK, clearAITextMark, insertAIText, selectionHasAIText} from './AITextMark';

const provenance: AITextProvenance = {
  origin: 'character-scene',
  provider: 'ollama',
  model: 'qwen3:8b',
  route: 'private-local',
  at: 1_700_000_000_000
};

const editors: Editor[] = [];
function makeEditor(content = '<p>Alpha content</p>') {
  const editor = new Editor({extensions: defaultEditorConfig.extensions, content});
  editors.push(editor);
  return editor;
}

function markedText(editor: Editor): string {
  const markType = editor.schema.marks[AI_TEXT_MARK]!;
  let text = '';
  editor.state.doc.descendants((node) => {
    if (node.isText && markType.isInSet(node.marks)) text += node.text;
  });
  return text;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('aiText mark', () => {
  it('marks exactly the inserted model text, with its provenance, in one undoable step', () => {
    const editor = makeEditor();
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    expect(insertAIText(editor, ' Borin laughs.', provenance)).toBe(true);

    expect(editor.getText()).toBe('Alpha content Borin laughs.');
    expect(markedText(editor)).toBe(' Borin laughs.');
    expect(editor.getHTML()).toContain(
      'data-ai-text="character-scene" data-ai-provider="ollama" data-ai-model="qwen3:8b" data-ai-route="private-local" data-ai-at="1700000000000"'
    );

    editor.commands.undo();
    expect(editor.getText()).toBe('Alpha content');
    expect(markedText(editor)).toBe('');
  });

  it('marks inserted HTML paragraphs, which land after the cursor paragraph', () => {
    const editor = makeEditor();
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    insertAIText(editor, '<p>Aria: "Put the hammer down."</p><p>Borin laughs, and does not.</p>', provenance);

    expect(editor.getText()).toContain('Alpha content');
    expect(markedText(editor)).toBe('Aria: "Put the hammer down."Borin laughs, and does not.');
    editor.commands.undo();
    expect(markedText(editor)).toBe('');
    expect(editor.getText()).toBe('Alpha content');
  });

  it('leaves typing next to marked text unmarked but keeps edits inside it marked', () => {
    const editor = makeEditor('<p></p>');
    insertAIText(editor, 'Borin laughs.', provenance);
    editor.commands.insertContent(' Aria frowns.');
    expect(markedText(editor)).toBe('Borin laughs.');

    editor.commands.setTextSelection(3);
    editor.commands.insertContent('X');
    expect(markedText(editor)).toBe('BoXrin laughs.');
  });

  it('survives a save and reload through scene HTML', () => {
    const editor = makeEditor('<p></p>');
    insertAIText(editor, 'Borin laughs.', provenance);
    const reloaded = makeEditor(editor.getHTML());

    expect(markedText(reloaded)).toBe('Borin laughs.');
    const mark = reloaded.state.doc.firstChild?.firstChild?.marks[0];
    expect(mark?.attrs).toEqual({...provenance});
  });

  it('clears the mark from a selection, or from the whole passage at the cursor', () => {
    const editor = makeEditor('<p></p>');
    insertAIText(editor, 'Borin laughs and does not.', provenance);
    editor.commands.setTextSelection({from: 1, to: 6});
    expect(selectionHasAIText(editor)).toBe(true);
    clearAITextMark(editor);
    expect(markedText(editor)).toBe(' laughs and does not.');

    editor.commands.setTextSelection(12);
    clearAITextMark(editor);
    expect(markedText(editor)).toBe('');
    expect(editor.getText()).toBe('Borin laughs and does not.');
  });

  it('marks a reviewed scene revision only when a model wrote it', () => {
    const marked = makeEditor();
    const unmarked = makeEditor();
    const revision = (editor: Editor, withProvenance: boolean) => ({
      projectId: 'p',
      documentId: 'd',
      sourceContent: editor.getHTML(),
      selectedText: '',
      range: null,
      text: 'A new\u200B paragraph\u202Fhere.',
      ...(withProvenance ? {provenance: {...provenance, origin: 'scene-revision' as const}} : {})
    });

    expect(applySceneRevision(marked, revision(marked, true), 'p', 'd')).toBe(true);
    expect(markedText(marked)).toBe('A new paragraph here.');
    expect(applySceneRevision(unmarked, revision(unmarked, false), 'p', 'd')).toBe(true);
    expect(markedText(unmarked)).toBe('');
  });

  it('never carries the mark into exported text', () => {
    const markdown = buildScenesMarkdown({
      projectName: 'P',
      scenes: [{
        id: 's1', projectId: 'p', title: 'One', createdAt: 1, updatedAt: 1,
        content: '<p>Alpha <span class="ai-text" data-ai-text="scene-revision" data-ai-provider="ollama">Borin laughs.</span></p>'
      }]
    } as never);
    expect(markdown).toContain('Alpha Borin laughs.');
    expect(markdown).not.toMatch(/data-ai|ai-text/);
  });
});
