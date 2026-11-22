import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {SceneSnapshot} from '../../entityTypes';
import {getProjectSceneSnapshots} from '../storage';
import {openDb, WRITING_STORE_NAME} from '../storage/db';
import {
  deleteDraftMilestone,
  findDeletedScenes,
  groupDraftMilestones,
  milestoneAsDocuments,
  saveDraftMilestone
} from './draftMilestones';
import {AUTOMATIC_SNAPSHOTS_KEPT_PER_SCENE, takeSceneSnapshot} from './sceneSnapshots';

async function seedProject() {
  const projectId = crypto.randomUUID();
  const scenes = [
    {id: crypto.randomUUID(), title: 'Opening', content: '<p>Rain fell on the gate.</p>', order: 2},
    {id: crypto.randomUUID(), title: 'Dream', content: '<p>She dreamed.</p>', order: 1}
  ];
  const db = await openDb();
  const tx = db.transaction(WRITING_STORE_NAME, 'readwrite');
  for (const scene of scenes) tx.objectStore(WRITING_STORE_NAME).put({...scene, projectId, createdAt: 1, updatedAt: 1});
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return {projectId, opening: scenes[0], dream: scenes[1]};
}

describe('draft milestones', () => {
  it('snapshots every scene in manuscript order, with the open scene as edited', async () => {
    const {projectId, opening, dream} = await seedProject();
    const milestone = await saveDraftMilestone({
      projectId,
      name: ' Draft 1 complete ',
      openScene: {id: opening.id, title: 'Opening (edited)', content: '<p>Rain fell on the iron gate.</p>'},
      now: 100
    });
    expect(milestone).toMatchObject({name: 'Draft 1 complete', createdAt: 100, wordCount: 8});
    expect(milestone.scenes.map((scene) => scene.title)).toEqual(['Dream', 'Opening (edited)']);
    expect(milestone.scenes[1].snapshot).toMatchObject({kind: 'milestone', sceneId: opening.id, content: '<p>Rain fell on the iron gate.</p>'});
    expect(milestone.scenes[0].snapshot.sceneId).toBe(dream.id);
  });

  it('names an unnamed milestone after its date and refuses a project with no scenes', async () => {
    const {projectId} = await seedProject();
    expect((await saveDraftMilestone({projectId, name: '  '})).name).toMatch(/^Draft of /);
    await expect(saveDraftMilestone({projectId: crypto.randomUUID(), name: 'Empty'})).rejects.toThrow('no scenes');
  });

  it('lists milestones newest first and exports their text', async () => {
    const {projectId} = await seedProject();
    await saveDraftMilestone({projectId, name: 'Draft 1', now: 100});
    await saveDraftMilestone({projectId, name: 'Draft 2', now: 200});
    const milestones = groupDraftMilestones(await getProjectSceneSnapshots(projectId));
    expect(milestones.map((milestone) => milestone.name)).toEqual(['Draft 2', 'Draft 1']);
    const documents = milestoneAsDocuments(milestones[1], projectId);
    expect(documents.map((doc) => [doc.title, doc.content, doc.order])).toEqual([
      ['Dream', '<p>She dreamed.</p>', 0],
      ['Opening', '<p>Rain fell on the gate.</p>', 1]
    ]);
  });

  it('keeps milestone snapshots out of automatic pruning, and deletes a whole milestone', async () => {
    const {projectId, opening} = await seedProject();
    const milestone = await saveDraftMilestone({projectId, name: 'Draft 1', now: 1});
    for (let index = 0; index <= AUTOMATIC_SNAPSHOTS_KEPT_PER_SCENE; index += 1) {
      await takeSceneSnapshot({projectId, sceneId: opening.id, content: `<p>v${index}</p>`, kind: 'before-ai', now: 10 + index});
    }
    expect(groupDraftMilestones(await getProjectSceneSnapshots(projectId))[0].scenes).toHaveLength(2);
    await deleteDraftMilestone(projectId, milestone.id);
    expect(groupDraftMilestones(await getProjectSceneSnapshots(projectId))).toEqual([]);
    expect((await getProjectSceneSnapshots(projectId)).length).toBe(AUTOMATIC_SNAPSHOTS_KEPT_PER_SCENE);
  });
});

describe('deleted scenes', () => {
  const snap = (overrides: Partial<SceneSnapshot>): SceneSnapshot => ({
    id: crypto.randomUUID(), projectId: 'p', sceneId: 'gone', content: '<p>x</p>', kind: 'manual', wordCount: 1, createdAt: 1,
    ...overrides
  });

  it('lists scenes that have snapshots but no document, titled from the newest titled snapshot', () => {
    const deleted = findDeletedScenes(
      [
        snap({sceneId: 'live'}),
        snap({sceneId: 'gone', sceneTitle: 'Old title', createdAt: 1}),
        snap({sceneId: 'gone', sceneTitle: 'The Dream', kind: 'before-delete', createdAt: 5}),
        snap({sceneId: 'gone', createdAt: 3}),
        snap({sceneId: 'other', createdAt: 9})
      ],
      [{id: 'live'}]
    );
    expect(deleted.map((scene) => [scene.sceneId, scene.title, scene.snapshots.length])).toEqual([
      ['other', 'Untitled scene', 1],
      ['gone', 'The Dream', 3]
    ]);
    expect(deleted[1].snapshots[0].kind).toBe('before-delete');
  });
});
