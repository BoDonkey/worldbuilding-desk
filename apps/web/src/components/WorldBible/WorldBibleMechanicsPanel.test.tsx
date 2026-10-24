import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {WorldBibleMechanicsPanel} from './WorldBibleMechanicsPanel';
import {getMechanicsDraft, saveMechanicsDraft} from '../../services/storage';
import type {StoredRuleset} from '../../entityTypes';
import {MECHANICS_DRAFT_STORE_NAME, openDb} from '../../services/storage/db';
import {transactionToPromise} from '../../services/storage/idbRequest';

async function clearDrafts(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(MECHANICS_DRAFT_STORE_NAME, 'readwrite');
  tx.objectStore(MECHANICS_DRAFT_STORE_NAME).clear();
  await transactionToPromise(tx);
}

const ruleset: StoredRuleset = {id: 'rules', projectId: 'p', name: 'Rules', version: '1', statDefinitions: [], resourceDefinitions: [{id: 'health', name: 'Health', type: 'number', defaultValue: 100}], rules: [], itemTemplates: [], statusTemplates: [], createdAt: 1, updatedAt: 1};

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
  projectId: 'p',
  entityId: 'mira'
};

describe('WorldBibleMechanicsPanel', () => {
  beforeEach(async () => {
    await clearDrafts();
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

  it('restores an interrupted draft for the same character from project storage', async () => {
    await saveMechanicsDraft({projectId: 'p', entityId: 'mira', kind: 'stat', name: 'Resolve', defaultValue: '8'});
    render(<WorldBibleMechanicsPanel {...baseProps} />);
    expect(await screen.findByDisplayValue('Resolve')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: /Stat/})).toBeChecked();
  });

  it('keeps what the author types in project storage, not localStorage', async () => {
    const {unmount} = render(<WorldBibleMechanicsPanel {...baseProps} />);
    fireEvent.click(screen.getByRole('button', {name: 'Add mechanics'}));
    fireEvent.change(screen.getByLabelText('Value name'), {target: {value: 'Stamina'}});
    fireEvent.change(screen.getByLabelText('Starting value'), {target: {value: '45'}});
    await waitFor(async () => expect(await getMechanicsDraft('p', 'mira')).toMatchObject({
      id: 'p:mechanics-draft:mira', projectId: 'p', entityId: 'mira',
      kind: 'resource', name: 'Stamina', defaultValue: '45'
    }));
    expect(window.localStorage.length).toBe(0);
    unmount();

    render(<WorldBibleMechanicsPanel {...baseProps} />);
    expect(await screen.findByDisplayValue('Stamina')).toBeInTheDocument();
    expect(screen.getByDisplayValue('45')).toBeInTheDocument();
  });

  it('discards the draft on cancel, even with a save still pending', async () => {
    render(<WorldBibleMechanicsPanel {...baseProps} />);
    fireEvent.click(screen.getByRole('button', {name: 'Add mechanics'}));
    fireEvent.change(screen.getByLabelText('Value name'), {target: {value: 'Focus'}});
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(screen.getByRole('button', {name: 'Add mechanics'})).toBeInTheDocument();
    await waitFor(async () => expect(await getMechanicsDraft('p', 'mira')).toBeNull());
    // Give any write that was still queued time to land before checking again.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await getMechanicsDraft('p', 'mira')).toBeNull();
  });

  it('moves a draft left in localStorage by an older build, then removes the key', async () => {
    window.localStorage.setItem('wbd:first-mechanics:p:mira', JSON.stringify({
      isAdding: true, kind: 'stat', name: 'Grit', defaultValue: '3'
    }));
    window.localStorage.setItem('wbd:first-mechanics:p:sera', JSON.stringify({
      isAdding: true, kind: 'resource', name: 'Mana', defaultValue: '40'
    }));
    window.localStorage.setItem('wbd:first-mechanics:other:mira', JSON.stringify({
      isAdding: true, kind: 'stat', name: 'Other project', defaultValue: '1'
    }));
    render(<WorldBibleMechanicsPanel {...baseProps} />);
    expect(await screen.findByDisplayValue('Grit')).toBeInTheDocument();
    expect(window.localStorage.getItem('wbd:first-mechanics:p:mira')).toBeNull();
    expect(window.localStorage.getItem('wbd:first-mechanics:p:sera')).toBeNull();
    expect(await getMechanicsDraft('p', 'sera')).toMatchObject({kind: 'resource', name: 'Mana', defaultValue: '40'});
    // Another project's draft waits for that project to open.
    expect(window.localStorage.getItem('wbd:first-mechanics:other:mira')).not.toBeNull();
  });

  it('prefers the project-storage draft over an older localStorage copy', async () => {
    await saveMechanicsDraft({projectId: 'p', entityId: 'mira', kind: 'stat', name: 'Newer', defaultValue: '9'});
    window.localStorage.setItem('wbd:first-mechanics:p:mira', JSON.stringify({
      isAdding: true, kind: 'resource', name: 'Older', defaultValue: '1'
    }));
    render(<WorldBibleMechanicsPanel {...baseProps} />);
    expect(await screen.findByDisplayValue('Newer')).toBeInTheDocument();
    expect(window.localStorage.getItem('wbd:first-mechanics:p:mira')).toBeNull();
  });

  it('drops a leftover draft once tracking is set up', async () => {
    await saveMechanicsDraft({projectId: 'p', entityId: 'mira', kind: 'stat', name: 'Resolve', defaultValue: '8'});
    render(<WorldBibleMechanicsPanel {...baseProps} hasRuleset ruleset={ruleset} />);
    await waitFor(async () => expect(await getMechanicsDraft('p', 'mira')).toBeNull());
  });

  it('shows the replayed value after an accepted scene change', () => {
    render(<WorldBibleMechanicsPanel
      {...baseProps}
      hasRuleset
      ruleset={ruleset}
      characterSheet={{id: 'sheet', projectId: 'p', characterEntityId: 'mira', name: 'Mira', level: 1, experience: 0, stats: [], resources: [{definitionId: 'health', current: 100, max: 100}], inventory: [], createdAt: 1, updatedAt: 1}}
      stateEventCount={1}
      stateEvents={[{id: 'event', projectId: 'p', sceneId: 'scene', sceneOrder: 1, sceneSequence: 1, sourceType: 'manual', sourceRevision: 1, sourceHash: 'hash', status: 'accepted', commands: [{type: 'resource_change', actorId: 'mira', resourceDefinitionId: 'health', delta: -10}], createdAt: 2}]}
    />);
    expect(screen.getByText('90 / 100')).toBeInTheDocument();
  });
});
