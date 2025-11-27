import { NavLink } from 'react-router-dom';
import type { Project } from '../entityTypes';

interface HeaderProps {
  activeProject: Project | null;
}

function Header({ activeProject }: HeaderProps) {
  const linkStyle: React.CSSProperties = {
    marginRight: '1rem',
    textDecoration: 'none'
  };

  return (
    <header style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <nav>
          <NavLink to="/" style={linkStyle} end>
            Projects
          </NavLink>
          <NavLink to="/world-bible" style={linkStyle}>
            World Bible
          </NavLink>
          <NavLink to="/workspace" style={linkStyle}>
            Writing Workspace
          </NavLink>
          <NavLink to="/settings" style={linkStyle}>
            Settings
          </NavLink>
        </nav>
        <div>
          {activeProject ? (
            <span>
              Active project: <strong>{activeProject.name}</strong>
            </span>
          ) : (
            <span>No active project</span>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
