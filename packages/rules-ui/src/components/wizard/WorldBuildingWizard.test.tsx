import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react';
import type {WorldRuleset} from '@worldbuilding-desk/rules-engine';
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

  it('saves an optional level table, sorted and without unusable rows', async () => {
    const onComplete = vi.fn();
    const initialRuleset: WorldRuleset = {
      id: 'ruleset-1',
      name: 'World',
      version: '1.0.0',
      statDefinitions: [],
      resourceDefinitions: [],
      levelTable: [{level: 3, experience: 300}],
      rules: [],
      itemTemplates: [],
      statusTemplates: [],
      createdAt: 1,
      updatedAt: 1
    };
    render(<WorldBuildingWizard initialRuleset={initialRuleset} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', {name: '+ Add Level'}));
    expect(screen.getByLabelText('Level', {selector: '#level-table-level-1'})).toHaveValue(4);
    fireEvent.change(screen.getByLabelText('Level', {selector: '#level-table-level-1'}), {
      target: {value: '2'}
    });
    fireEvent.change(screen.getByLabelText('Total XP needed', {selector: '#level-table-xp-1'}), {
      target: {value: '100'}
    });
    fireEvent.click(screen.getByRole('button', {name: '+ Add Level'}));
    fireEvent.change(screen.getByLabelText('Level', {selector: '#level-table-level-2'}), {
      target: {value: '1'}
    });

    fireEvent.click(screen.getByRole('button', {name: 'Save Changes'}));
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect((onComplete.mock.calls[0][0] as WorldRuleset).levelTable).toEqual([
      {level: 2, experience: 100},
      {level: 3, experience: 300}
    ]);

    fireEvent.click(screen.getByRole('button', {name: 'Remove level 3'}));
    fireEvent.click(screen.getByRole('button', {name: 'Remove level 2'}));
    fireEvent.click(screen.getByRole('button', {name: 'Remove level 1'}));
    fireEvent.click(screen.getByRole('button', {name: 'Save Changes'}));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(2));
    expect((onComplete.mock.calls[1][0] as WorldRuleset).levelTable).toBeUndefined();
  });
});
