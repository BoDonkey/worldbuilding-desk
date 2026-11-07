import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {SelectionMenuAIEntries} from './SelectionMenuAIEntries';
import {menuSelectionActions} from '../../services/assistant/selectionActions';
import type {ProjectAISettings, SelectionAction} from '../../entityTypes';

const selection = {selectedText: 'Alpha', from: 1, to: 6};
const action = (id: string, name: string, output: 'replace' | 'note', enabled = true): SelectionAction => ({
  id, name, instructions: `${name}.`, includeScene: false, includeWorldBible: false, output, enabled
});

function renderMenu(aiSettings: Partial<ProjectAISettings>, onRun = vi.fn(), onDone = vi.fn()) {
  const actions = menuSelectionActions(aiSettings as ProjectAISettings);
  render(
    <SelectionMenuAIEntries
      onAskAI={vi.fn()}
      controls={actions.length ? {actions, disclosure: null, busy: false, onRun} : undefined}
      selection={selection}
      getPassage={() => 'Alpha'}
      onDone={onDone}
    />
  );
  return {onRun, onDone};
}

describe('AI actions in the selection menu (5.19)', () => {
  it('lists only switched-on actions after Ask AI about this, and runs one on the selection', () => {
    const {onRun, onDone} = renderMenu({
      aiCoaching: true,
      aiProse: true,
      selectionActions: [action('t', 'Tighten', 'replace'), action('c', 'Check', 'note'), action('o', 'Off', 'replace', false)]
    });
    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons).toEqual(['Ask AI about this', 'Tighten', 'Check']);
    fireEvent.click(screen.getByRole('button', {name: 'Tighten'}));
    expect(onRun).toHaveBeenCalledWith('t', {...selection, passage: 'Alpha'});
    expect(onDone).toHaveBeenCalled();
  });

  it('lists nothing for actions whose AI switch is off', () => {
    renderMenu({aiCoaching: true, selectionActions: [action('t', 'Tighten', 'replace')]});
    expect(screen.queryByRole('button', {name: 'Tighten'})).not.toBeInTheDocument();
  });

  it('groups many actions under one entry', () => {
    renderMenu({
      aiProse: true,
      selectionActions: ['A', 'B', 'C', 'D'].map((name) => action(name, name, 'replace'))
    });
    expect(screen.queryByRole('button', {name: 'A'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: /AI actions/}));
    expect(screen.getByRole('group', {name: 'AI actions'})).toHaveTextContent('ABCD');
  });
});
