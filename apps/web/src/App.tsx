import {
  useLayoutEffect
} from 'react';
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
import LoreRoute from './routes/LoreRoute';
import CanonDecisionsRoute from './routes/CanonDecisionsRoute';
import appShellStyles from './styles/AppShell.module.css';

const routeWindowScrollPositions = new Map<string, number>();

function HomeRoute() {
  const activeProject = useAppStore((s) => s.activeProject);
  return <Navigate to={activeProject ? '/workspace' : '/projects'} replace />;
}

function RulesetGate() {
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);

  if (
    activeProject &&
    projectSettings &&
    projectSettings.featureToggles.enableRuleAuthoring === false
  ) {
    return <Navigate to='/workspace' replace />;
  }

  return <RulesetRoute />;
}

function AppShellLayout() {
  const location = useLocation();
  const isRailCollapsed = useAppStore((s) => s.isRailCollapsed);
  const setRailCollapsed = useAppStore((s) => s.setRailCollapsed);

  useLayoutEffect(() => {
    const path = location.pathname;
    const savedScrollY = routeWindowScrollPositions.get(path);
    if (typeof savedScrollY === 'number' && savedScrollY > 0) {
      window.scrollTo({top: savedScrollY, left: 0, behavior: 'auto'});
    }

    return () => {
      routeWindowScrollPositions.set(path, window.scrollY);
    };
  }, [location.pathname]);

  return (
    <div className={appShellStyles.appShell}>
      <Navigation
        isRailCollapsed={isRailCollapsed}
        onToggleRail={() => setRailCollapsed(!isRailCollapsed)}
      />
      <main
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
          <Route path='/lore' element={<LoreRoute />} />
          <Route path='/canon-decisions' element={<CanonDecisionsRoute />} />
          <Route path='/world-bible' element={<WorldBibleRoute />} />
          <Route path='/ruleset' element={<RulesetGate />} />
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
