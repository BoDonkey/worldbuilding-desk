import {act, renderHook, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {EntityCategory, Project} from '../entityTypes';
import {mergeLoadedCategories, useWorldBibleProjectData} from './useWorldBibleProjectData';

const {categoryLoad, empty} = vi.hoisted(() => ({
  categoryLoad: {resolve: null as null | ((categories: unknown[]) => void)},
  empty: async () => []
}));

vi.mock('../categoryStorage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../categoryStorage')>()),
  initializeDefaultCategories: vi.fn(async () => undefined),
  saveCategory: vi.fn(async () => undefined),
  getCategoriesByProject: vi.fn(
    () => new Promise((resolve) => {
      categoryLoad.resolve = resolve;
    })
  )
}));
vi.mock('../characterStorage', () => ({getCharactersByProject: vi.fn(empty)}));
vi.mock('../entityStorage', () => ({getEntitiesByProject: vi.fn(empty)}));
vi.mock('../writingStorage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../writingStorage')>()),
  getDocumentsByProject: vi.fn(empty)
}));
vi.mock('../loreStorage', () => ({
  getLoreDocumentsByProject: vi.fn(empty),
  getLoreDocumentLinksByProject: vi.fn(empty)
}));
vi.mock('../services/characters/characterSheetService', () => ({getCharacterSheetsByProject: vi.fn(empty)}));
vi.mock('../services/characters/characterIdentityStorage', () => ({
  getCharacterIdentityMigrationReport: vi.fn(async () => null)
}));
vi.mock('../services/compendium', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/compendium')>()),
  getCompendiumEntriesByProject: vi.fn(empty)
}));
vi.mock('../services/consistency', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/consistency')>()),
  getAliasesByProject: vi.fn(empty)
}));
vi.mock('../services/lore/loreFactStorage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/lore/loreFactStorage')>()),
  getCanonicalFactsByProject: vi.fn(empty)
}));
vi.mock('../services/state/stateMutationLedger', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/state/stateMutationLedger')>()),
  getStateMutationEventsByProject: vi.fn(empty)
}));
vi.mock('../services/rules', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/rules')>()),
  getRulesetByProjectId: vi.fn(async () => null)
}));
vi.mock('../services/rag/getRAGService', () => ({getRAGService: vi.fn(() => new Promise(() => undefined))}));
vi.mock('../services/shodh/getShodhService', () => ({getShodhService: vi.fn(() => new Promise(() => undefined))}));
vi.mock('../services/seriesBible/SeriesBibleService', () => ({
  getSeriesBibleConfig: vi.fn(async () => null),
  getCanonSyncState: vi.fn(async () => null)
}));

const category = (id: string, name: string, projectId = 'p'): EntityCategory =>
  ({id, projectId, name, slug: id, fieldSchema: [], createdAt: 1}) as unknown as EntityCategory;
const project = {id: 'p', name: 'Saga'} as Project;
const setFeedback = vi.fn();

describe('mergeLoadedCategories', () => {
  it('keeps local changes and local additions, and drops another project’s categories', () => {
    const loaded = [category('a', 'Places'), category('b', 'Factions')];
    const local = [category('b', 'Groups'), category('c', 'Problems'), category('x', 'Elsewhere', 'other')];
    expect(mergeLoadedCategories(loaded, local, 'p').map((entry) => entry.name)).toEqual([
      'Places',
      'Groups',
      'Problems'
    ]);
  });
});

describe('useWorldBibleProjectData category load', () => {
  beforeEach(() => {
    categoryLoad.resolve = null;
  });

  it('keeps a category added before the initial load finishes', async () => {
    const {result} = renderHook(() => useWorldBibleProjectData({activeProject: project, setFeedback}));
    await waitFor(() => expect(categoryLoad.resolve).not.toBeNull());

    act(() => result.current.setCategories((current) => [...current, category('new', 'Problems')]));
    await act(async () => categoryLoad.resolve?.([category('a', 'Places')]));

    await waitFor(() => expect(result.current.categoriesLoaded).toBe(true));
    expect(result.current.categories.map((entry) => entry.id)).toEqual(['a', 'new']);
  });

  it('uses the loaded list as-is when nothing changed during the load', async () => {
    const {result} = renderHook(() => useWorldBibleProjectData({activeProject: project, setFeedback}));
    await waitFor(() => expect(categoryLoad.resolve).not.toBeNull());
    await act(async () => categoryLoad.resolve?.([category('a', 'Places')]));

    await waitFor(() => expect(result.current.categoriesLoaded).toBe(true));
    expect(result.current.categories.map((entry) => entry.id)).toEqual(['a']);
  });
});
