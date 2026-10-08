import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {EntityCategory, WorldEntity} from '../entityTypes';
import {useWorldBibleImports} from './useWorldBibleImports';

const mocks = vi.hoisted(() => ({
  saveEntity: vi.fn(),
  saveCategory: vi.fn()
}));

vi.mock('../entityStorage', () => ({saveEntity: mocks.saveEntity}));
vi.mock('../categoryStorage', () => ({saveCategory: mocks.saveCategory}));

const locations: EntityCategory = {
  id: 'locations',
  projectId: 'project',
  kind: 'general',
  name: 'Locations',
  slug: 'locations',
  createdAt: 1,
  fieldSchema: [{key: 'description', label: 'Description', type: 'textarea'}]
};

const renderImports = () => {
  let categories = [locations];
  const setCategories = vi.fn((update: EntityCategory[] | ((prev: EntityCategory[]) => EntityCategory[])) => {
    categories = typeof update === 'function' ? update(categories) : update;
  });
  const hook = renderHook(
    ({currentCategories}: {currentCategories: EntityCategory[]}) =>
      useWorldBibleImports({
        activeProjectId: 'project',
        activeCategory: currentCategories[0],
        categories: currentCategories,
        entities: [] as WorldEntity[],
        setCategories,
        setEntities: vi.fn(),
        setFeedback: vi.fn()
      }),
    {initialProps: {currentCategories: categories}}
  );
  return {...hook, getCategories: () => categories};
};

describe('useWorldBibleImports heading destinations', () => {
  beforeEach(() => {
    mocks.saveEntity.mockReset().mockResolvedValue(undefined);
    mocks.saveCategory.mockReset().mockResolvedValue(undefined);
  });

  it('offers a field created by one import to drafts still open in the batch', async () => {
    const {result, rerender, getCategories} = renderImports();

    act(() => result.current.preparePastedImportDraft('## Tides\nHigh twice daily.', 'Harbor'));
    const harbor = result.current.importDrafts[0];
    act(() => {
      result.current.updateImportSectionDestination(harbor.id, harbor.detectedSections![0].id, {
        action: 'new-field',
        newFieldLabel: 'Tides'
      });
    });

    await act(async () => {
      await result.current.applyImportDrafts({draftIds: [harbor.id]});
    });
    expect(getCategories()[0].fieldSchema.map((field) => field.label)).toContain('Tides');

    // A second draft planned the same field before the first import landed.
    act(() => result.current.preparePastedImportDraft('## Weather\nWindy.', 'Ridge'));
    const ridge = result.current.importDrafts[0];
    act(() => {
      result.current.updateImportSectionDestination(ridge.id, ridge.detectedSections![0].id, {
        action: 'new-field',
        newFieldLabel: 'Tides'
      });
    });
    rerender({currentCategories: getCategories()});

    expect(result.current.importDrafts[0].detectedSections![0]).toMatchObject({
      action: 'existing-field',
      fieldKey: 'tides'
    });
  });

  it('keeps chosen destinations when the entry is renamed', () => {
    const {result} = renderImports();

    act(() => result.current.preparePastedImportDraft('## Tides\nHigh twice daily.', 'Harbor'));
    const draft = result.current.importDrafts[0];
    act(() => {
      result.current.updateImportSectionDestination(draft.id, draft.detectedSections![0].id, {
        action: 'ignore'
      });
    });
    act(() => result.current.updateImportDraft(draft.id, {name: 'Tide Harbor'}));

    expect(result.current.importDrafts[0].detectedSections![0].action).toBe('ignore');
  });
});
