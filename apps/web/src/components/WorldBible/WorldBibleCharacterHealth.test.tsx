import {render, screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {WorldEntity} from '../../entityTypes';
import {WorldBibleCharacterHealth} from './WorldBibleCharacterHealth';

const sera: WorldEntity = {
  id: 'entity-sera', projectId: 'project-1', categoryId: 'characters', name: 'Sera',
  fields: {}, links: [], createdAt: 1, updatedAt: 1
};

const renderOverview = (
  currentState: Parameters<typeof WorldBibleCharacterHealth>[0]['selectedEntityCurrentState']
) => render(
  <WorldBibleCharacterHealth
    selectedEntity={sera} selectedEntityAliases={[]} selectedEntityFacts={[]}
    linkedLoreDocumentsForSelectedEntity={[]} selectedEntitySceneMentions={[]}
    selectedEntityStateEvents={[]} selectedEntityCurrentState={currentState}
    selectedEntityAcceptedStateEventCount={0} selectedEntityProposedStateEventCount={0}
    characterHealthProbeResults={[]} characterHealthProbeRunning={false}
    currentEntityMemories={[]} documents={[]} canProbe={false}
    handleCharacterHealthProbe={vi.fn()} onOpenScene={vi.fn()}
  />
);

describe('WorldBibleCharacterHealth current place and items (4.27b)', () => {
  it('shows where the character is and what they hold', () => {
    renderOverview({
      location: 'South Harbor',
      inventory: [
        {name: 'Brass Key', quantity: 1, equipped: false},
        {name: 'Lantern Oil', quantity: 3, equipped: false}
      ]
    });
    const now = within(screen.getByRole('region', {name: 'Current place and items'}));
    expect(now.getByText('South Harbor')).toBeInTheDocument();
    expect(now.getByText('Brass Key')).toBeInTheDocument();
    expect(now.getByText('×3')).toBeInTheDocument();
  });

  it('says when nothing is recorded yet', () => {
    renderOverview({inventory: []});
    const now = within(screen.getByRole('region', {name: 'Current place and items'}));
    expect(now.getByText('No place recorded yet.')).toBeInTheDocument();
    expect(now.getByText('Holding nothing recorded.')).toBeInTheDocument();
  });
});
