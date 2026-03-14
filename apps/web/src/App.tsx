import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  BrowserRouter,
  Navigate,
  useLocation,
  useNavigate
} from 'react-router-dom';
import type {Project, ProjectSettings} from './entityTypes';
import {Navigation} from './components/Navigation';
import {CommandPalette} from './components/CommandPalette';
import {
  createAppCommands,
  type AppCommand
} from './commands/commandRegistry';
import {ThemeProvider} from './contexts/ThemeContext';
import {AccessibilityProvider} from './contexts/AccessibilityContext';
import {getOrCreateSettings} from './settingsStorage';
import ProjectsRoute from './routes/ProjectsRoute';
import WorldBibleRoute from './routes/WorldBibleRoute';
import WorkspaceRoute from './routes/WorkspaceRoute';
import SettingsRoute from './routes/SettingsRoute';
import CharactersHubRoute from './routes/CharactersHubRoute';
import CompendiumRoute from './routes/CompendiumRoute';
import RulesetRoute from './routes/RulesetRoute';
import appShellStyles from './styles/AppShell.module.css';

interface RouteDebugEntry {
  ts: number;
  from: string | null;
  to: string;
}

const ROUTE_DEBUG_KEY = 'wbd.routeDebugLog';
const ROUTE_EVENT_KEY = 'wbd.routeEventLog';

const appendRouteDebug = (entry: RouteDebugEntry) => {
  try {
    const raw = localStorage.getItem(ROUTE_DEBUG_KEY);
    const parsed = raw ? (JSON.parse(raw) as RouteDebugEntry[]) : [];
    const next = [...parsed.slice(-119), entry];
    localStorage.setItem(ROUTE_DEBUG_KEY, JSON.stringify(next));
  } catch {
    // Ignore debug logging errors.
  }
};

const appendRouteEvent = (entry: Record<string, unknown>) => {
  try {
    const raw = localStorage.getItem(ROUTE_EVENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>[]) : [];
    const next = [...parsed.slice(-199), entry];
    localStorage.setItem(ROUTE_EVENT_KEY, JSON.stringify(next));
  } catch {
    // Ignore debug logging errors.
  }
};

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeProject, setActiveProject] = useState<Project | null>(() => {
    const raw = localStorage.getItem('activeProject');
    if (!raw) return null;

    try {
      return JSON.parse(raw) as Project;
    } catch {
      return null;
    }
  });
  const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null);
  const [isPaletteOpen, setPaletteOpen] = useState(false);
  const [nativePathname, setNativePathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [isRailCollapsed, setRailCollapsed] = useState<boolean>(() => {
    const raw = localStorage.getItem('ui.railCollapsed');
    return raw === '1';
  });
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem('ui.railCollapsed', isRailCollapsed ? '1' : '0');
  }, [isRailCollapsed]);

  useEffect(() => {
    if (activeProject) {
      localStorage.setItem('activeProject', JSON.stringify(activeProject));
    } else {
      localStorage.removeItem('activeProject');
    }
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) {
      setProjectSettings(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const settings = await getOrCreateSettings(activeProject.id);
      if (!cancelled) {
        setProjectSettings(settings);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  useEffect(() => {
    const from = previousPathRef.current;
    const to = location.pathname;
    appendRouteDebug({ts: Date.now(), from, to});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__wbdLastRoute = to;
    previousPathRef.current = to;
  }, [location.pathname]);

  useEffect(() => {
    setNativePathname(window.location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).__wbdHistoryDebugInstalled) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__wbdHistoryDebugInstalled = true;

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function patchedPushState(...args) {
      const result = originalPushState(...args);
      setNativePathname(window.location.pathname);
      appendRouteEvent({
        ts: Date.now(),
        type: 'pushState',
        href: window.location.href,
        pathname: window.location.pathname,
        args: String(args[2] ?? '')
      });
      return result;
    };

    window.history.replaceState = function patchedReplaceState(...args) {
      const result = originalReplaceState(...args);
      setNativePathname(window.location.pathname);
      appendRouteEvent({
        ts: Date.now(),
        type: 'replaceState',
        href: window.location.href,
        pathname: window.location.pathname,
        args: String(args[2] ?? '')
      });
      return result;
    };

    const onPopState = () => {
      setNativePathname(window.location.pathname);
      appendRouteEvent({
        ts: Date.now(),
        type: 'popstate',
        href: window.location.href,
      pathname: window.location.pathname
      });
    };
    const onHashChange = () => {
      setNativePathname(window.location.pathname);
      appendRouteEvent({
        ts: Date.now(),
        type: 'hashchange',
        href: window.location.href,
        pathname: window.location.pathname
      });
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onHashChange);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__wbdHistoryDebugInstalled = false;
    };
  }, []);

  const effectivePathname =
    nativePathname && nativePathname !== location.pathname
      ? nativePathname
      : location.pathname;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__wbdEffectiveRoute = effectivePathname;

  const commands = useMemo(
    () =>
      createAppCommands({
        pathname: effectivePathname,
        navigate,
        activeProject,
        projectSettings
      }),
    [effectivePathname, navigate, activeProject, projectSettings]
  );
  const routeElement = useMemo(() => {
    switch (effectivePathname) {
      case '/':
        return (
          <ProjectsRoute
            activeProject={activeProject}
            onSelectProject={setActiveProject}
          />
        );
      case '/world-bible':
        return <WorldBibleRoute activeProject={activeProject} />;
      case '/ruleset':
        return (
          <RulesetRoute
            activeProject={activeProject}
            onProjectUpdated={setActiveProject}
          />
        );
      case '/characters':
        return <CharactersHubRoute activeProject={activeProject} />;
      case '/character-sheets':
        return <Navigate to='/characters?view=sheets' replace />;
      case '/workspace':
        return <WorkspaceRoute activeProject={activeProject} />;
      case '/compendium':
        return (
          <CompendiumRoute
            activeProject={activeProject}
            projectSettings={projectSettings}
          />
        );
      case '/settings':
        return (
          <SettingsRoute
            activeProject={activeProject}
            onSettingsChanged={setProjectSettings}
          />
        );
      default:
        return (
          <ProjectsRoute
            activeProject={activeProject}
            onSelectProject={setActiveProject}
          />
        );
    }
  }, [effectivePathname, activeProject, projectSettings]);

  const handleExecuteCommand = useCallback((command: AppCommand) => {
    setPaletteOpen(false);
    command.run();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isPaletteShortcut = (event.metaKey || event.ctrlKey) && event.key === 'k';
      if (!isPaletteShortcut) return;
      event.preventDefault();
      setPaletteOpen((prev) => !prev);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={appShellStyles.appShell}>
      <Navigation
        activeProject={activeProject}
        projectSettings={projectSettings}
        isRailCollapsed={isRailCollapsed}
        onToggleRail={() => setRailCollapsed((prev) => !prev)}
      />
      <main
        key={effectivePathname}
        className={`${appShellStyles.main} ${
          isRailCollapsed ? appShellStyles.mainCollapsed : appShellStyles.mainExpanded
        }`}
      >
        {routeElement}
      </main>
      <CommandPalette
        isOpen={isPaletteOpen}
        commands={commands}
        onClose={() => setPaletteOpen(false)}
        onExecute={handleExecuteCommand}
      />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AccessibilityProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </AccessibilityProvider>
    </ThemeProvider>
  );
}

export default App;
