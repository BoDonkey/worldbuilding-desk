import {fireEvent, render, screen} from '@testing-library/react';
import type {StatDefinition} from '@litrpg-tool/rules-engine';
import {describe, expect, it, vi} from 'vitest';
import {StatEditor} from './StatEditor';

const stat: StatDefinition = {
  id: 'strength',
  name: 'Strength',
  description: 'Physical power',
  type: 'number',
  defaultValue: 10,
  min: 1,
  max: 20
};

describe('StatEditor', () => {
  it('emits basic edits and action callbacks', () => {
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    const onDuplicate = vi.fn();
    render(
      <StatEditor
        stat={stat}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Stat name'), {
      target: {value: 'Might'}
    });
    fireEvent.change(screen.getByRole('combobox'), {
      target: {value: 'boolean'}
    });
    fireEvent.click(screen.getByRole('button', {name: 'Duplicate'}));
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));

    expect(onUpdate).toHaveBeenNthCalledWith(1, {name: 'Might'});
    expect(onUpdate).toHaveBeenNthCalledWith(2, {type: 'boolean'});
    expect(onDuplicate).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('reveals and updates numeric details when expanded', () => {
    const onUpdate = vi.fn();
    render(
      <StatEditor
        stat={stat}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
        expandable
      />
    );

    expect(screen.queryByText('Minimum Value')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Expand'}));

    expect(screen.getByText('Minimum Value')).toBeInTheDocument();
    expect(screen.getByText('Maximum Value')).toBeInTheDocument();
    expect(screen.getByText('Default Starting Value')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('No maximum'), {
      target: {value: '30'}
    });
    expect(onUpdate).toHaveBeenCalledWith({max: 30});
  });
});
