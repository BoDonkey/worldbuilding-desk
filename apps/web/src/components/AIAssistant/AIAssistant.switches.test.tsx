import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ProjectAISettings} from '../../entityTypes';
import {AIAssistant} from './AIAssistant';

const mocks = vi.hoisted(() => ({stream: vi.fn()}));

vi.mock('../../services/storage/repositories/entityStorage', () => ({getEntitiesByProject: vi.fn(async () => [])}));
vi.mock('../../services/storage/repositories/aliasStorage', () => ({getAliasesByProject: vi.fn(async () => [])}));
vi.mock('../../services/storage/repositories/writingStorage', () => ({getDocumentsByProject: vi.fn(async () => [])}));
vi.mock('../../services/rag/getRAGService', () => ({
  getRAGService: vi.fn(async () => ({
    init: vi.fn(),
    setEntityVocabulary: vi.fn(),
    deleteDocument: vi.fn(),
    indexDocument: vi.fn(),
    search: vi.fn(async () => []),
    getDiagnostics: vi.fn()
  }))
}));
vi.mock('../../services/shodh/getShodhService', () => ({
  getShodhService: vi.fn(async () => ({listMemories: vi.fn(async () => []), captureAutoMemory: vi.fn(), deleteMemoriesForDocument: vi.fn()}))
}));
vi.mock('../../services/craft/getCraftLibraryService', () => ({
  getCraftLibraryService: vi.fn(async () => ({search: vi.fn(async () => [])}))
}));
vi.mock('../../services/llm/LLMService', () => ({
  LLMService: class {
    async *stream(request: unknown) {
      mocks.stream(request);
      yield 'A tighter version.';
    }
  }
}));

const settings = (switches: Pick<ProjectAISettings, 'aiCoaching' | 'aiProse'>): ProjectAISettings => ({
  provider: 'anthropic',
  configs: {anthropic: {apiKey: 'test-key', model: 'claude-test'}},
  promptTools: [{id: 'beta', name: 'Blunt Beta Reader', content: 'Be direct.', enabled: true}],
  defaultToolIds: [],
  inspectorSettings: {maxConsultationsPerDay: 20, maxContextChars: 1800, maxResponseTokens: 500, lowCostModel: ''},
  ...switches
});

const renderAssistant = (aiConfig: ProjectAISettings, withInsert = true) =>
  render(
    <MemoryRouter>
      <AIAssistant
        projectId={`switches-${Math.random()}`}
        aiConfig={aiConfig}
        sceneText='<p>The scene.</p>'
        onInsert={withInsert ? vi.fn() : undefined}
        onCaptureSourceNote={vi.fn()}
      />
    </MemoryRouter>
  );

describe('AIAssistant and the AI switches (5.18)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mocks.stream.mockReset();
  });

  it('with coaching on and prose off, offers the chat and coach but no scene revision', async () => {
    renderAssistant(settings({aiCoaching: true, aiProse: false}));
    await screen.findByText('Project context ready.');
    expect(screen.getByRole('button', {name: 'Send'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Ask the writing coach'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save as Source Note'})).toBeInTheDocument();
    expect(screen.getByText('Blunt Beta Reader')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Preview scene revision'})).not.toBeInTheDocument();
  });

  it('with coaching off and prose on, shows only what a revision needs and tags it as prose', async () => {
    renderAssistant(settings({aiCoaching: false, aiProse: true}));
    await screen.findByText('Project context ready.');
    expect(screen.getByRole('button', {name: 'Preview scene revision'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Ask the writing coach'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Save as Source Note'})).not.toBeInTheDocument();
    expect(screen.queryByText('Blunt Beta Reader')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), {target: {value: 'Rewrite the opening to be tighter.'}});
    fireEvent.click(screen.getByRole('button', {name: 'Send'}));
    await waitFor(() => expect(mocks.stream).toHaveBeenCalled());
    const request = mocks.stream.mock.calls[0]![0] as {feature: string; systemPrompt: string};
    expect(request.feature).toBe('scene-revision');
    expect(request.systemPrompt).not.toContain('Blunt Beta Reader');
  });

  it('with coaching off, shows a note instead of the chat where no revision can be previewed', () => {
    renderAssistant(settings({aiCoaching: false, aiProse: true}), false);
    expect(screen.getByText(/AI coaching is off for this project/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('with both switches off, sends nothing and shows a note', () => {
    renderAssistant(settings({aiCoaching: false, aiProse: false}));
    expect(screen.getByText(/AI coaching is off for this project/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Send'})).not.toBeInTheDocument();
    expect(mocks.stream).not.toHaveBeenCalled();
  });
});
