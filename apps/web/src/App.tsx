import {
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode
} from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation
} from 'react-router';
import {Navigation} from './components/Navigation';
import {ThemeProvider} from './contexts/ThemeContext';
import {AccessibilityProvider} from './contexts/AccessibilityContext';
import {CommandPaletteProvider} from './contexts/CommandPaletteContext';
import {useAppStore} from './store/appStore';
import {registerDiagnosticSecrets} from './services/errors';
import {getProjectCapabilities} from './projectMode';
import {useRouteDebug} from './utils/routeDebug';
import ProjectsRoute from './routes/ProjectsRoute';
import WorldBibleRoute from './routes/WorldBibleRoute';
import WorkspaceRoute from './routes/WorkspaceRoute';
import CorkboardRoute from './routes/CorkboardRoute';
import SettingsRoute from './routes/SettingsRoute';
import CharacterSheetsPageRoute from './routes/CharacterSheetsPageRoute';
import CharacterPackagesRoute from './routes/CharacterPackagesRoute';
import CompendiumRoute from './routes/CompendiumRoute';
import RulesetRoute from './routes/RulesetRoute';
import LoreRoute from './routes/LoreRoute';
import CanonDecisionsRoute from './routes/CanonDecisionsRoute';
import {getAllProjects} from './projectStorage';
import {createFirstRunProject, hasCheckedFirstRun, markFirstRunChecked} from './services/onboarding/firstRun';
import appShellStyles from './styles/AppShell.module.css';

const routeWindowScrollPositions = new Map<string, number>();

function HomeRoute() {
  const activeProject = useAppStore((s) => s.activeProject);
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const saveProjectSettings = useAppStore((s) => s.saveProjectSettings);
  const [ready, setReady] = useState(Boolean(activeProject));

  useEffect(() => {
    if (activeProject || hasCheckedFirstRun()) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const projects = await getAllProjects();
        if (projects.length === 0) {
          const project = await createFirstRunProject({saveProjectSettings});
          if (!cancelled) await setActiveProject(project);
        }
      } catch (error) {
        console.error('First-run project setup failed.', error);
      } finally {
        markFirstRunChecked();
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProject, saveProjectSettings, setActiveProject]);

  if (!ready) return null;
  return <Navigate to={activeProject ? '/workspace' : '/projects'} replace />;
}

function CharacterToolsCompatibilityRedirect() {
  const location = useLocation();
  if (new URLSearchParams(location.search).get('view') === 'sheets') {
    return <Navigate to='/sheets' replace state={location.state} />;
  }
  return (
    <Navigate
      to='/world-bible'
      replace
      state={{focusCategorySlug: 'characters'}}
    />
  );
}

function OptionalSystemsGate({
  children,
  capability
}: {
  children: ReactNode;
  capability: 'gameSystems' | 'ruleAuthoring';
}) {
  const activeProject = useAppStore((s) => s.activeProject);
  const projectSettings = useAppStore((s) => s.projectSettings);
  const capabilities = getProjectCapabilities(activeProject ? projectSettings : null);
  const enabled =
    capability === 'gameSystems'
      ? capabilities.canUseGameSystems
      : capabilities.canUseRuleAuthoring;

  if (activeProject && !enabled) {
    return <Navigate to='/workspace' replace />;
  }

  return <>{children}</>;
}

function AppShellLayout() {
  const location = useLocation();
  const isRailCollapsed = useAppStore((s) => s.isRailCollapsed);
  const setRailCollapsed = useAppStore((s) => s.setRailCollapsed);

  useLayoutEffect(() => {
    const path = location.pathname;
    if (path === '/workspace') {
      return;
    }

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
          <Route
            path='/ruleset'
            element={
              <OptionalSystemsGate capability='ruleAuthoring'>
                <RulesetRoute />
              </OptionalSystemsGate>
            }
          />
          <Route path='/characters' element={<CharacterToolsCompatibilityRedirect />} />
          <Route
            path='/sheets'
            element={
              <OptionalSystemsGate capability='ruleAuthoring'>
                <CharacterSheetsPageRoute />
              </OptionalSystemsGate>
            }
          />
          <Route path='/character-sheets' element={<Navigate to='/sheets' replace />} />
          <Route path='/character-packages' element={<CharacterPackagesRoute />} />
          <Route path='/workspace' element={<WorkspaceRoute />} />
          <Route path='/corkboard' element={<CorkboardRoute />} />
          <Route
            path='/compendium'
            element={
              <OptionalSystemsGate capability='gameSystems'>
                <CompendiumRoute />
              </OptionalSystemsGate>
            }
          />
          <Route path='/settings' element={<SettingsRoute />} />
          <Route path='*' element={<Navigate to='/' replace />} />
        </Route>
      </Routes>
    </CommandPaletteProvider>
  );
}

function App() {
  const projectSettings = useAppStore((s) => s.projectSettings);
  useEffect(() => {
    const configs = projectSettings?.aiSettings?.configs;
    registerDiagnosticSecrets([
      configs?.anthropic?.apiKey,
      configs?.openai?.apiKey,
      configs?.gemini?.apiKey
    ]);
  }, [projectSettings]);
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
