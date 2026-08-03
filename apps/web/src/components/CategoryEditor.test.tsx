import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {EntityCategory} from '../entityTypes';
import CategoryEditor from './CategoryEditor';

vi.mock('../categoryStorage', () => ({
  saveCategory: vi.fn(async () => undefined)
}));

const baseCategory: EntityCategory = {
  id: 'category-1',
  projectId: 'project-1',
  name: 'Characters',
  slug: 'characters',
  fieldSchema: [],
  createdAt: 1
};

describe('CategoryEditor field validation', () => {
  it('renders the missing category name error beside the name input', () => {
    render(
      <CategoryEditor
        category={{...baseCategory, name: ''}}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', {name: 'Save Category'}));

    const input = screen.getByRole('textbox', {name: /category name/i});
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Category name is required.');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Category name is required.'
    );
  });

  it('opens the first incomplete field and marks each missing input', () => {
    render(
      <CategoryEditor
        category={{
          ...baseCategory,
          fieldSchema: [
            {key: '', label: '', type: 'text', required: false}
          ]
        }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', {name: 'Save Category'}));

    const keyInput = screen.getByPlaceholderText('e.g., powerLevel');
    const labelInput = screen.getByPlaceholderText('e.g., Power Level');
    expect(keyInput).toHaveAttribute('aria-invalid', 'true');
    expect(keyInput).toHaveAccessibleDescription('Field key is required.');
    expect(labelInput).toHaveAttribute('aria-invalid', 'true');
    expect(labelInput).toHaveAccessibleDescription('Field label is required.');
  });

  it('clears a field error when the author edits that field', () => {
    render(
      <CategoryEditor
        category={{
          ...baseCategory,
          fieldSchema: [
            {key: '', label: 'Role', type: 'text', required: false}
          ]
        }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', {name: 'Save Category'}));
    const keyInput = screen.getByPlaceholderText('e.g., powerLevel');
    expect(keyInput).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(keyInput, {target: {value: 'role'}});

    expect(keyInput).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('Field key is required.')).not.toBeInTheDocument();
  });
});
