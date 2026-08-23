import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {EntityCategory} from '../../entityTypes';
import {WorldCategorySelect} from './WorldCategorySelect';

const characters: EntityCategory = {
  id: 'characters',
  projectId: 'project-1',
  kind: 'character',
  name: 'Characters',
  slug: 'characters',
  fieldSchema: [],
  createdAt: 1
};

describe('WorldCategorySelect', () => {
  it('creates and selects a category without closing the review control', async () => {
    const onChange = vi.fn();
    const onCreate = vi.fn(async (name: string) => ({
      ...characters,
      id: 'factions',
      kind: 'general' as const,
      name,
      slug: 'factions'
    }));
    render(
      <WorldCategorySelect
        categories={[characters]}
        value=''
        onChange={onChange}
        onCreate={onCreate}
      />
    );

    fireEvent.change(screen.getByRole('combobox', {name: 'World Bible type'}), {
      target: {value: '__create_category__'}
    });
    fireEvent.change(screen.getByRole('textbox', {name: 'New World Bible type name'}), {
      target: {value: 'Factions'}
    });
    fireEvent.click(screen.getByRole('button', {name: 'Add type'}));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('Factions'));
    expect(onChange).toHaveBeenCalledWith('factions');
    expect(screen.getByRole('combobox', {name: 'World Bible type'})).toBeVisible();
  });
});
