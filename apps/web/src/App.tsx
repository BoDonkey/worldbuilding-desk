import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation
} from 'react-router-dom';
import {Navigation} from './components/Navigation';
import {ThemeProvider} from './contexts/ThemeContext';
import {AccessibilityProvider} from './contexts/AccessibilityContext';
import {CommandPaletteProvider} from './contexts/CommandPaletteContext';
import {useAppStore} from './store/appStore';
import {useRouteDebug} from './utils/routeDebug';
import ProjectsRoute from './routes/ProjectsRoute';
import WorldBibleRoute from './routes/WorldBibleRoute';
import WorkspaceRoute from './routes/WorkspaceRoute';
import SettingsRoute from './routes/SettingsRoute';
import CharactersHubRoute from './routes/CharactersHubRoute';
import CompendiumRoute from './routes/CompendiumRoute';
import RulesetRoute from './routes/RulesetRoute';
import appShellStyles from './styles/AppShell.module.css';

function HomeRoute() {
  const activeProject = useAppStore((s) => s.activeProject);
  return <Navigate to={activeProject ? '/workspace' : '/projects'} replace />;
}

function AppShellLayout() {
  const location = useLocation();
  const isRailCollapsed = useAppStore((s) => s.isRailCollapsed);
  const setRailCollapsed = useAppStore((s) => s.setRailCollapsed);

  return (
    <div className={appShellStyles.appShell}>
      <Navigation
        isRailCollapsed={isRailCollapsed}
        onToggleRail={() => setRailCollapsed(!isRailCollapsed)}
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
  useRouteDebug(location.pathname);

  return (
    <CommandPaletteProvider>
      <Routes>
        <Route element={<AppShellLayout />}>
          <Route path='/' element={<HomeRoute />} />
          <Route path='/projects' element={<ProjectsRoute />} />
          <Route path='/world-bible' element={<WorldBibleRoute />} />
          <Route path='/ruleset' element={<RulesetRoute />} />
          <Route path='/characters' element={<CharactersHubRoute />} />
          <Route
            path='/character-sheets'
            element={<Navigate to='/characters?view=sheets' replace />}
          />
          <Route path='/workspace' element={<WorkspaceRoute />} />
          <Route path='/compendium' element={<CompendiumRoute />} />
          <Route path='/settings' element={<SettingsRoute />} />
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
