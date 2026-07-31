import type {ReactElement} from 'react';
import {render} from '@testing-library/react';
import {
  createMemoryRouter,
  type InitialEntry
} from 'react-router';
import {RouterProvider} from 'react-router/dom';
import type {Project, ProjectSettings} from '../entityTypes';
import {AccessibilityProvider} from '../contexts/AccessibilityContext';
import {CommandPaletteProvider} from '../contexts/CommandPaletteContext';
import {ThemeProvider} from '../contexts/ThemeContext';
import {useAppStore} from '../store/appStore';
import {useWorkspaceUiStore} from '../store/workspaceUiStore';

const project: Project = {
  id: 'route-smoke-project',
  name: 'Route Smoke Project',
  createdAt: 1,
  updatedAt: 1
};

const projectSettings: ProjectSettings = {
  id: 'route-smoke-settings',
  projectId: project.id,
  characterStyles: [],
  aiSettings: {
    provider: 'ollama',
    configs: {},
    promptTools: [],
    defaultToolIds: []
  },
  consistencyActionCues: [],
  activeSkills: [],
  projectMode: 'litrpg',
  featureToggles: {
    enableGameSystems: true,
    enableRuntimeModifiers: true,
    enableSettlementAndZoneSystems: true,
    enableRuleAuthoring: true
  },
  createdAt: 1,
  updatedAt: 1
};

export function seedRouteTestState() {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({
    activeProject: project,
    projectSettings,
    projectSettingsStatus: 'ready',
    projectSettingsError: null,
    isRailCollapsed: false
  });
  useWorkspaceUiStore.setState(useWorkspaceUiStore.getInitialState(), true);
}

export function renderRoute(
  route: ReactElement,
  initialEntry: InitialEntry = '/'
) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <ThemeProvider>
            <AccessibilityProvider>
              <CommandPaletteProvider>{route}</CommandPaletteProvider>
            </AccessibilityProvider>
          </ThemeProvider>
        )
      }
    ],
    {initialEntries: [initialEntry]}
  );

  return {
    router,
    ...render(<RouterProvider router={router} />)
  };
}
