// @vitest-environment jsdom
import {afterEach, describe, expect, it} from 'vitest';
import {Editor} from '@tiptap/core';
import {defaultEditorConfig} from '../../config/editorConfig';
import {clearAITextMark, insertAIText} from '../../extensions/AITextMark';
import type {AITextProvenance} from './aiTextProvenance';
import {buildAITextReport, formatAITextReport} from './aiTextReport';

const local: AITextProvenance = {
  origin: 'character-scene', provider: 'ollama', model: 'qwen3:8b', route: 'private-local', at: 1_700_000_000_000
};
const hosted: AITextProvenance = {
  origin: 'scene-revision', provider: 'anthropic', model: 'claude-x', route: 'hosted', at: 1_700_000_000_500
};

const editors: Editor[] = [];
function makeEditor(content: string) {
  const editor = new Editor({extensions: defaultEditorConfig.extensions, content});
  editors.push(editor);
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

const span = (provenance: AITextProvenance, text: string) =>
  `<span data-ai-text="${provenance.origin}" data-ai-provider="${provenance.provider}" ` +
  `data-ai-model="${provenance.model}" data-ai-route="${provenance.route}" data-ai-at="${provenance.at}">${text}</span>`;

describe('AI text report', () => {
  it('counts marked words and passages per scene, by origin and provider', () => {
    const report = buildAITextReport([
      {id: 'a', title: 'Opening', content: `<p>I wrote this. ${span(local, 'The model wrote these five words.')}</p>`},
      {id: 'b', title: '', content: '<p>All mine, nothing marked here.</p>'},
      {
        id: 'c',
        title: 'Storm',
        content: `<p>${span(hosted, 'Rain fell hard.')}</p><p>${span(hosted, 'Thunder followed.')}</p>` +
          `<p>Then I wrote. ${span(local, 'Lightning answered.')}</p>`
      }
    ]);

    expect(report).toMatchObject({sceneCount: 3, totalWords: 9 + 5 + 10, markedWords: 6 + 5 + 2, passages: 3});
    expect(report.scenes.map((scene) => [scene.title, scene.markedWords, scene.passages])).toEqual([
      ['Opening', 6, 1],
      ['Storm', 7, 2]
    ]);
    // One multi-paragraph insert is one passage.
    expect(report.scenes[1].groups).toEqual([
      {origin: 'scene-revision', provider: 'anthropic', models: ['claude-x'], words: 5, passages: 1},
      {origin: 'character-scene', provider: 'ollama', models: ['qwen3:8b'], words: 2, passages: 1}
    ]);
    expect(report.groups).toEqual([
      {origin: 'character-scene', provider: 'ollama', models: ['qwen3:8b'], words: 8, passages: 2},
      {origin: 'scene-revision', provider: 'anthropic', models: ['claude-x'], words: 5, passages: 1}
    ]);
  });

  it('reads editor HTML: inner formatting stays one passage, Mark as my writing splits it', () => {
    const editor = makeEditor('<p>Start.</p>');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    insertAIText(editor, ' One <strong>bold</strong> two three four.', local);
    let report = buildAITextReport([{id: 's', title: 'S', content: editor.getHTML()}]);
    expect(report).toMatchObject({markedWords: 5, passages: 1, totalWords: 6});

    let from = 0;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text?.includes('two')) from = pos + node.text.indexOf('two');
    });
    editor.commands.setTextSelection({from, to: from + 'two'.length});
    clearAITextMark(editor);
    report = buildAITextReport([{id: 's', title: 'S', content: editor.getHTML()}]);
    expect(report).toMatchObject({markedWords: 4, passages: 2, totalWords: 6});
  });

  it('counts a word the author extended, and ignores marked whitespace or punctuation alone', () => {
    const report = buildAITextReport([
      {id: 'a', title: 'A', content: `<p>${span(local, 'Shadow')}s fell.${span(local, ' ')}${span(hosted, '—')}</p>`}
    ]);
    expect(report).toMatchObject({markedWords: 1, passages: 1, totalWords: 2});
  });

  it('keeps unknown provenance visible instead of dropping it', () => {
    const report = buildAITextReport([
      {id: 'a', title: 'A', content: '<p><span data-ai-text="something-new">Odd words</span></p>'}
    ]);
    expect(report.groups).toEqual([{origin: 'unknown', provider: 'unknown', models: [], words: 2, passages: 1}]);
  });

  it('formats a plain-text record with platform-neutral notes', () => {
    const empty = formatAITextReport(
      buildAITextReport([{id: 'a', title: 'A', content: '<p>Mine.</p>'}]), 'Saga', new Date(0)
    );
    expect(empty).toContain('No marked AI text in 1 scene (1 word).');

    const text = formatAITextReport(
      buildAITextReport([{id: 'a', title: 'Opening', content: `<p>Mine. ${span(local, 'Two words')}</p>`}]),
      'Saga',
      new Date(0)
    );
    expect(text).toContain('AI text report — Saga');
    expect(text).toContain('2 words in 1 passage, across 1 scene of 1.');
    expect(text).toContain('- Character scene · Ollama (Local) · qwen3:8b: 2 words in 1 passage');
    expect(text).toContain('- Opening: 2 words in 1 passage of 3 words');
    expect(text).toContain('Some publishing platforms ask');
    expect(text).not.toMatch(/amazon|kdp|kindle/i);
  });
});
