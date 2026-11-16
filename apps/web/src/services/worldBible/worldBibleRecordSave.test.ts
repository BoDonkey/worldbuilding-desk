import 'fake-indexeddb/auto';
import {describe, expect, it, vi} from 'vitest';
import type {EntityCategory, WorldEntity} from '../../entityTypes';
import type {RAGProvider} from '../rag/RAGService';
import type {ShodhMemoryProvider} from '../shodh/ShodhMemoryService';
import {getAliasesByProject, getEntitiesByProject} from '../storage';
import {saveWorldBibleRecord} from './worldBibleRecordSave';

let counter = 0;
const newProjectId = () => `record-save-${Date.now()}-${counter++}`;

const locations = (projectId: string): EntityCategory => ({
  id: `loc-${projectId}`,
  projectId,
  kind: 'general',
  name: 'Locations',
  slug: 'locations',
  fieldSchema: [],
  createdAt: 0
});

const record = (projectId: string, id: string, overrides: Partial<WorldEntity> = {}): WorldEntity => ({
  id,
  projectId,
  categoryId: `loc-${projectId}`,
  name: id,
  fields: {},
  links: [],
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

const indexing = () => {
  const ragService = {indexDocument: vi.fn().mockResolvedValue(undefined)};
  const shodhService = {captureAutoMemory: vi.fn().mockResolvedValue(undefined)};
  return {
    ragService,
    shodhService,
    indexing: {
      ragService: ragService as unknown as RAGProvider,
      shodhService: shodhService as unknown as ShodhMemoryProvider
    }
  };
};

describe('saveWorldBibleRecord', () => {
  it('saves, writes aliases, and indexes the record for search and memory', async () => {
    const projectId = newProjectId();
    const category = locations(projectId);
    const services = indexing();
    const {entity, indexed} = await saveWorldBibleRecord({
      entity: record(projectId, 'harbor', {name: 'Harbor'}),
      category,
      categories: [category],
      entities: [],
      aliases: ['The Docks'],
      indexing: services.indexing
    });

    expect(indexed).toBe(true);
    expect(await getEntitiesByProject(projectId)).toEqual([entity]);
    expect((await getAliasesByProject(projectId)).map((alias) => alias.alias)).toEqual(['The Docks']);
    expect(services.ragService.indexDocument).toHaveBeenCalledWith(
      'harbor', 'Harbor', expect.any(String), 'worldbible', {tags: ['locations'], entityIds: ['harbor']}
    );
    expect(services.shodhService.captureAutoMemory).toHaveBeenCalledWith(
      expect.objectContaining({documentId: 'harbor', tags: ['worldbible', 'locations']})
    );
  });

  it('applies the place rules on every save, not only in the editor', async () => {
    const projectId = newProjectId();
    const category = locations(projectId);
    const city = record(projectId, 'city', {place: {parentId: 'harbor'}});
    const {entity} = await saveWorldBibleRecord({
      entity: record(projectId, 'harbor', {
        place: {connections: [{id: 'c1', toId: 'missing', kind: 'road'}]}
      }),
      category,
      categories: [category],
      entities: [city],
      indexing: {ragService: null, shodhService: null}
    });
    expect(entity.place).toBeUndefined();

    await expect(saveWorldBibleRecord({
      entity: record(projectId, 'harbor', {place: {parentId: 'city'}}),
      category,
      categories: [category],
      entities: [city, record(projectId, 'harbor')],
      indexing: {ragService: null, shodhService: null}
    })).rejects.toThrow(/cannot be inside/);
  });

  it('keeps the save when indexing fails', async () => {
    const projectId = newProjectId();
    const category = locations(projectId);
    const services = indexing();
    services.ragService.indexDocument.mockRejectedValueOnce(new Error('index offline'));
    const {indexed} = await saveWorldBibleRecord({
      entity: record(projectId, 'harbor'),
      category,
      categories: [category],
      entities: [],
      indexing: services.indexing
    });

    expect(indexed).toBe(false);
    expect(await getEntitiesByProject(projectId)).toHaveLength(1);
  });
});
