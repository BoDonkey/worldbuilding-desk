import {useEffect, useState} from 'react';
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import type {Project} from './entityTypes';
import Header from './components/Header';
import ProjectsRoute from './routes/ProjectsRoute';
import WorldBibleRoute from './routes/WorldBibleRoute';
import WorkspaceRoute from './routes/WorkspaceRoute';
import SettingsRoute from './routes/SettingsRoute';
import CharactersRoute from './routes/CharactersRoute';

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

  useEffect(() => {
    if (activeProject) {
      localStorage.setItem('activeProject', JSON.stringify(activeProject));
    } else {
      localStorage.removeItem('activeProject');
    }
  }, [activeProject]);

  return (
    <BrowserRouter>
      <div className='app'>
        <Header activeProject={activeProject} />
        <main style={{padding: '1rem'}}>
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
              path='/workspace'
              element={<WorkspaceRoute activeProject={activeProject} />}
            />
            <Route
              path='/settings'
              element={<SettingsRoute activeProject={activeProject} />}
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
