import {useEffect, useState} from 'react';
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import type {Project, ProjectSettings} from './entityTypes';
import {Navigation} from './components/Navigation';
import {ThemeProvider} from './contexts/ThemeContext';
import {AccessibilityProvider} from './contexts/AccessibilityContext';
import {getOrCreateSettings} from './settingsStorage';
import ProjectsRoute from './routes/ProjectsRoute';
import WorldBibleRoute from './routes/WorldBibleRoute';
import WorkspaceRoute from './routes/WorkspaceRoute';
import SettingsRoute from './routes/SettingsRoute';
import CharactersRoute from './routes/CharactersRoute';
import CharacterSheetsRoute from './routes/CharacterSheetsRoute';
import CompendiumRoute from './routes/CompendiumRoute';

function App() {
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

  return (
    <ThemeProvider>
      <AccessibilityProvider>
        <BrowserRouter>
          <div className='app'>
            <Navigation
              activeProject={activeProject}
              projectSettings={projectSettings}
            />
            <main style={{padding: '1rem', paddingTop: 'calc(60px + 1rem)'}}>
              <Routes>
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
                  path='/characters'
                  element={<CharactersRoute activeProject={activeProject} />}
                />
                <Route
                  path='/character-sheets'
                  element={
                    <CharacterSheetsRoute activeProject={activeProject} />
                  }
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
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AccessibilityProvider>
    </ThemeProvider>
  );
}

export default App;
