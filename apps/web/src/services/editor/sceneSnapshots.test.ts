import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {SceneSnapshot} from '../../entityTypes';
import {getSceneSnapshots} from '../storage/repositories/sceneSnapshotStorage';
import {
  AUTOMATIC_SNAPSHOTS_KEPT_PER_SCENE,
  compareSnapshotWithCurrent,
  prepareSnapshotRestore,
  selectSnapshotsToPrune,
  takeDailySceneSnapshotIfNeeded,
  takeSceneSnapshot,
  takeSnapshotBeforeSceneDeletion
} from './sceneSnapshots';

const scene = () => ({projectId: crypto.randomUUID(), sceneId: crypto.randomUUID()});
const record = (overrides: Partial<SceneSnapshot>): SceneSnapshot => ({
  id: crypto.randomUUID(), projectId: 'p', sceneId: 's', content: '<p>x</p>', kind: 'daily', wordCount: 1, createdAt: 1,
  ...overrides
});

describe('scene snapshot pruning', () => {
  it('prunes automatic snapshots past the newest 20 and never manual ones', () => {
    const automatic = Array.from({length: 25}, (_, index) => record({id: `auto-${index}`, createdAt: index}));
    const manual = Array.from({length: 30}, (_, index) => record({id: `manual-${index}`, kind: 'manual', createdAt: index}));
    const pruned = selectSnapshotsToPrune([...manual, ...automatic]);
    expect(pruned.sort()).toEqual(['auto-0', 'auto-1', 'auto-2', 'auto-3', 'auto-4'].sort());
  });

  it('prunes in the same write as a new automatic snapshot', async () => {
    const ids = scene();
    for (let index = 0; index < AUTOMATIC_SNAPSHOTS_KEPT_PER_SCENE + 3; index += 1) {
      await takeSceneSnapshot({...ids, content: `<p>Version ${index}</p>`, kind: 'before-ai', now: 1000 + index});
    }
    await takeSceneSnapshot({...ids, content: '<p>Keep me</p>', kind: 'manual', name: 'Draft 1', now: 1});
    const stored = await getSceneSnapshots(ids.projectId, ids.sceneId);
    expect(stored.filter((snapshot) => snapshot.kind === 'before-ai')).toHaveLength(AUTOMATIC_SNAPSHOTS_KEPT_PER_SCENE);
    expect(stored.find((snapshot) => snapshot.kind === 'manual')).toMatchObject({name: 'Draft 1', wordCount: 2});
    expect(stored.some((snapshot) => snapshot.content === '<p>Version 0</p>')).toBe(false);
  });

  it('keeps snapshots per scene', async () => {
    const ids = scene();
    await takeSceneSnapshot({...ids, content: '<p>Here</p>', kind: 'manual'});
    await takeSceneSnapshot({projectId: ids.projectId, sceneId: 'other', content: '<p>There</p>', kind: 'manual'});
    expect((await getSceneSnapshots(ids.projectId, ids.sceneId)).map((snapshot) => snapshot.content)).toEqual(['<p>Here</p>']);
  });

  it('does not repeat an automatic snapshot of unchanged text, but always takes a manual one', async () => {
    const ids = scene();
    await takeSceneSnapshot({...ids, content: '<p>Same</p>', kind: 'before-ai', now: 1});
    await takeSceneSnapshot({...ids, content: '<p>Same</p>', kind: 'before-restore', now: 2});
    expect(await getSceneSnapshots(ids.projectId, ids.sceneId)).toHaveLength(1);
    await takeSceneSnapshot({...ids, content: '<p>Same</p>', kind: 'manual', now: 3});
    expect(await getSceneSnapshots(ids.projectId, ids.sceneId)).toHaveLength(2);
  });
});

describe('first edit of the day', () => {
  it('saves the text before the edit once per day, and never for an empty scene', async () => {
    const ids = scene();
    const morning = new Date(2026, 10, 22, 9).getTime();
    expect(await takeDailySceneSnapshotIfNeeded({...ids, savedContent: '<p></p>', now: morning})).toBeNull();
    const first = await takeDailySceneSnapshotIfNeeded({...ids, savedContent: '<p>Yesterday text</p>', now: morning});
    expect(first).toMatchObject({kind: 'daily', content: '<p>Yesterday text</p>'});
    expect(await takeDailySceneSnapshotIfNeeded({...ids, savedContent: '<p>Later</p>', now: morning + 3600_000})).toBeNull();
    const tomorrow = new Date(2026, 10, 23, 9).getTime();
    expect(await takeDailySceneSnapshotIfNeeded({...ids, savedContent: '<p>Later</p>', now: tomorrow})).toMatchObject({kind: 'daily'});
  });
});

describe('restore', () => {
  it('takes a snapshot of the current text first, so the restore can be undone', async () => {
    const ids = scene();
    const draft = await takeSceneSnapshot({...ids, content: '<p>Draft one</p>', kind: 'manual', name: 'Draft 1', now: 1});
    const restored = await prepareSnapshotRestore({...ids, currentContent: '<p>Draft two</p>', snapshot: draft, now: 2});
    expect(restored).toBe('<p>Draft one</p>');
    const [newest] = await getSceneSnapshots(ids.projectId, ids.sceneId);
    expect(newest).toMatchObject({kind: 'before-restore', content: '<p>Draft two</p>'});

    // Restoring back returns the later text and saves the restored one.
    const back = await prepareSnapshotRestore({...ids, currentContent: '<p>Draft one</p>', snapshot: newest, now: 3});
    expect(back).toBe('<p>Draft two</p>');
    expect(await getSceneSnapshots(ids.projectId, ids.sceneId)).toHaveLength(3);
  });

  it('does nothing when the scene already matches, and refuses another scene', async () => {
    const ids = scene();
    const draft = await takeSceneSnapshot({...ids, content: '<p>Same</p>', kind: 'manual'});
    expect(await prepareSnapshotRestore({...ids, currentContent: '<p>Same</p>', snapshot: draft})).toBeNull();
    await expect(prepareSnapshotRestore({...ids, sceneId: 'other', currentContent: '', snapshot: draft})).rejects.toThrow();
  });
});

describe('scene deletion', () => {
  it('saves the last text with the title, even when it matches the newest snapshot, and keeps the rest', async () => {
    const ids = scene();
    await takeSceneSnapshot({...ids, content: '<p>Final</p>', kind: 'manual', name: 'Draft 1', now: 1});
    const kept = await takeSnapshotBeforeSceneDeletion({...ids, sceneTitle: 'The Dream', content: '<p>Final</p>'});
    expect(kept).toMatchObject({kind: 'before-delete', sceneTitle: 'The Dream', content: '<p>Final</p>'});
    expect(await getSceneSnapshots(ids.projectId, ids.sceneId)).toHaveLength(2);
  });

  it('keeps nothing new for an empty scene', async () => {
    const ids = scene();
    expect(await takeSnapshotBeforeSceneDeletion({...ids, sceneTitle: 'Blank', content: '<p></p>'})).toBeNull();
    expect(await getSceneSnapshots(ids.projectId, ids.sceneId)).toEqual([]);
  });
});

describe('compare', () => {
  it('marks words removed from the snapshot and added since', () => {
    const comparison = compareSnapshotWithCurrent('<p>The old gate held</p>', '<p>The gate held fast</p>');
    expect(comparison).toMatchObject({added: 1, removed: 1});
    expect(comparison.snapshot.filter((op) => op.kind === 'removed').map((op) => op.token)).toEqual(['old']);
    expect(comparison.current.filter((op) => op.kind === 'added').map((op) => op.token)).toEqual(['fast']);
  });
});
