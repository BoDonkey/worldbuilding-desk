import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {EntityCategory, Project, ProjectAISettings, ProjectSettings, WorldEntity} from '../../entityTypes';
import {createAppCommands} from '../../commands/commandRegistry';
import {WorkspaceCharacterLabSection} from '../../components/Workspace/WorkspaceCharacterLabSection';
import {CharacterIntakeTasks} from '../../components/WorldBible/CharacterIntakeTasks';
import {getWorldEngine} from '../worldEngine/getWorldEngine';
import {LocalAiReviewWorldEngine} from '../worldEngine/LocalAiReviewWorldEngine';

/** Surface-family checks that each AI entry point hides with its switch (Slice 5.18). */

const project = {id: 'p1', name: 'Switches'} as Project;
const withSwitches = (aiCoaching: boolean, aiProse: boolean) =>
  ({projectMode: 'general', featureToggles: {}, aiSettings: {provider: 'ollama', configs: {}, aiCoaching, aiProse}}) as unknown as ProjectSettings;
// The Workspace route lists the AI panel command; other routes return early, so check both.
const commandIds = (settings: ProjectSettings, pathname = '/workspace') =>
  createAppCommands({pathname, navigate: vi.fn(), activeProject: project, projectSettings: settings}).map((command) => command.id);

describe('command palette', () => {
  it('lists Ask your project only with coaching on, and the AI panel with either switch', () => {
    expect(commandIds(withSwitches(false, false))).not.toContain('nav-ask');
    expect(commandIds(withSwitches(false, false), '/world-bible')).not.toContain('nav-ask');
    expect(commandIds(withSwitches(true, false), '/world-bible')).toContain('nav-ask');
    expect(commandIds(withSwitches(false, false))).not.toContain('workspace-toggle-ai');
    expect(commandIds(withSwitches(false, true))).not.toContain('nav-ask');
    expect(commandIds(withSwitches(false, true))).toContain('workspace-toggle-ai');
    expect(commandIds(withSwitches(true, false))).toEqual(expect.arrayContaining(['nav-ask', 'workspace-toggle-ai']));
  });
});

describe('Workspace character lab entries', () => {
  const categories = [{id: 'characters', slug: 'characters', name: 'Characters', kind: 'character'}] as EntityCategory[];
  const entities = [
    {id: 'a', name: 'Ada', categoryId: 'characters'},
    {id: 'b', name: 'Bram', categoryId: 'characters'}
  ] as WorldEntity[];
  const renderSection = (coaching: boolean, prose: boolean) =>
    render(
      <WorkspaceCharacterLabSection
        entities={entities}
        categories={categories}
        switches={{coaching, prose}}
        onOpenCharacterLab={vi.fn()}
        onOpenCharacterScene={vi.fn()}
      />
    );

  it('shows talking to a character only with coaching, and a character scene only with prose', () => {
    renderSection(true, false);
    expect(screen.getByRole('button', {name: 'Open character lab'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Write a character scene'})).not.toBeInTheDocument();
  });

  it('shows a character scene alone with prose only', () => {
    renderSection(false, true);
    expect(screen.queryByRole('button', {name: 'Open character lab'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Write a character scene'})).toBeInTheDocument();
  });

  it('shows nothing with both switches off', () => {
    const {container} = renderSection(false, false);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('World Bible character intake', () => {
  it('offers Start from a description only with coaching on; card import always', () => {
    const {rerender} = render(<CharacterIntakeTasks onStart={vi.fn()} fromDescription={false} />);
    expect(screen.queryByRole('button', {name: 'Start from a description'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Import a character card'})).toBeInTheDocument();
    rerender(<CharacterIntakeTasks onStart={vi.fn()} fromDescription />);
    expect(screen.getByRole('button', {name: 'Start from a description'})).toBeInTheDocument();
  });
});

describe('review engine', () => {
  it('uses local AI review annotations only while coaching is on', () => {
    const ai = (aiCoaching: boolean) => ({provider: 'ollama', configs: {}, aiCoaching}) as unknown as ProjectAISettings;
    expect(getWorldEngine('local-ai-preview', ai(false))).not.toBeInstanceOf(LocalAiReviewWorldEngine);
    expect(getWorldEngine('local-ai-preview', ai(true))).toBeInstanceOf(LocalAiReviewWorldEngine);
  });
});
