import {fireEvent, render, screen, within} from '@testing-library/react';
import type {StatDefinition} from '@litrpg-tool/rules-engine';
import {describe, expect, it, vi} from 'vitest';
import {StatSystemStep} from './StatSystemStep';

const strength: StatDefinition = {
  id: 'strength',
  name: 'Strength',
  type: 'number',
  defaultValue: 10,
  min: 1,
  max: 20
};

describe('StatSystemStep', () => {
  it('applies a preset and leaves template selection mode', () => {
    const onChange = vi.fn();
    render(<StatSystemStep stats={[]} onChange={onChange} />);

    const simpleCard = screen.getByText('Simple (3 Stats)').closest(
      '.template-card'
    );
    expect(simpleCard).not.toBeNull();
    fireEvent.click(
      within(simpleCard as HTMLElement).getByRole('button', {name: 'Use This'})
    );

    const selectedStats = onChange.mock.calls[0][0] as StatDefinition[];
    expect(selectedStats).toHaveLength(3);
    expect(selectedStats.map((entry) => entry.name)).toEqual([
      'Strength',
      'Agility',
      'Intelligence'
    ]);
    expect(screen.getByRole('button', {name: /Add Stat/})).toBeInTheDocument();
  });

  it('adds, duplicates, updates, and deletes a stat', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    const onChange = vi.fn();
    render(<StatSystemStep stats={[strength]} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', {name: /Add Stat/}));
    expect(onChange).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({id: 'stat_1234', name: 'New Stat 2'})
      ])
    );

    fireEvent.click(screen.getByRole('button', {name: 'Duplicate'}));
    expect(onChange).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining([
        expect.objectContaining({
          id: 'stat_1234',
          name: 'Strength (Copy)'
        })
      ])
    );

    fireEvent.change(screen.getByPlaceholderText('Stat name'), {
      target: {value: 'Might'}
    });
    expect(onChange).toHaveBeenNthCalledWith(3, [
      expect.objectContaining({id: 'strength', name: 'Might'})
    ]);

    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    expect(onChange).toHaveBeenNthCalledWith(4, []);
  });
});
