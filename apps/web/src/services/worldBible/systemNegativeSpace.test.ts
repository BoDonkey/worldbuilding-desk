import {describe, expect, it, vi} from 'vitest';
import type {WorldEntity, WritingDocument} from '../../entityTypes';
import {
  createSystemNegativeSpaceCategory,
  normalizeSystemNegativeSpaceRecord,
  summarizeSystemNegativeSpaceRecords
} from './systemNegativeSpace';

const document = (id: string): WritingDocument => ({
  id,
  projectId: 'project-1',
  title: id,
  content: '',
  createdAt: 1,
  updatedAt: 1
});

const entity = (
  id: string,
  status: NonNullable<WorldEntity['systemNegativeSpace']>['status'],
  sceneIds: string[]
): WorldEntity => ({
  id,
  projectId: 'project-1',
  categoryId: 'category-1',
  name: id,
  fields: {},
  systemNegativeSpace: {status, sceneIds},
  links: [],
  createdAt: 1,
  updatedAt: 1
});

describe('system negative-space records', () => {
  it('creates an explicitly typed built-in category', () => {
    vi.stubGlobal('crypto', {randomUUID: () => 'category-1'});
    expect(createSystemNegativeSpaceCategory('project-1', 42)).toMatchObject({
      id: 'category-1',
      projectId: 'project-1',
      recordType: 'system-negative-space',
      createdAt: 42
    });
    vi.unstubAllGlobals();
  });

  it('normalizes status and keeps only unique, existing scene links', () => {
    expect(normalizeSystemNegativeSpaceRecord(
      {status: 'open', sceneIds: ['scene-1', 'missing', 'scene-1']},
      new Set(['scene-1'])
    )).toEqual({status: 'open', sceneIds: ['scene-1']});
  });

  it('summarizes only explicit author status and valid scene links', () => {
    expect(summarizeSystemNegativeSpaceRecords({
      categoryId: 'category-1',
      entities: [
        entity('grief', 'open', ['scene-1']),
        entity('trust', 'changed', ['scene-1', 'scene-2']),
        {...entity('elsewhere', 'resolved', ['scene-2']), categoryId: 'other'}
      ],
      documents: [document('scene-1'), document('scene-2')]
    })).toEqual({
      recordCount: 2,
      counts: {open: 1, worsening: 0, changed: 1, resolved: 0},
      linkedSceneIds: ['scene-1', 'scene-2']
    });
  });
});
