import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FormEvent } from 'react';
import type { Project } from '../entityTypes';
import { getAllProjects, saveProject, deleteProject as deleteProjectFromStore } from '../projectStorage';

interface ProjectsRouteProps {
  activeProject: Project | null;
  onSelectProject(project: Project | null): void;
}

function ProjectsRoute({ activeProject, onSelectProject }: ProjectsRouteProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const all = await getAllProjects();
      setProjects(all);
    })();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    const now = Date.now();
    const project: Project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: now,
      updatedAt: now
    };

    await saveProject(project);
    setProjects(prev => [...prev, project]);
    setName('');

    onSelectProject(project);
    navigate('/world-bible');
  };

  const handleOpen = (project: Project) => {
    onSelectProject(project);
    navigate('/world-bible');
  };

  const handleDelete = async (project: Project) => {
    await deleteProjectFromStore(project.id);
    setProjects(prev => prev.filter(p => p.id !== project.id));

    if (activeProject && activeProject.id === project.id) {
      onSelectProject(null);
    }
  };

  return (
    <section>
      <h1>Projects</h1>

      <form onSubmit={handleSubmit} style={{ maxWidth: 400, marginBottom: '1rem' }}>
        <h2>Create New Project</h2>
        <div style={{ marginBottom: '0.75rem' }}>
          <label>
            Project Name<br />
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </label>
        </div>
        <button type="submit">Create Project</button>
      </form>

      <h2>Existing Projects</h2>
      {projects.length === 0 && <p>No projects yet. Create one above.</p>}

      <ul>
        {projects.map(project => (
          <li key={project.id} style={{ marginBottom: '0.5rem' }}>
            <strong>{project.name}</strong>{' '}
            {activeProject && activeProject.id === project.id && (
              <span>(active)</span>
            )}
            <br />
            <button type="button" onClick={() => handleOpen(project)}>
              Open
            </button>{' '}
            <button type="button" onClick={() => handleDelete(project)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default ProjectsRoute;
