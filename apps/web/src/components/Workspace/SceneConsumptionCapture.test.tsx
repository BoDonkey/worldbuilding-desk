import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {CharacterReplayState} from '../../services/state/stateReplay';
import type {CompendiumEntry, StoredRuleset} from '../../entityTypes';
import {SceneConsumptionCapture} from './SceneConsumptionCapture';

const ruleset: StoredRuleset = {
  id: 'rules', projectId: 'project-1', name: 'Rules', version: '1',
  statDefinitions: [{id: 'strength', name: 'Strength', type: 'number', defaultValue: 5}],
  resourceDefinitions: [
    {id: 'health', name: 'Health', type: 'number', defaultValue: 40, max: 100}
  ],
  rules: [], itemTemplates: [], statusTemplates: [], createdAt: 1, updatedAt: 1
};
const state = (withPotion: boolean): CharacterReplayState => ({
  actorId: 'bill', actorName: 'Bill', stats: {strength: 5},
  resources: {current: {health: 40}, max: {health: 100}},
  inventory: {
    items: withPotion
      ? [{name: 'Health Potion', quantity: 1, definitionId: 'potion'}]
      : [],
    equipped: []
  },
  statuses: []
});
const approvedEntry: CompendiumEntry = {
  id: 'potion', projectId: 'project-1', name: 'Health Potion', domain: 'artifact',
  consumable: {effects: [{type: 'resource_change', definitionId: 'health', delta: 25}]},
  actions: [], createdAt: 1, updatedAt: 1
};
const props = (withPotion: boolean) => ({
  itemName: 'Health Potion',
  evidenceText: 'Bill drank a Health Potion.',
  contexts: [{sheetId: 'sheet-bill', actorId: 'bill', name: 'Bill', before: state(withPotion)}],
  suggestedSheetId: 'sheet-bill',
  ruleset,
  itemReference: {definitionId: 'potion'},
  exactReusableItem: null,
  reusableItemMatches: [],
  canCreateReusableItem: true,
  isSaving: false,
  onCancel: vi.fn(),
  onSave: vi.fn()
});

describe('SceneConsumptionCapture', () => {
  it('prefills an approved effect and combined inventory preview', () => {
    const onSave = vi.fn();
    render(<SceneConsumptionCapture
      {...props(true)} approvedEntry={approvedEntry} onSave={onSave}
    />);

    expect(screen.getByText('Remembered effect: Health Potion')).toBeInTheDocument();
    expect(screen.getByText('Health Potion: 1 -> 0')).toBeInTheDocument();
    expect(screen.getByText('Health: 40 -> 65')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Confirm item use'}));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      commands: [
        expect.objectContaining({type: 'inventory_consume', definitionId: 'potion'}),
        expect.objectContaining({type: 'resource_change', delta: 25})
      ]
    }));
  });

  it('requires an explicit missing-inventory branch and can remember a first effect', () => {
    const onSave = vi.fn();
    render(<SceneConsumptionCapture {...props(false)} onSave={onSave} />);

    expect(screen.getByRole('button', {name: 'Confirm item use'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Missing inventory choice'), {
      target: {value: 'add-and-consume'}
    });
    fireEvent.change(screen.getByLabelText('Change'), {target: {value: '25'}});
    fireEvent.click(screen.getByLabelText('Remember this effect'));
    fireEvent.click(screen.getByRole('button', {name: 'Confirm item use'}));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      commands: [
        expect.objectContaining({type: 'inventory_add'}),
        expect.objectContaining({type: 'inventory_consume'}),
        expect.objectContaining({type: 'resource_change', delta: 25})
      ],
      rememberedConsumable: {
        effects: [{type: 'resource_change', definitionId: 'health', delta: 25}]
      }
    }));
  });

  it('can apply an effect without inventing tracked inventory', () => {
    const onSave = vi.fn();
    render(<SceneConsumptionCapture {...props(false)} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Missing inventory choice'), {
      target: {value: 'without-tracking'}
    });
    fireEvent.change(screen.getByLabelText('Change'), {target: {value: '10'}});
    fireEvent.click(screen.getByRole('button', {name: 'Confirm item use'}));
    expect(onSave.mock.calls[0][0].commands).toEqual([
      expect.objectContaining({type: 'resource_change', delta: 10})
    ]);
  });
});
