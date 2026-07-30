import type {ReactElement} from 'react';
import {fireEvent, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it} from 'vitest';
import CharacterSheetsRoute from './CharacterSheetsRoute';
import CharactersRoute from './CharactersRoute';
import CompendiumRoute from './CompendiumRoute';
import LoreRoute from './LoreRoute';
import ProjectsRoute from './ProjectsRoute';
import SettingsRoute from './SettingsRoute';
import WorkspaceRoute from './WorkspaceRoute';
import WorldBibleRoute from './WorldBibleRoute';
import {renderRoute, seedRouteTestState} from '../test/renderRoute';

beforeEach(() => {
  seedRouteTestState();
});

describe('route smoke coverage', () => {
  const routes: Array<{
    name: string;
    path: string;
    route: ReactElement;
    heading: string;
  }> = [
    {
      name: 'WorkspaceRoute',
      path: '/workspace',
      route: <WorkspaceRoute />,
      heading: 'Writing Workspace'
    },
    {
      name: 'WorldBibleRoute',
      path: '/world-bible',
      route: <WorldBibleRoute />,
      heading: 'World Bible'
    },
    {
      name: 'CompendiumRoute',
      path: '/compendium',
      route: <CompendiumRoute />,
      heading: 'Mechanics'
    },
    {
      name: 'CharacterSheetsRoute',
      path: '/character-sheets',
      route: <CharacterSheetsRoute />,
      heading: 'Character Sheets'
    },
    {
      name: 'LoreRoute',
      path: '/lore',
      route: <LoreRoute />,
      heading: 'Source Notes'
    },
    {
      name: 'CharactersRoute',
      path: '/characters',
      route: <CharactersRoute />,
      heading: 'Character Tools'
    },
    {
      name: 'ProjectsRoute',
      path: '/projects',
      route: <ProjectsRoute />,
      heading: 'Projects'
    },
    {
      name: 'SettingsRoute',
      path: '/settings',
      route: <SettingsRoute />,
      heading: 'Settings'
    }
  ];

  it.each(routes)('$name renders its distinguishing heading', async ({
    path,
    route,
    heading
  }) => {
    renderRoute(route, path);

    expect(
      await screen.findByRole('heading', {name: heading, level: 1})
    ).toBeInTheDocument();
  });

  it('switches CompendiumRoute from Overview to Entries', async () => {
    renderRoute(<CompendiumRoute />, '/compendium');

    expect(
      await screen.findByRole('heading', {name: 'What To Do Next', level: 2})
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Entries'}));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {name: 'Entries', level: 2})
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Create/import mechanics entries and record progression actions.'
        )
      ).toBeInTheDocument();
    });
  });
});
