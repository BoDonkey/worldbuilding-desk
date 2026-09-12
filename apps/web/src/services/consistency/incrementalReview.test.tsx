import {describe, expect, it} from 'vitest';
import type {WritingDocument} from '../../entityTypes';
import {
  countStaleReviewItems,
  hashReviewInputs,
  hashSceneContent,
  markStaleReviewItems,
  planIncrementalReview
} from './incrementalReview';
import type {ProjectReviewRun} from './projectReviewRunStorage';

// .test.tsx: hashSceneContent strips HTML through the DOM (jsdom project).
const doc = (id: string, content: string): WritingDocument => ({
  id,
  projectId: 'p',
  title: id,
  content,
  createdAt: 1,
  updatedAt: 1
});

const known = [{id: 'sera', name: 'Sera Kestrel', type: 'entity' as const}];

const storedRun = (inputsHash: string, scenes: Array<[string, string]>): ProjectReviewRun => ({
  id: 'p',
  projectId: 'p',
  inputsHash,
  reviewedAt: 10,
  scenes: scenes.map(([sceneId, content]) => ({
    sceneId,
    contentHash: hashSceneContent(doc(sceneId, content)),
    issues: [],
    issueAnnotations: [],
    reviewedAt: 10
  })),
  items: []
});

describe('incremental review planning', () => {
  it('hashes text, not markup, and includes the review mode', () => {
    expect(hashSceneContent(doc('a', '<p>Sera walked.</p>'))).toBe(
      hashSceneContent(doc('a', '<p><em>Sera</em> walked.</p>'))
    );
    expect(hashSceneContent(doc('a', '<p>Sera walked.</p>'))).not.toBe(hashSceneContent(doc('a', '<p>Sera ran.</p>')));
    expect(hashSceneContent({content: '<p>x</p>', consistencyReviewMode: 'deferred'})).not.toBe(
      hashSceneContent({content: '<p>x</p>'})
    );
  });

  it('reuses unchanged scenes and reviews changed or new ones', () => {
    const inputsHash = hashReviewInputs({knownEntities: known, actionCues: [], engineLabel: 'deterministic'});
    const plan = planIncrementalReview({
      documents: [doc('a', '<p>same</p>'), doc('b', '<p>edited</p>'), doc('c', '<p>new</p>')],
      storedRun: storedRun(inputsHash, [
        ['a', '<p>same</p>'],
        ['b', '<p>original</p>']
      ]),
      inputsHash
    });
    expect(Array.from(plan.reusable.keys())).toEqual(['a']);
    expect(plan.toReview.map((entry) => entry.id)).toEqual(['b', 'c']);
  });

  it('reviews everything when the non-text inputs changed', () => {
    const before = hashReviewInputs({knownEntities: known, actionCues: [], engineLabel: 'deterministic'});
    const after = hashReviewInputs({
      knownEntities: [...known, {id: 'tam', name: 'Tam', type: 'entity'}],
      actionCues: [],
      engineLabel: 'deterministic'
    });
    expect(before).not.toBe(after);
    const plan = planIncrementalReview({
      documents: [doc('a', '<p>same</p>')],
      storedRun: storedRun(before, [['a', '<p>same</p>']]),
      inputsHash: after
    });
    expect(plan.reusable.size).toBe(0);
    expect(plan.toReview.map((entry) => entry.id)).toEqual(['a']);
  });

  it('input hashing is order-independent', () => {
    const a = hashReviewInputs({
      knownEntities: [
        {id: '1', name: 'A', type: 'entity'},
        {id: '2', name: 'B', type: 'entity'}
      ],
      actionCues: ['x', 'y'],
      engineLabel: 'e'
    });
    const b = hashReviewInputs({
      knownEntities: [
        {id: '2', name: 'B', type: 'entity'},
        {id: '1', name: 'A', type: 'entity'}
      ],
      actionCues: ['y', 'x'],
      engineLabel: 'e'
    });
    expect(a).toBe(b);
  });

  it('marks items stale when their scene text changed or the scene is gone', () => {
    const run = storedRun('h', [
      ['a', '<p>same</p>'],
      ['b', '<p>original</p>']
    ]);
    const items = [
      {id: 'i1', sceneId: 'a', sceneTitle: 'a', issue: {code: 'UNKNOWN_ENTITY' as const, severity: 'warning' as const, message: 'm'}},
      {id: 'i2', sceneId: 'b', sceneTitle: 'b', issue: {code: 'UNKNOWN_ENTITY' as const, severity: 'warning' as const, message: 'm'}},
      {id: 'i3', sceneId: 'gone', sceneTitle: 'gone', issue: {code: 'STATE_CONFLICT' as const, severity: 'blocking' as const, message: 'm'}}
    ];
    const marked = markStaleReviewItems({
      items,
      documents: [doc('a', '<p>same</p>'), doc('b', '<p>edited</p>')],
      storedScenes: run.scenes
    });
    expect(marked.map((item) => Boolean(item.staleSinceReview))).toEqual([false, true, true]);
    expect(marked[0]).toBe(items[0]);
    expect(countStaleReviewItems(marked)).toBe(2);
  });
});
