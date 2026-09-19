import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {EntityCategory} from '../../entityTypes';
import {createSystemNegativeSpaceCategory} from '../../services/worldBible/systemNegativeSpace';
import {CategoryManager} from './CategoryManager';

const mocks = vi.hoisted(() => ({
  saveCategory: vi.fn(),
  deleteCategory: vi.fn()
}));

vi.mock('../../categoryStorage', () => ({
  saveCategory: mocks.saveCategory,
  deleteCategory: mocks.deleteCategory
}));

const factions: EntityCategory = {
  id: 'factions',
  projectId: 'project-1',
  kind: 'general',
  name: 'Factions',
  slug: 'factions',
  fieldSchema: [],
  createdAt: 1
};

const renderManager = (props: Partial<Parameters<typeof CategoryManager>[0]> = {}) => {
  const onCategoriesChange = vi.fn();
  render(
    <CategoryManager
      projectId='project-1'
      categories={[factions]}
      onCategoriesChange={onCategoriesChange}
      onClose={vi.fn()}
      {...props}
    />
  );
  return {onCategoriesChange};
};

describe('CategoryManager', () => {
  beforeEach(() => {
    mocks.saveCategory.mockReset().mockResolvedValue(undefined);
  });

  it('never offers Problems Power Cannot Solve outside game-systems projects', () => {
    renderManager();
    expect(screen.queryByText(/Problems Power Cannot Solve/)).not.toBeInTheDocument();
  });

  it('adds Problems Power Cannot Solve only when the author opts in', async () => {
    const {onCategoriesChange} = renderManager({canAddSystemNegativeSpace: true});

    expect(screen.getByText(/growing power does not quietly solve everything/)).toBeInTheDocument();
    expect(mocks.saveCategory).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', {name: 'Add Problems Power Cannot Solve'}));

    await waitFor(() => expect(mocks.saveCategory).toHaveBeenCalledTimes(1));
    const saved = mocks.saveCategory.mock.calls[0][0] as EntityCategory;
    expect(saved.id).toBe('system-negative-space-project-1');
    expect(onCategoriesChange).toHaveBeenCalledWith([factions, saved]);
  });

  it('hides the offer once the category exists and lets the author delete it', () => {
    const builtIn = createSystemNegativeSpaceCategory('project-1', 1);
    renderManager({canAddSystemNegativeSpace: true, categories: [factions, builtIn]});

    expect(screen.queryByRole('button', {name: 'Add Problems Power Cannot Solve'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Delete Problems Power Cannot Solve'})).toBeInTheDocument();
  });
});
