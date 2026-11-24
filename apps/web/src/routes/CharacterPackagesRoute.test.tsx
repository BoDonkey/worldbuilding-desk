import {fireEvent, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import CharacterPackagesRoute from './CharacterPackagesRoute';
import {renderRoute, seedRouteTestState} from '../test/renderRoute';

const PROJECT = 'route-smoke-project';
const mocks = vi.hoisted(() => ({exportCharactersJson: vi.fn(async () => {})}));

vi.mock('../services/characters', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/characters')>()),
  exportCharactersJson: mocks.exportCharactersJson
}));

vi.mock('../services/storage', async (importOriginal) => {
  const entity = (id: string, name: string) => ({
    id, projectId: PROJECT, categoryId: 'characters', name, fields: {}, links: [], createdAt: 1, updatedAt: 1
  });
  return {
    ...(await importOriginal<typeof import('../services/storage')>()),
    getRulesetByProjectId: vi.fn(async () => null),
    getCategoriesByProject: vi.fn(async () => [
      {id: 'characters', projectId: PROJECT, kind: 'character', name: 'Characters', slug: 'characters', fieldSchema: [], createdAt: 1}
    ]),
    getEntitiesByProject: vi.fn(async () => [entity('e-mira', 'Mira Voss'), entity('e-tobin', 'Tobin Hale'), entity('e-wren', 'Wren Adair')]),
    getAliasesByProject: vi.fn(async () => [
      {id: 'a1', projectId: PROJECT, targetType: 'entity', targetId: 'e-wren', alias: 'The Lamplighter', createdAt: 1, updatedAt: 1}
    ]),
    getCharactersByProject: vi.fn(async () => [
      // Legacy capability record with no World Bible character: in the Needs canon link queue.
      {id: 'legacy-orin', projectId: PROJECT, name: 'Orin', fields: {}, createdAt: 1, updatedAt: 1}
    ]),
    getCharacterSheetsByProject: vi.fn(async () => [])
  };
});

describe('CharacterPackagesRoute picker (4.87)', () => {
  beforeEach(() => {
    seedRouteTestState();
    mocks.exportCharactersJson.mockClear();
  });

  it('exports exactly the selected World Bible characters', async () => {
    renderRoute(<CharacterPackagesRoute />, '/character-packages');
    fireEvent.click(await screen.findByRole('checkbox', {name: /Wren Adair/}));
    fireEvent.click(screen.getByRole('checkbox', {name: /Mira Voss/}));
    expect(screen.getByText('2 of 3 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Export selected'}));

    await waitFor(() => expect(mocks.exportCharactersJson).toHaveBeenCalledTimes(1));
    expect(mocks.exportCharactersJson).toHaveBeenCalledWith({
      projectId: PROJECT,
      projectName: 'Route Smoke Project',
      includeSheets: false,
      entityIds: ['e-mira', 'e-wren']
    });
    expect(await screen.findByText('2 characters exported.')).toBeInTheDocument();
  });

  it('keeps Export all unfiltered, searches aliases, and lists queue records without a usable checkbox', async () => {
    renderRoute(<CharacterPackagesRoute />, '/character-packages');
    expect(await screen.findByRole('checkbox', {name: 'Orin (needs a canon link)'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Export selected'})).toBeDisabled();

    fireEvent.change(screen.getByRole('searchbox', {name: 'Search characters'}), {target: {value: 'lamp'}});
    expect(screen.getByRole('checkbox', {name: /Wren Adair/})).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', {name: /Mira Voss/})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Select all shown'}));
    expect(screen.getByText('1 of 3 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Export all characters'}));
    await waitFor(() => expect(mocks.exportCharactersJson).toHaveBeenCalledWith({
      projectId: PROJECT,
      projectName: 'Route Smoke Project',
      includeSheets: false
    }));
  });
});
