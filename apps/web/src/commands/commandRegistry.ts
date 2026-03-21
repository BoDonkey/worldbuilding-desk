import type {NavigateFunction} from 'react-router-dom';
import type {Project, ProjectSettings} from '../entityTypes';
import {dispatchWorkspaceCommand} from './workspaceCommands';

export interface AppCommand {
  id: string;
  label: string;
  section: 'Navigation' | 'Workspace';
  keywords: string[];
  shortcut?: string;
  run: () => void;
}

interface CreateAppCommandsOptions {
  pathname: string;
  navigate: NavigateFunction;
  activeProject: Project | null;
  projectSettings: ProjectSettings | null;
}

export const createAppCommands = ({
  pathname,
  navigate,
  activeProject,
  projectSettings
}: CreateAppCommandsOptions): AppCommand[] => {
  const showGameSystems =
    !activeProject || projectSettings?.featureToggles.enableGameSystems !== false;

  const navigationCommands: AppCommand[] = [
    {
      id: 'nav-projects',
      label: 'Go to Projects',
      section: 'Navigation',
      keywords: ['projects', 'home', 'dashboard'],
      run: () => navigate('/')
    },
    {
      id: 'nav-world-bible',
      label: 'Go to World Bible',
      section: 'Navigation',
      keywords: ['world', 'bible', 'lore', 'entities'],
      run: () => navigate('/world-bible')
    },
    {
      id: 'nav-ruleset',
      label: 'Go to Ruleset',
      section: 'Navigation',
      keywords: ['rules', 'system', 'mechanics'],
      run: () => navigate('/ruleset')
    },
    {
      id: 'nav-characters',
      label: 'Go to Characters',
      section: 'Navigation',
      keywords: ['characters', 'sheets', 'party'],
      run: () => navigate('/characters')
    },
    {
      id: 'nav-workspace',
      label: 'Go to Writing Workspace',
      section: 'Navigation',
      keywords: ['workspace', 'writing', 'editor', 'scenes'],
      run: () => navigate('/workspace')
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      section: 'Navigation',
      keywords: ['settings', 'preferences', 'configuration'],
      run: () => navigate('/settings')
    }
  ];

  if (showGameSystems) {
    navigationCommands.splice(5, 0, {
      id: 'nav-compendium',
      label: 'Go to Compendium',
      section: 'Navigation',
      keywords: ['compendium', 'items', 'systems', 'modules'],
      run: () => navigate('/compendium')
    });
  }

  const isWorkspaceRoute = pathname.startsWith('/workspace');
  if (!isWorkspaceRoute) {
    return navigationCommands;
  }

  const workspaceCommands: AppCommand[] = [
    {
      id: 'workspace-new-scene',
      label: 'Workspace: New Scene',
      section: 'Workspace',
      keywords: ['new', 'scene', 'create'],
      run: () => dispatchWorkspaceCommand('new-scene')
    },
    {
      id: 'workspace-save-scene',
      label: 'Workspace: Save Scene',
      section: 'Workspace',
      keywords: ['save', 'scene'],
      shortcut: 'Cmd/Ctrl+S',
      run: () => dispatchWorkspaceCommand('save-scene')
    },
    {
      id: 'workspace-critique-selected-passage',
      label: 'Workspace: Critique Selected Passage',
      section: 'Workspace',
      keywords: ['critique', 'selected', 'passage', 'critic', 'feedback'],
      run: () => dispatchWorkspaceCommand('critique-selected-passage')
    },
    {
      id: 'workspace-critique-current-scene',
      label: 'Workspace: Critique Current Scene',
      section: 'Workspace',
      keywords: ['critique', 'current', 'scene', 'critic', 'feedback'],
      run: () => dispatchWorkspaceCommand('critique-current-scene')
    },
    {
      id: 'workspace-toggle-left-drawer',
      label: 'Workspace: Toggle Scene Drawer',
      section: 'Workspace',
      keywords: ['toggle', 'drawer', 'scene', 'left'],
      run: () => dispatchWorkspaceCommand('toggle-left-drawer')
    },
    {
      id: 'workspace-toggle-right-drawer',
      label: 'Workspace: Toggle Context Drawer',
      section: 'Workspace',
      keywords: ['toggle', 'drawer', 'context', 'right'],
      run: () => dispatchWorkspaceCommand('toggle-right-drawer')
    },
    {
      id: 'workspace-context-world-bible',
      label: 'Workspace: Open Context - World Bible',
      section: 'Workspace',
      keywords: ['context', 'world', 'bible', 'drawer'],
      run: () => dispatchWorkspaceCommand('open-context-world-bible')
    },
    {
      id: 'workspace-context-ruleset',
      label: 'Workspace: Open Context - Ruleset',
      section: 'Workspace',
      keywords: ['context', 'ruleset', 'drawer'],
      run: () => dispatchWorkspaceCommand('open-context-ruleset')
    },
    {
      id: 'workspace-context-characters',
      label: 'Workspace: Open Context - Characters',
      section: 'Workspace',
      keywords: ['context', 'characters', 'drawer'],
      run: () => dispatchWorkspaceCommand('open-context-characters')
    },
    {
      id: 'workspace-run-review',
      label: 'Workspace: Run Consistency Review',
      section: 'Workspace',
      keywords: ['consistency', 'review', 'canon', 'guardrail'],
      run: () => dispatchWorkspaceCommand('run-consistency-review')
    },
    {
      id: 'workspace-export-markdown',
      label: 'Workspace: Export Markdown',
      section: 'Workspace',
      keywords: ['export', 'markdown', 'md'],
      run: () => dispatchWorkspaceCommand('export-markdown')
    },
    {
      id: 'workspace-export-docx',
      label: 'Workspace: Export DOCX',
      section: 'Workspace',
      keywords: ['export', 'docx', 'word'],
      run: () => dispatchWorkspaceCommand('export-docx')
    },
    {
      id: 'workspace-export-epub',
      label: 'Workspace: Export EPUB',
      section: 'Workspace',
      keywords: ['export', 'epub', 'ebook'],
      run: () => dispatchWorkspaceCommand('export-epub')
    },
    {
      id: 'workspace-extract-memory',
      label: 'Workspace: Extract Memory',
      section: 'Workspace',
      keywords: ['extract', 'memory', 'shodh'],
      run: () => dispatchWorkspaceCommand('extract-memory')
    },
    {
      id: 'workspace-toggle-ai',
      label: 'Workspace: Toggle AI Panel',
      section: 'Workspace',
      keywords: ['ai', 'assistant', 'panel'],
      run: () => dispatchWorkspaceCommand('toggle-ai-panel')
    },
    {
      id: 'workspace-toggle-system-history',
      label: 'Workspace: Toggle System History Panel',
      section: 'Workspace',
      keywords: ['system', 'history', 'panel', 'events'],
      run: () => dispatchWorkspaceCommand('toggle-system-history-panel')
    }
  ];

  if (showGameSystems) {
    workspaceCommands.splice(7, 0, {
      id: 'workspace-context-compendium',
      label: 'Workspace: Open Context - Compendium',
      section: 'Workspace',
      keywords: ['context', 'compendium', 'drawer'],
      run: () => dispatchWorkspaceCommand('open-context-compendium')
    });
  }

  return [...navigationCommands, ...workspaceCommands];
};
