import {fireEvent, render, screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {ProjectAISettings, SelectionAction} from '../../entityTypes';
import {AIActionsSection} from './AIActionsSection';
import {SELECTION_ACTION_PRESETS} from '../../services/assistant/selectionActions';

const base = {provider: 'openai', configs: {}, promptTools: [], defaultToolIds: []} as unknown as ProjectAISettings;
const rewrite: SelectionAction = {
  id: 'r', name: 'Tighten', instructions: 'Cut filler.', includeScene: false,
  includeWorldBible: false, output: 'replace', enabled: false
};
const note: SelectionAction = {...rewrite, id: 'n', name: 'Check against canon', output: 'note'};

describe('AI actions in Settings (5.19)', () => {
  it('lists the presets switched off for a project that never saved its own list', () => {
    render(<AIActionsSection aiSettings={{...base, aiCoaching: true, aiProse: true}} onSettingsChange={vi.fn()} />);
    const list = screen.getByRole('list', {name: 'AI actions'});
    expect(within(list).getAllByRole('listitem')).toHaveLength(SELECTION_ACTION_PRESETS.length);
    expect(screen.getByRole('checkbox', {name: 'Tighten on'})).not.toBeChecked();
    expect(screen.getByText(/Right-click a selection to run one/)).toBeInTheDocument();
  });

  it('hides actions whose AI switch is off, and the whole section with both off', () => {
    const {rerender} = render(
      <AIActionsSection aiSettings={{...base, aiProse: true, selectionActions: [rewrite, note]}} onSettingsChange={vi.fn()} />
    );
    expect(screen.getByText('Tighten')).toBeInTheDocument();
    expect(screen.queryByText('Check against canon')).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Write a note (no edit)'})).not.toBeInTheDocument();
    rerender(<AIActionsSection aiSettings={{...base, selectionActions: [rewrite, note]}} onSettingsChange={vi.fn()} />);
    expect(screen.queryByRole('heading', {name: 'AI actions'})).not.toBeInTheDocument();
  });

  it('switches an action on and keeps hidden actions when saving', () => {
    const onSettingsChange = vi.fn();
    render(<AIActionsSection aiSettings={{...base, aiProse: true, selectionActions: [rewrite, note]}} onSettingsChange={onSettingsChange} />);
    fireEvent.click(screen.getByRole('checkbox', {name: 'Tighten on'}));
    expect(onSettingsChange.mock.calls[0][0].selectionActions).toEqual([{...rewrite, enabled: true}, note]);
  });

  it('adds a new action switched on', () => {
    const onSettingsChange = vi.fn();
    render(<AIActionsSection aiSettings={{...base, aiCoaching: true, selectionActions: []}} onSettingsChange={onSettingsChange} />);
    fireEvent.change(screen.getByLabelText('Action name'), {target: {value: ' Plot holes '}});
    fireEvent.change(screen.getByLabelText('Action instructions'), {target: {value: 'Find plot holes.'}});
    fireEvent.click(screen.getByLabelText('The current scene'));
    fireEvent.click(screen.getByRole('button', {name: 'Add AI Action'}));
    expect(onSettingsChange.mock.calls[0][0].selectionActions).toEqual([
      expect.objectContaining({name: 'Plot holes', instructions: 'Find plot holes.', output: 'note', includeScene: true, enabled: true})
    ]);
  });

  it('re-adds deleted presets without touching edited ones', () => {
    const onSettingsChange = vi.fn();
    const edited = {...SELECTION_ACTION_PRESETS[0], instructions: 'Mine.'};
    render(<AIActionsSection aiSettings={{...base, aiCoaching: true, aiProse: true, selectionActions: [edited]}} onSettingsChange={onSettingsChange} />);
    fireEvent.click(screen.getByRole('button', {name: 'Install Presets'}));
    const saved = onSettingsChange.mock.calls[0][0].selectionActions as SelectionAction[];
    expect(saved[0]).toEqual(edited);
    expect(saved).toHaveLength(SELECTION_ACTION_PRESETS.length);
  });
});
