import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {EntityCategory} from '../../entityTypes';
import {ItemDescriptionFirstFields} from './ItemDescriptionFirstFields';

const descriptionField: EntityCategory['fieldSchema'][number] = {
  key: 'description',
  label: 'Description',
  type: 'textarea'
};

describe('ItemDescriptionFirstFields', () => {
  it('keeps the manual item draft focused on name and description', () => {
    const onNameChange = vi.fn();
    const onToggleDetails = vi.fn();

    render(
      <ItemDescriptionFirstFields
        name=''
        descriptionField={descriptionField}
        fieldValues={{}}
        detailsExpanded={false}
        onNameChange={onNameChange}
        onFieldValuesChange={vi.fn()}
        onToggleDetails={onToggleDetails}
      />
    );

    expect(screen.getByRole('heading', {name: 'Describe the item'})).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Name and description are enough to save an item.')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', {name: 'Name'}), {
      target: {value: 'The Silver-Sewn Ring'}
    });
    expect(onNameChange).toHaveBeenCalledWith('The Silver-Sewn Ring');

    const detailsButton = screen.getByRole('button', {name: 'Show all item details'});
    expect(detailsButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(detailsButton);
    expect(onToggleDetails).toHaveBeenCalledOnce();
  });

  it('explains how to continue when a custom item category lacks description', () => {
    render(
      <ItemDescriptionFirstFields
        name='Draft item'
        descriptionField={null}
        fieldValues={{}}
        detailsExpanded={false}
        onNameChange={vi.fn()}
        onFieldValuesChange={vi.fn()}
        onToggleDetails={vi.fn()}
      />
    );

    expect(
      screen.getByText(/This item category has no description field/)
    ).toBeInTheDocument();
  });
});
