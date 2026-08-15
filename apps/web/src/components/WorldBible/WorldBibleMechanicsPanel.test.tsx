import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {WorldBibleMechanicsPanel} from './WorldBibleMechanicsPanel';

const baseProps = {
  characterSheet: null,
  ruleset: null,
  hasRuleset: false,
  stateEventCount: 0,
  stateEvents: [],
  isSaving: false,
  isOpeningSheet: false,
  onCreate: vi.fn().mockResolvedValue(undefined),
  onRecordChange: vi.fn(),
  onOpenAdvanced: vi.fn(),
  onAddSheet: vi.fn(),
  draftStorageKey: 'test:first-mechanics'
};

describe('WorldBibleMechanicsPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('starts with one optional value and writes only after confirmation', async () => {
    render(<WorldBibleMechanicsPanel {...baseProps} />);
    fireEvent.click(screen.getByRole('button', {name: 'Add mechanics'}));
    expect(screen.getByDisplayValue('Health')).toBeInTheDocument();
    expect(baseProps.onCreate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Enable tracking'}));
    await waitFor(() => expect(baseProps.onCreate).toHaveBeenCalledWith({
      kind: 'resource', name: 'Health', defaultValue: 100
    }));
  });

  it('restores an interrupted draft for the same character', () => {
    window.localStorage.setItem(baseProps.draftStorageKey, JSON.stringify({
      isAdding: true, kind: 'stat', name: 'Resolve', defaultValue: '8'
    }));
    render(<WorldBibleMechanicsPanel {...baseProps} />);
    expect(screen.getByDisplayValue('Resolve')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
  });

  it('shows the replayed value after an accepted scene change', () => {
    render(<WorldBibleMechanicsPanel
      {...baseProps}
      hasRuleset
      ruleset={{id: 'rules', projectId: 'p', name: 'Rules', version: '1', statDefinitions: [], resourceDefinitions: [{id: 'health', name: 'Health', type: 'number', defaultValue: 100}], rules: [], itemTemplates: [], statusTemplates: [], createdAt: 1, updatedAt: 1}}
      characterSheet={{id: 'sheet', projectId: 'p', characterEntityId: 'mira', name: 'Mira', level: 1, experience: 0, stats: [], resources: [{definitionId: 'health', current: 100, max: 100}], inventory: [], createdAt: 1, updatedAt: 1}}
      stateEventCount={1}
      stateEvents={[{id: 'event', projectId: 'p', sceneId: 'scene', sceneOrder: 1, sceneSequence: 1, sourceType: 'manual', sourceRevision: 1, sourceHash: 'hash', status: 'accepted', commands: [{type: 'resource_change', actorId: 'mira', resourceDefinitionId: 'health', delta: -10}], createdAt: 2}]}
    />);
    expect(screen.getByText('90 / 100')).toBeInTheDocument();
  });
});
