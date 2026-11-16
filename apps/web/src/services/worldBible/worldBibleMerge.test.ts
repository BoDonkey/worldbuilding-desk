// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import type {EntityCategory, StateMutationEvent, WorldEntity} from '../../entityTypes';
import {
  getAliasesByProject,
  getEntitiesByProject,
  getStateMutationEventsByProject,
  saveAlias,
  saveCategory,
  saveEntity,
  saveStateMutationEvents
} from '../storage';
import {saveWorldBibleMerge} from './worldBibleMerge';

let counter = 0;
const newProjectId = () => `merge-${Date.now()}-${counter++}`;

describe('saveWorldBibleMerge', () => {
  it('repoints place references to the kept place and removes the duplicate (3.45)', async () => {
    const projectId = newProjectId();
    const category: EntityCategory = {
      id: `loc-${projectId}`, projectId, kind: 'general', name: 'Locations', slug: 'locations',
      fieldSchema: [], createdAt: 0
    };
    const place = (id: string, extra: Partial<WorldEntity> = {}): WorldEntity => ({
      id: `${projectId}-${id}`, projectId, categoryId: category.id, name: id, fields: {}, links: [],
      createdAt: 1, updatedAt: 1, ...extra
    });
    const source = place('Old Gate');
    const target = place('Gate');
    const inn = place('Inn', {place: {parentId: source.id}});
    const event: StateMutationEvent = {
      id: `${projectId}-event`, projectId, sceneId: 'scene-1', sceneTitle: 'Scene', sceneOrder: 1,
      scenePosition: 0, sourceRevision: 1, sourceHash: 'hash', status: 'accepted', createdAt: 1,
      commands: [{type: 'location_set', actorId: 'sera', locationName: 'Old Gate', placeId: source.id}]
    };
    await saveCategory(category);
    for (const entity of [source, target, inn]) await saveEntity(entity);
    await saveAlias({projectId, targetType: 'entity', targetId: source.id, alias: 'The Old Gate'});
    await saveStateMutationEvents([event]);

    const result = await saveWorldBibleMerge({
      source,
      merged: target,
      aliases: ['Old Gate', 'The Old Gate'],
      categories: [category],
      entities: [source, target, inn],
      indexing: {ragService: null, shodhService: null}
    });

    const entities = await getEntitiesByProject(projectId);
    expect(entities.map((entity) => entity.id).sort()).toEqual([inn.id, target.id].sort());
    expect(entities.find((entity) => entity.id === inn.id)?.place).toEqual({parentId: target.id});
    expect(result.repointed.map((entity) => entity.id)).toEqual([inn.id]);
    const [savedEvent] = await getStateMutationEventsByProject(projectId);
    expect(savedEvent?.commands[0]).toMatchObject({placeId: target.id});
    const aliases = await getAliasesByProject(projectId);
    expect(aliases.map((alias) => [alias.alias, alias.targetId]).sort()).toEqual([
      ['Old Gate', target.id],
      ['The Old Gate', target.id]
    ]);
  });
});
