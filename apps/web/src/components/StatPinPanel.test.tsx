import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {renderRoute, seedRouteTestState} from '../test/renderRoute';
import {useAppStore} from '../store/appStore';
import {useWorkspaceUiStore} from '../store/workspaceUiStore';
import {saveEntity} from '../entityStorage';
import {saveCharacterSheet} from '../services/characters/characterSheetService';
import {saveWritingDocument} from '../writingStorage';
import {saveChapterCard} from '../corkboardStorage';
import type {CharacterSnapshot} from '../services/state/characterSnapshot';
import {StatPinPanel} from './StatPinPanel';

const projectId = 'route-smoke-project';

const pin = (...sheetIds: string[]) =>
  useWorkspaceUiStore.getState().setStatPins(projectId, sheetIds);

const snapshotFor = (level: number, health: number): CharacterSnapshot => ({
  sheetId: 'sheet-pin-oren',
  name: 'Oren Pin',
  level,
  stats: [],
  resources: [{id: 'hp', label: 'Health', current: health, max: 40}],
  inventory: [],
  statuses: []
});

describe('StatPinPanel', () => {
  beforeAll(async () => {
    await saveEntity({
      id: 'entity-pin-oren',
      projectId,
      categoryId: 'characters',
      name: 'Oren Pin',
      fields: {},
      links: [],
      createdAt: 1,
      updatedAt: 1
    });
    await saveCharacterSheet({
      id: 'sheet-pin-oren',
      projectId,
      characterEntityId: 'entity-pin-oren',
      name: 'Oren Pin',
      level: 7,
      experience: 0,
      stats: [],
      resources: [],
      inventory: [],
      createdAt: 1,
      updatedAt: 1
    });
    for (const [id, order, title] of [
      ['pin-scene-1', 1, 'Opening'],
      ['pin-scene-2', 2, 'Middle'],
      ['pin-scene-3', 3, 'Vault']
    ] as const) {
      await saveWritingDocument({
        id,
        projectId,
        title,
        content: '<p>Text</p>',
        order,
        createdAt: order,
        updatedAt: order
      });
    }
    await saveChapterCard({
      id: 'pin-chapter-2',
      projectId,
      title: 'Into the Vault',
      summary: '',
      status: 'draft',
      order: 2,
      sceneIds: ['pin-scene-2', 'pin-scene-3'],
      plotPoints: [],
      createdAt: 1,
      updatedAt: 1
    });
  });

  beforeEach(() => {
    seedRouteTestState();
  });

  it('stays hidden without pins and on routes outside writing and brainstorming', async () => {
    renderRoute(<StatPinPanel isRailCollapsed={false} />, '/corkboard');
    expect(screen.queryByRole('complementary', {name: 'Pinned stats'})).not.toBeInTheDocument();

    act(() => pin('sheet-pin-oren'));
    expect(await screen.findByRole('complementary', {name: 'Pinned stats'})).toBeInTheDocument();
  });

  it('is not shown on other routes or without game systems', () => {
    pin('sheet-pin-oren');
    const {unmount} = renderRoute(<StatPinPanel isRailCollapsed={false} />, '/settings');
    expect(screen.queryByRole('complementary', {name: 'Pinned stats'})).not.toBeInTheDocument();
    unmount();

    const settings = useAppStore.getState().projectSettings;
    if (!settings) throw new Error('Expected seeded settings.');
    useAppStore.setState({
      projectSettings: {
        ...settings,
        featureToggles: {...settings.featureToggles!, enableGameSystems: false}
      }
    });
    renderRoute(<StatPinPanel isRailCollapsed={false} />, '/corkboard');
    expect(screen.queryByRole('complementary', {name: 'Pinned stats'})).not.toBeInTheDocument();
  });

  it('shows latest state, reads as of the end of a chosen scene, collapses, and unpins', async () => {
    pin('sheet-pin-oren');
    renderRoute(<StatPinPanel isRailCollapsed={false} />, '/world-canvas');

    const panel = await screen.findByRole('complementary', {name: 'Pinned stats'});
    const card = await within(panel).findByRole('article', {name: 'Oren Pin stats'});
    expect(within(card).getByText('Level 7')).toBeInTheDocument();
    expect(within(card).getByText('Latest, after every accepted change')).toBeInTheDocument();
    expect(within(card).getByRole('button', {name: 'Open sheet'})).toBeInTheDocument();

    fireEvent.change(within(panel).getByRole('combobox', {name: 'As of'}), {
      target: {value: 'pin-scene-2'}
    });
    expect(within(panel).getByText('At the end of Middle')).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', {name: 'Pinned stats (1)'}));
    expect(within(panel).queryByRole('article')).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', {name: 'Pinned stats (1)'}));

    fireEvent.click(within(panel).getByRole('button', {name: "Unpin Oren Pin's stats"}));
    await waitFor(() =>
      expect(screen.queryByRole('complementary', {name: 'Pinned stats'})).not.toBeInTheDocument()
    );
    expect(useWorkspaceUiStore.getState().statPinsByProjectId[projectId]).toEqual([]);
  });

  it('follows the Workspace cursor and compares against the previous chapter', async () => {
    pin('sheet-pin-oren');
    const positions: unknown[] = [];
    useWorkspaceUiStore.getState().setWorkspaceStatContext({
      projectId,
      sceneId: 'pin-scene-3',
      sceneTitle: 'Vault',
      sceneOrder: 3,
      cursorPosition: 12,
      getSnapshot: (_sheetId, position) => {
        positions.push(position);
        return position.kind === 'scene' && position.moment === 'opening'
          ? snapshotFor(3, 40)
          : snapshotFor(4, 12);
      }
    });
    renderRoute(<StatPinPanel isRailCollapsed />, '/workspace');

    const panel = await screen.findByRole('complementary', {name: 'Pinned stats'});
    expect(within(panel).getByText('At the cursor in Vault')).toBeInTheDocument();
    expect(within(panel).queryByRole('combobox', {name: 'As of'})).not.toBeInTheDocument();
    expect(positions[0]).toEqual({kind: 'scene', sceneOrder: 3, moment: 'cursor', cursorPosition: 12});

    fireEvent.click(within(panel).getByRole('button', {name: 'Changes since previous chapter'}));
    // The baseline appears once the saved scenes and chapter cards load.
    expect(
      await within(panel).findByText('Since the previous chapter, before “Into the Vault”')
    ).toBeInTheDocument();
    const changes = within(panel).getByLabelText('Oren Pin changes');
    expect(within(changes).getByText('Level 3 → 4')).toBeInTheDocument();
    expect(within(changes).getByText('Health 40/40 → 12/40')).toBeInTheDocument();
    expect(positions).toContainEqual({kind: 'scene', sceneOrder: 2, moment: 'opening'});

    act(() => useWorkspaceUiStore.getState().setWorkspaceStatContext(null));
  });
});
