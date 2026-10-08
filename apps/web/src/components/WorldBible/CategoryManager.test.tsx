import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {EntityCategory} from '../../entityTypes';
import {createSystemNegativeSpaceCategory} from '../../services/worldBible/systemNegativeSpace';
import {MemoryRouter} from 'react-router';
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
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <CategoryManager
        projectId='project-1'
        categories={[factions]}
        onCategoriesChange={onCategoriesChange}
        onClose={onClose}
        {...props}
      />
    </MemoryRouter>
  );
  return {onCategoriesChange, onClose};
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

  it('opens as a labelled modal dialog with focus inside', () => {
    renderManager();

    const dialog = screen.getByRole('dialog', {name: 'Manage Categories'});
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('backs out of field editing on Escape before closing', () => {
    const {onClose} = renderManager();

    fireEvent.click(screen.getByRole('button', {name: 'Edit Fields'}));
    expect(screen.getByRole('dialog', {name: 'Edit Factions fields'})).toBeInTheDocument();

    fireEvent.keyDown(window, {key: 'Escape'});
    expect(screen.getByRole('dialog', {name: 'Manage Categories'})).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, {key: 'Escape'});
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lets Escape close only the delete confirmation when it is open', () => {
    const {onClose} = renderManager();

    fireEvent.click(screen.getByRole('button', {name: 'Delete Factions'}));
    expect(screen.getByRole('dialog', {name: 'Delete this category?'})).toBeInTheDocument();

    fireEvent.keyDown(window, {key: 'Escape'});
    expect(screen.queryByRole('dialog', {name: 'Delete this category?'})).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the overlay is clicked', () => {
    const {onClose} = renderManager();

    fireEvent.click(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
