import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation
} from 'react-router-dom';
import type {Project, ProjectSettings} from './entityTypes';
import {Navigation} from './components/Navigation';
import {ThemeProvider} from './contexts/ThemeContext';
import {AccessibilityProvider} from './contexts/AccessibilityContext';
import {CommandPaletteProvider} from './contexts/CommandPaletteContext';
import {useAppShellState} from './hooks/useAppShellState';
import ProjectsRoute from './routes/ProjectsRoute';
import WorldBibleRoute from './routes/WorldBibleRoute';
import WorkspaceRoute from './routes/WorkspaceRoute';
import SettingsRoute from './routes/SettingsRoute';
import CharactersHubRoute from './routes/CharactersHubRoute';
import CompendiumRoute from './routes/CompendiumRoute';
import RulesetRoute from './routes/RulesetRoute';
import appShellStyles from './styles/AppShell.module.css';
import {useRouteDebug} from './utils/routeDebug';

interface AppShellLayoutProps {
  activeProject: Project | null;
  projectSettings: ProjectSettings | null;
  isRailCollapsed: boolean;
  onToggleRail: () => void;
}

function AppShellLayout({
  activeProject,
  projectSettings,
  isRailCollapsed,
  onToggleRail
}: AppShellLayoutProps) {
  const location = useLocation();

  return (
    <div className={appShellStyles.appShell}>
      <Navigation
        activeProject={activeProject}
        projectSettings={projectSettings}
        isRailCollapsed={isRailCollapsed}
        onToggleRail={onToggleRail}
      />
      <main
        key={location.pathname}
        className={`${appShellStyles.main} ${
          isRailCollapsed ? appShellStyles.mainCollapsed : appShellStyles.mainExpanded
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  const {
    activeProject,
    setActiveProject,
    projectSettings,
    setProjectSettings,
    isRailCollapsed,
    setRailCollapsed
  } = useAppShellState();

  useRouteDebug(location.pathname);

  return (
    <CommandPaletteProvider
      activeProject={activeProject}
      projectSettings={projectSettings}
    >
      <Routes>
        <Route
          element={
            <AppShellLayout
              activeProject={activeProject}
              projectSettings={projectSettings}
              isRailCollapsed={isRailCollapsed}
              onToggleRail={() => setRailCollapsed((prev) => !prev)}
            />
          }
        >
          <Route
            path='/'
            element={
              <ProjectsRoute
                activeProject={activeProject}
                onSelectProject={setActiveProject}
              />
            }
          />
          <Route
            path='/world-bible'
            element={<WorldBibleRoute activeProject={activeProject} />}
          />
          <Route
            path='/ruleset'
            element={
              <RulesetRoute
                activeProject={activeProject}
                onProjectUpdated={setActiveProject}
              />
            }
          />
          <Route
            path='/characters'
            element={<CharactersHubRoute activeProject={activeProject} />}
          />
          <Route
            path='/character-sheets'
            element={<Navigate to='/characters?view=sheets' replace />}
          />
          <Route
            path='/workspace'
            element={<WorkspaceRoute activeProject={activeProject} />}
          />
          <Route
            path='/compendium'
            element={
              <CompendiumRoute
                activeProject={activeProject}
                projectSettings={projectSettings}
              />
            }
          />
          <Route
            path='/settings'
            element={
              <SettingsRoute
                activeProject={activeProject}
                onSettingsChanged={setProjectSettings}
              />
            }
          />
          <Route path='*' element={<Navigate to='/' replace />} />
        </Route>
      </Routes>
    </CommandPaletteProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AccessibilityProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AccessibilityProvider>
    </ThemeProvider>
  );
}

export default App;
