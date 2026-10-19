import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import CompendiumRoute from './CompendiumRoute';
import {renderRoute, seedRouteTestState} from '../test/renderRoute';
import * as compendium from '../services/compendium';

beforeEach(async () => {
  seedRouteTestState();
  const settlement = await compendium.getOrCreateSettlementState('route-smoke-project');
  vi.spyOn(compendium, 'getOrCreateSettlementState').mockResolvedValue(settlement);
});
afterEach(() => vi.restoreAllMocks());

async function openAdvanced() {
  renderRoute(<CompendiumRoute />, '/compendium');
  fireEvent.click(await screen.findByRole('button', {name: 'Advanced mechanics'}));
  await screen.findByRole('heading', {name: 'What To Do Next'});
}

const tab = (name: string) => fireEvent.click(screen.getByRole('button', {name}));
const section = (name: string) => within(screen.getByRole('heading', {name}).closest('section')!);
const change = (element: HTMLElement, value: string) => fireEvent.change(element, {target: {value}});

describe('Compendium form lifetimes', () => {
  it('keeps independent entry, progression, preview, and zone drafts across tab unmounts', async () => {
    await openAdvanced();
    tab('Entries');
    const entry = within(screen.getByRole('heading', {name: 'Add Entry'}).closest('article')!);
    change(entry.getByLabelText('Name'), 'Unfinished beast');
    change(entry.getByLabelText('Domain'), 'mineral');
    const imported = within(screen.getByRole('heading', {name: 'Import from World Bible'}).closest('article')!);
    change(imported.getByLabelText('Mechanics type'), 'zone');
    change(imported.getByLabelText('Progress scope'), 'global');

    tab('Progression');
    change(section('Recipes').getByLabelText('Name'), 'Draft recipe');
    change(section('Recipes').getByLabelText('Category'), 'alchemy');
    change(section('Milestones').getByLabelText('Name'), 'Draft milestone');
    change(section('Craftability Preview').getByLabelText('Character Level'), '7');
    change(section('Craftability Preview').getByLabelText(/Materials \(one per line/), 'iron:3');

    tab('World Systems');
    change(screen.getByLabelText('Zone Name'), 'Draft zone');
    change(screen.getByLabelText('Zone Key'), 'draft_zone');
    change(screen.getByLabelText('Module Name'), 'Draft trophy');
    change(await screen.findByLabelText('defense'), '34');

    tab('Entries');
    const restoredEntry = within(screen.getByRole('heading', {name: 'Add Entry'}).closest('article')!);
    expect(restoredEntry.getByLabelText('Name')).toHaveValue('Unfinished beast');
    expect(restoredEntry.getByLabelText('Domain')).toHaveValue('mineral');
    const restoredImport = within(screen.getByRole('heading', {name: 'Import from World Bible'}).closest('article')!);
    expect(restoredImport.getByLabelText('Mechanics type')).toHaveValue('zone');
    expect(restoredImport.getByLabelText('Progress scope')).toHaveValue('global');
    tab('Progression');
    expect(section('Recipes').getByLabelText('Name')).toHaveValue('Draft recipe');
    expect(section('Recipes').getByLabelText('Category')).toHaveValue('alchemy');
    expect(section('Milestones').getByLabelText('Name')).toHaveValue('Draft milestone');
    expect(section('Craftability Preview').getByLabelText('Character Level')).toHaveValue(7);
    expect(section('Craftability Preview').getByLabelText(/Materials \(one per line/)).toHaveValue('iron:3');
    tab('World Systems');
    expect(screen.getByLabelText('Zone Name')).toHaveValue('Draft zone');
    expect(screen.getByLabelText('Zone Key')).toHaveValue('draft_zone');
    expect(screen.getByLabelText('Module Name')).toHaveValue('Draft trophy');
    expect(screen.getByLabelText('defense')).toHaveValue(34);
    expect(screen.getByRole('button', {name: 'Save Base Stats'})).toBeEnabled();
    fireEvent.click(screen.getByRole('button', {name: 'Reset'}));
    expect(screen.getByLabelText('defense')).toHaveValue(10);
    expect(screen.getByRole('button', {name: 'Save Base Stats'})).toBeDisabled();
  });

  it('submits the same normalized recipe and resets only the fields reset before extraction', async () => {
    const save = vi.spyOn(compendium, 'saveUnlockableRecipe').mockResolvedValue();
    await openAdvanced();
    tab('Progression');
    const recipe = section('Recipes');
    change(recipe.getByLabelText('Name'), '  Ward Tonic  ');
    change(recipe.getByLabelText('Category'), 'alchemy');
    change(recipe.getByLabelText('Min Character Level'), '3.8');
    change(recipe.getByLabelText(/Required Milestone IDs/), ' first, ,second, first ');
    fireEvent.click(recipe.getByRole('button', {name: 'Add Recipe'}));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0]).toMatchObject({
      projectId: 'route-smoke-project', name: 'Ward Tonic', category: 'alchemy',
      requirements: {minCharacterLevel: 3, requiredMilestoneIds: ['first', 'second', 'first']}
    });
    await waitFor(() => expect(recipe.getByLabelText('Name')).toHaveValue(''));
    expect(recipe.getByLabelText('Min Character Level')).toHaveValue(1);
    expect(recipe.getByLabelText(/Required Milestone IDs/)).toHaveValue('');
    expect(recipe.getByLabelText('Category')).toHaveValue('alchemy');
    expect(await screen.findByText('Unlockable recipe added.')).toBeInTheDocument();
  });

  it('keeps recipe input when persistence rejects and does not add an unsaved list entry', async () => {
    vi.spyOn(compendium, 'saveUnlockableRecipe').mockRejectedValue(new DOMException('IndexedDB error', 'UnknownError'));
    await openAdvanced();
    tab('Progression');
    const recipe = section('Recipes');
    change(recipe.getByLabelText('Name'), 'Keep this draft');
    change(recipe.getByLabelText(/Required Milestone IDs/), 'first');
    fireEvent.click(recipe.getByRole('button', {name: 'Add Recipe'}));
    expect(await screen.findByText('Unable to save recipe.')).toBeInTheDocument();
    expect(recipe.getByLabelText('Name')).toHaveValue('Keep this draft');
    expect(recipe.getByLabelText(/Required Milestone IDs/)).toHaveValue('first');
    expect(recipe.queryByText(/Locked: Keep this draft/)).not.toBeInTheDocument();
  });
});
