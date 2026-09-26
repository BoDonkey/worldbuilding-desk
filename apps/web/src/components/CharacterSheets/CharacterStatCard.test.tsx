import {render, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import type {CharacterSnapshot} from '../../services/state/characterSnapshot';
import {CharacterStatCard} from './CharacterStatCard';

const snapshot: CharacterSnapshot = {
  sheetId: 'sheet-mira',
  name: 'Mira',
  level: 4,
  stats: [
    {id: 'strength', label: 'Strength', value: '14'},
    {id: 'agility', label: 'Agility', value: '17'}
  ],
  resources: [{id: 'hp', label: 'Health', current: 29, max: 45}],
  inventory: [
    {name: 'Healing Potion', quantity: 2, equipped: false},
    {name: 'Ember Blade', quantity: 1, equipped: true}
  ],
  statuses: ['Invigorated'],
  location: 'The Vault'
};

describe('CharacterStatCard', () => {
  it('shows identity, when the state is from, resources, statuses, and full state', () => {
    render(<CharacterStatCard snapshot={snapshot} asOfLabel='At the cursor in The Vault' />);

    const card = screen.getByRole('article', {name: 'Mira stats'});
    expect(within(card).getByText('Level 4')).toBeInTheDocument();
    expect(within(card).getByText('At the cursor in The Vault')).toBeInTheDocument();
    expect(within(card).getByText('29 / 45')).toBeInTheDocument();
    expect(within(card).getByText('Invigorated')).toBeInTheDocument();
    expect(within(card).getByText('The Vault')).toBeInTheDocument();
    expect(within(card).getByText('17')).toBeInTheDocument();
    expect(within(card).getByText('Healing Potion ×2')).toBeInTheDocument();
    expect(within(card).getByText('Ember Blade · equipped')).toBeInTheDocument();
  });

  it('keeps full state collapsed when compact and open when full', () => {
    const {container, rerender} = render(
      <CharacterStatCard snapshot={snapshot} asOfLabel='Latest' />
    );
    expect(container.querySelector('details')).not.toHaveAttribute('open');

    rerender(<CharacterStatCard snapshot={snapshot} asOfLabel='Latest' density='full' />);
    expect(container.querySelector('details')).toHaveAttribute('open');
  });

  it('renders caller actions', () => {
    render(
      <CharacterStatCard
        snapshot={snapshot}
        asOfLabel='Latest'
        actions={<button type='button'>Open sheet</button>}
      />
    );
    expect(screen.getByRole('button', {name: 'Open sheet'})).toBeInTheDocument();
  });
});
