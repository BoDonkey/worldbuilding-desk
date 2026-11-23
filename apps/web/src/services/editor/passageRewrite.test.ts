import 'fake-indexeddb/auto';
import {getSchema} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {Fragment, type Node as PMNode} from 'prosemirror-model';
import {EditorState} from 'prosemirror-state';
import {describe, expect, it} from 'vitest';
import {getSceneSnapshots} from '../storage';
import {findDeletedScenes} from './draftMilestones';
import {
  buildPassageRewrite,
  defaultAlternativeName,
  findPassage,
  mapPassageRange,
  passageText,
  savePassageAlternative
} from './passageRewrite';
import {selectSnapshotsToPrune, takeSceneSnapshot} from './sceneSnapshots';

const schema = getSchema([StarterKit]);
const paragraph = (text: string) => schema.node('paragraph', null, text ? [schema.text(text)] : []);
const docOf = (...paragraphs: string[]) => schema.node('doc', null, paragraphs.map(paragraph));
const blocks = (...paragraphs: string[]) => Fragment.from(paragraphs.map(paragraph));
const texts = (doc: PMNode) => doc.content.content.map((node) => node.textContent);

describe('finding a passage', () => {
  const doc = docOf('Rain fell on the gate.', 'She waited. Nobody came.', 'She waited.');

  it('finds a passage inside a paragraph and across paragraphs', () => {
    const inside = findPassage(doc, 'fell on the gate')!;
    expect(passageText(doc, inside)).toBe('fell on the gate');
    const across = findPassage(doc, 'the gate.\n\nShe waited. Nobody')!;
    expect(passageText(doc, across)).toBe('the gate.\n\nShe waited. Nobody');
  });

  it('finds nothing for missing or repeated text', () => {
    expect(findPassage(doc, 'snow')).toBeNull();
    expect(findPassage(doc, 'She waited.')).toBeNull();
    expect(findPassage(doc, '')).toBeNull();
  });
});

describe('using a rewrite', () => {
  const state = EditorState.create({doc: docOf('Rain fell on the gate.', 'She waited. Nobody came.')});

  it('replaces a passage inside a paragraph, keeping the text around it', () => {
    const range = findPassage(state.doc, 'fell on the gate')!;
    const result = buildPassageRewrite(state, range, 'fell on the gate', blocks('hammered the iron gate'));
    expect(result.ok && texts(result.transaction.doc)).toEqual(['Rain hammered the iron gate.', 'She waited. Nobody came.']);
  });

  it('replaces a passage across paragraphs with more paragraphs', () => {
    const original = 'the gate.\n\nShe waited.';
    const range = findPassage(state.doc, original)!;
    const result = buildPassageRewrite(state, range, original, blocks('the gate, then stopped.', 'Silence.', 'She waited.'));
    expect(result.ok && texts(result.transaction.doc)).toEqual([
      'Rain fell on the gate, then stopped.',
      'Silence.',
      'She waited. Nobody came.'
    ]);
  });

  it('still applies after an edit elsewhere in the scene', () => {
    let range = findPassage(state.doc, 'Nobody came.')!;
    const edit = state.tr.insertText('Cold. ', 1);
    range = mapPassageRange(range, edit)!;
    const edited = state.apply(edit);
    const result = buildPassageRewrite(edited, range, 'Nobody came.', blocks('Someone came.'));
    expect(result.ok && texts(result.transaction.doc)).toEqual(['Cold. Rain fell on the gate.', 'She waited. Someone came.']);
  });

  it('refuses when the original passage changed while the rewrite was open', () => {
    let range = findPassage(state.doc, 'fell on the gate')!;
    const edit = state.tr.insertText('X', range.from + 2);
    range = mapPassageRange(range, edit)!;
    const edited = state.apply(edit);
    expect(buildPassageRewrite(edited, range, 'fell on the gate', blocks('hammered'))).toEqual({ok: false, reason: 'changed'});
    expect(buildPassageRewrite(state, null, 'fell on the gate', blocks('hammered'))).toEqual({ok: false, reason: 'changed'});
  });

  it('refuses an empty rewrite', () => {
    const range = findPassage(state.doc, 'fell on the gate')!;
    expect(buildPassageRewrite(state, range, 'fell on the gate', blocks(''))).toEqual({ok: false, reason: 'empty'});
  });

  it('loses the range when the passage is deleted', () => {
    const range = findPassage(state.doc, 'fell on the gate')!;
    expect(mapPassageRange(range, state.tr.delete(range.from - 1, range.to + 1))).toBeNull();
  });
});

describe('passage alternatives', () => {
  it('names an alternative after the passage', () => {
    expect(defaultAlternativeName('Rain fell on the gate.')).toBe('Alternative: “Rain fell on the gate.”');
    expect(defaultAlternativeName('one two three four five six seven')).toBe('Alternative: “one two three four five six…”');
  });

  it('are saved, never pruned, never dedupe scene snapshots, and never restore a deleted scene', async () => {
    const projectId = crypto.randomUUID();
    const sceneId = crypto.randomUUID();
    const scene = '<p>Rain fell on the gate.</p>';
    await takeSceneSnapshot({projectId, sceneId, content: scene, kind: 'manual', now: 1});
    const alternative = await savePassageAlternative({
      projectId, sceneId, originalHtml: '<p>fell on the gate</p>', originalText: 'fell on the gate',
      rewriteHtml: '<p>hammered the gate</p>', now: 2
    });
    expect(alternative).toMatchObject({kind: 'alternative', content: '<p>hammered the gate</p>', wordCount: 3});
    // The newest whole-scene snapshot already has this text, so no automatic copy is added.
    await takeSceneSnapshot({projectId, sceneId, content: scene, kind: 'before-rewrite', now: 3});
    const saved = await getSceneSnapshots(projectId, sceneId);
    expect(saved.map((snapshot) => snapshot.kind)).toEqual(['alternative', 'manual']);
    expect(selectSnapshotsToPrune(saved, 0)).toEqual([]);
    expect(findDeletedScenes([alternative], [])).toEqual([]);
  });
});
