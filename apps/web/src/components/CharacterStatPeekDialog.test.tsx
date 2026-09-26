import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {renderRoute, seedRouteTestState} from '../test/renderRoute';
import {useAppStore} from '../store/appStore';
import {saveCharacterSheet} from '../services/characters/characterSheetService';
import {saveEntity} from '../entityStorage';
import {
  CHARACTER_STAT_PEEK_EVENT,
  type CharacterStatPeekRequestDetail
} from '../commands/characterStatPeek';

const projectId = 'route-smoke-project';

const openPaletteAndType = async (text: string) => {
  fireEvent.keyDown(window, {key: 'k', metaKey: true});
  const input = await screen.findByPlaceholderText('Type a command...');
  fireEvent.change(input, {target: {value: text}});
  return input;
};

describe('Show stats for… in the command palette', () => {
  beforeAll(async () => {
    await saveEntity({
      id: 'entity-peek-mira',
      projectId,
      categoryId: 'characters',
      name: 'Mira Peek',
      fields: {},
      links: [],
      createdAt: 1,
      updatedAt: 1
    });
    await saveCharacterSheet({
      id: 'sheet-peek-mira',
      projectId,
      characterEntityId: 'entity-peek-mira',
      name: 'Mira Peek',
      level: 3,
      experience: 0,
      stats: [],
      resources: [],
      inventory: [],
      statuses: ['Hasted'],
      createdAt: 1,
      updatedAt: 1
    });
  });

  beforeEach(() => {
    seedRouteTestState();
  });

  let removeWorkspaceListener: (() => void) | null = null;
  afterEach(() => {
    removeWorkspaceListener?.();
    removeWorkspaceListener = null;
  });

  it('opens the latest stats for a character found by name', async () => {
    const settings = useAppStore.getState().projectSettings;
    if (!settings) throw new Error('Expected seeded project settings.');
    useAppStore.setState({
      projectSettings: {
        ...settings,
        statBlockPreferences: {sourceType: 'character', style: 'compact', insertMode: 'block'}
      }
    });
    renderRoute(<div />, '/corkboard');

    await openPaletteAndType('mira peek');
    fireEvent.click(await screen.findByRole('option', {name: /Show stats for Mira Peek/}));

    const dialog = await screen.findByRole('dialog', {name: 'Show stats for'});
    const card = await within(dialog).findByRole('article', {name: 'Mira Peek stats'});
    expect(within(card).getByText('Level 3')).toBeInTheDocument();
    expect(within(card).getByText('Hasted')).toBeInTheDocument();
    expect(within(card).getByText('Latest, after every accepted change')).toBeInTheDocument();
    expect(within(card).getByText('[Character Status • Compact]')).toBeInTheDocument();

    fireEvent.keyDown(dialog, {key: 'Escape'});
    expect(screen.queryByRole('dialog', {name: 'Show stats for'})).not.toBeInTheDocument();
  });

  it('lets the author search characters from the generic command', async () => {
    renderRoute(<div />, '/world-canvas');

    await openPaletteAndType('show stats');
    fireEvent.click(await screen.findByRole('option', {name: /Show stats for…/}));

    const dialog = await screen.findByRole('dialog', {name: 'Show stats for'});
    fireEvent.change(within(dialog).getByRole('textbox', {name: 'Character name'}), {
      target: {value: 'mira'}
    });
    fireEvent.click(await within(dialog).findByRole('option', {name: /Mira Peek/}));
    expect(await within(dialog).findByRole('article', {name: 'Mira Peek stats'})).toBeInTheDocument();
  });

  it('hands the pick to a surface that shows it in place', async () => {
    const requests: string[] = [];
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<CharacterStatPeekRequestDetail>).detail;
      requests.push(detail.sheetId);
      detail.handled = true;
    };
    window.addEventListener(CHARACTER_STAT_PEEK_EVENT, onRequest);
    removeWorkspaceListener = () =>
      window.removeEventListener(CHARACTER_STAT_PEEK_EVENT, onRequest);
    renderRoute(<div />, '/workspace');

    await openPaletteAndType('mira peek');
    fireEvent.click(await screen.findByRole('option', {name: /Show stats for Mira Peek/}));

    await waitFor(() => expect(requests).toEqual(['sheet-peek-mira']));
    expect(screen.queryByRole('dialog', {name: 'Show stats for'})).not.toBeInTheDocument();
  });

  it('is hidden when game systems are disabled', async () => {
    const settings = useAppStore.getState().projectSettings;
    if (!settings) throw new Error('Expected seeded project settings.');
    useAppStore.setState({
      projectSettings: {
        ...settings,
        projectMode: 'general',
        featureToggles: {
          enableGameSystems: false,
          enableRuntimeModifiers: false,
          enableSettlementAndZoneSystems: false,
          enableRuleAuthoring: false
        }
      }
    });
    renderRoute(<div />, '/corkboard');

    await openPaletteAndType('stats');
    await waitFor(() =>
      expect(screen.queryByRole('option', {name: /Show stats for/})).not.toBeInTheDocument()
    );
    fireEvent.change(screen.getByPlaceholderText('Type a command...'), {
      target: {value: 'mira peek'}
    });
    expect(screen.queryByRole('option', {name: /Show stats for Mira Peek/})).not.toBeInTheDocument();
  });
});
