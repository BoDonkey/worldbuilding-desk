import {fireEvent, render, screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {StoredRuleset} from '../../entityTypes';
import type {CharacterReplayState} from '../../services/state/stateReplay';
import {PositionedStateChangeComposer} from './PositionedStateChangeComposer';

const ruleset: StoredRuleset = {
  id: 'rules', projectId: 'project-1', name: 'Rules', version: '1',
  statDefinitions: [{id: 'strength', name: 'Strength', type: 'number', defaultValue: 5}],
  resourceDefinitions: [{id: 'health', name: 'Health', type: 'number', defaultValue: 40}],
  rules: [], itemTemplates: [], statusTemplates: [], createdAt: 1, updatedAt: 1
};
const before: CharacterReplayState = {
  actorId: 'entity-wren', actorName: 'Wren', stats: {},
  resources: {current: {}, max: {}}, inventory: {items: [], equipped: []}, statuses: [],
  progression: {experience: 0, level: 1, startingLevel: 1, levelTable: []}
};

describe('PositionedStateChangeComposer for a character without a sheet (4.27b)', () => {
  it('offers only place and item changes and records a move', () => {
    const onSave = vi.fn();
    render(<PositionedStateChangeComposer
      characterName='Wren' sceneTitle='Arrival' cursorPosition={12} actorId='entity-wren'
      ruleset={ruleset} descriptiveOnly before={before} isSaving={false}
      onCancel={vi.fn()} onSave={onSave}
    />);

    const type = screen.getByRole('combobox', {name: 'Type'});
    const options = within(type).getAllByRole('option').map((option) => option.textContent);
    expect(options).toContain('Set location');
    expect(options.some((label) => /stat|resource|xp|status/i.test(label ?? ''))).toBe(false);
    expect(screen.queryByRole('button', {name: 'Advanced changes'})).not.toBeInTheDocument();
    expect(screen.queryByText(/position 12/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', {name: 'Location'}), {target: {value: 'South Harbor'}});
    fireEvent.click(screen.getByRole('button', {name: 'Confirm scene change'}));
    expect(onSave).toHaveBeenCalledWith({
      label: '',
      commands: [{type: 'location_set', actorId: 'entity-wren', locationName: 'South Harbor'}]
    });
  });
});
