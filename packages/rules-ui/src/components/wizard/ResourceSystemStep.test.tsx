import {fireEvent, render, screen, within} from '@testing-library/react';
import type {ResourceDefinition} from '@litrpg-tool/rules-engine';
import {describe, expect, it, vi} from 'vitest';
import {ResourceSystemStep} from './ResourceSystemStep';

const mana: ResourceDefinition = {
  id: 'mana',
  name: 'Mana',
  type: 'number',
  defaultValue: 100,
  min: 0,
  max: 100,
  regeneration: {enabled: false, rate: 5, interval: 1}
};

describe('ResourceSystemStep', () => {
  it('loads a resource template', () => {
    const onChange = vi.fn();
    render(<ResourceSystemStep resources={[]} onChange={onChange} />);

    const healthCard = screen.getByText('Health Only').closest('.template-card');
    expect(healthCard).not.toBeNull();
    fireEvent.click(
      within(healthCard as HTMLElement).getByRole('button', {name: 'Use This'})
    );

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'health',
        name: 'Health',
        defaultValue: 100
      })
    ]);
    expect(
      screen.getByRole('button', {name: /Add Resource/})
    ).toBeInTheDocument();
  });

  it('updates regeneration and resource actions', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5678);
    const onChange = vi.fn();
    render(<ResourceSystemStep resources={[mana]} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText('Resource name'), {
      target: {value: 'Arcane Power'}
    });
    expect(onChange).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({id: 'mana', name: 'Arcane Power'})
    ]);

    fireEvent.click(screen.getByRole('checkbox', {name: /Enable Regeneration/}));
    expect(onChange).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({
        regeneration: {enabled: true, rate: 5, interval: 1}
      })
    ]);

    fireEvent.click(screen.getByRole('button', {name: 'Duplicate'}));
    expect(onChange).toHaveBeenNthCalledWith(
      3,
      expect.arrayContaining([
        expect.objectContaining({
          id: 'resource_5678',
          name: 'Mana (Copy)'
        })
      ])
    );

    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    expect(onChange).toHaveBeenNthCalledWith(4, []);
  });
});
