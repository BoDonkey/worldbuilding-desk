// @vitest-environment jsdom
import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {afterEach, describe, expect, it} from 'vitest';
import {applySceneRevision, type SceneRevision} from './sceneRevision';

let editor: Editor;
function setup(range: SceneRevision['range'] = {from: 1, to: 5}): SceneRevision {
  editor = new Editor({extensions: [StarterKit], content: '<p>Mira waited.</p>'});
  return {projectId: 'p', documentId: 's', sourceContent: editor.getHTML(), selectedText: 'Mira', range, text: 'Sera'};
}
afterEach(() => editor?.destroy());

describe('reviewed scene revisions', () => {
  it('replaces only the reviewed range and supports undo', () => {
    const proposal = setup();
    expect(applySceneRevision(editor, proposal, 'p', 's')).toBe(true);
    expect(editor.getText()).toBe('Sera waited.');
    editor.commands.undo();
    expect(editor.getHTML()).toBe(proposal.sourceContent);
  });

  it('appends at scene end regardless of the current cursor', () => {
    const proposal = setup(null);
    editor.commands.setTextSelection(1);
    expect(applySceneRevision(editor, proposal, 'p', 's')).toBe(true);
    expect(editor.getHTML()).toBe('<p>Mira waited.</p><p>Sera</p>');
  });

  it('refuses stale scene text without changing it', () => {
    const proposal = setup();
    editor.commands.setContent('<p>Mira left.</p>');
    expect(applySceneRevision(editor, proposal, 'p', 's')).toBe(false);
    expect(editor.getHTML()).toBe('<p>Mira left.</p>');
  });

  it('refuses a different project or scene even with identical text', () => {
    const proposal = setup();
    expect(applySceneRevision(editor, proposal, 'other', 's')).toBe(false);
    expect(applySceneRevision(editor, proposal, 'p', 'other')).toBe(false);
    expect(editor.getHTML()).toBe(proposal.sourceContent);
  });

  it('rejects mismatched and invalid ranges instead of clamping them', () => {
    const proposal = setup();
    expect(applySceneRevision(editor, {...proposal, selectedText: 'Bran'}, 'p', 's')).toBe(false);
    for (const range of [{from: -1, to: 5}, {from: 1, to: 500}, {from: 5, to: 1}, {from: 1.5, to: 5}]) {
      expect(applySceneRevision(editor, {...proposal, range}, 'p', 's')).toBe(false);
    }
    expect(editor.getHTML()).toBe(proposal.sourceContent);
  });

  it('inserts model markup literally and preserves line breaks', () => {
    const proposal = setup(null);
    proposal.text = '<img src=x onerror=alert(1)>\nSecond line';
    expect(applySceneRevision(editor, proposal, 'p', 's')).toBe(true);
    expect(editor.getHTML()).toContain('&lt;img');
    expect(editor.getText()).toContain(proposal.text.replace('\n', '\n\n'));
  });
});
