import React from 'react';
import { NavLink } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import type { Project } from '../entityTypes';
import styles from '../assets/components/Navigation.module.css';

interface NavigationProps {
  activeProject: Project | null;
}

export const Navigation: React.FC<NavigationProps> = ({ activeProject }) => {
  return (
    <nav className={styles.nav}>
      <div className={styles.navContent}>
        <div className={styles.brand}>
          <h1>Worldbuilding Desk</h1>
        </div>

        <div className={styles.navLinks}>
          <NavLink to="/" end className={({ isActive }) => isActive ? styles.active : ''}>
            Projects
          </NavLink>
          <NavLink to="/world-bible" className={({ isActive }) => isActive ? styles.active : ''}>
            World Bible
          </NavLink>
          <NavLink to="/characters" className={({ isActive }) => isActive ? styles.active : ''}>
            Characters
          </NavLink>
          <NavLink to="/character-sheets" className={({ isActive }) => isActive ? styles.active : ''}>
            Character Sheets
          </NavLink>
          <NavLink to="/workspace" className={({ isActive }) => isActive ? styles.active : ''}>
            Writing Workspace
          </NavLink>
          <NavLink to="/compendium" className={({ isActive }) => isActive ? styles.active : ''}>
            Compendium
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => isActive ? styles.active : ''}>
            Settings
          </NavLink>
        </div>

        <div className={styles.navActions}>
          <div className={styles.projectInfo}>
            {activeProject ? (
              <span>
                Active: <strong>{activeProject.name}</strong>
              </span>
            ) : (
              <span>No active project</span>
            )}
          </div>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
};
