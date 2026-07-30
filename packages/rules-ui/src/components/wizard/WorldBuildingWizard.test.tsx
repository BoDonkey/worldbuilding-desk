import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react';
import type {WorldRuleset} from '@litrpg-tool/rules-engine';
import {describe, expect, it, vi} from 'vitest';
import {WorldBuildingWizard} from './WorldBuildingWizard';

describe('WorldBuildingWizard', () => {
  it('requires basics, stats, and resources before creating a world', async () => {
    const onComplete = vi.fn();
    render(<WorldBuildingWizard onComplete={onComplete} />);

    const createButton = screen.getByRole('button', {name: 'Create World'});
    expect(createButton).toBeDisabled();
    expect(
      screen.getByText('Complete World Basics to unlock Character Stats.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Add at least one stat to unlock Resources.')
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('World Name *'), {
      target: {value: 'Asterfall'}
    });

    const statCard = screen.getByText('Simple (3 Stats)').closest(
      '.template-card'
    );
    fireEvent.click(
      within(statCard as HTMLElement).getByRole('button', {name: 'Use This'})
    );

    const resourceCard = screen.getByText('Health Only').closest(
      '.template-card'
    );
    fireEvent.click(
      within(resourceCard as HTMLElement).getByRole('button', {
        name: 'Use This'
      })
    );

    expect(createButton).toBeEnabled();
    fireEvent.click(createButton);

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    const savedRuleset = onComplete.mock.calls[0][0] as WorldRuleset;
    expect(savedRuleset.name).toBe('Asterfall');
    expect(savedRuleset.statDefinitions).toHaveLength(3);
    expect(savedRuleset.resourceDefinitions).toHaveLength(1);
    expect(savedRuleset.resourceDefinitions[0].name).toBe('Health');
    expect(screen.getByRole('button', {name: 'Save Changes'})).toBeDisabled();
  });

  it('saves edits and invokes cancellation', async () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const initialRuleset: WorldRuleset = {
      id: 'ruleset-1',
      name: 'Old Name',
      description: '',
      version: '1.0.0',
      statDefinitions: [
        {
          id: 'strength',
          name: 'Strength',
          type: 'number',
          defaultValue: 10
        }
      ],
      resourceDefinitions: [
        {
          id: 'health',
          name: 'Health',
          type: 'number',
          defaultValue: 100
        }
      ],
      rules: [],
      itemTemplates: [],
      statusTemplates: [],
      createdAt: 1,
      updatedAt: 1
    };
    render(
      <WorldBuildingWizard
        initialRuleset={initialRuleset}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );

    const saveButton = screen.getByRole('button', {name: 'Save Changes'});
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('World Name *'), {
      target: {value: 'New Name'}
    });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);
    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({id: 'ruleset-1', name: 'New Name'})
      )
    );

    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
