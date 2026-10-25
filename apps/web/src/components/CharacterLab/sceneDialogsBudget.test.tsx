import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {CharacterVoiceContext} from '../../services/characterLab';
import {CharacterSceneDialog} from './CharacterSceneDialog';
import {SceneDraftDialog} from '../SceneDraft/SceneDraftDialog';

// 60 facts of about 25 tokens each cannot fit a 2,048-token model beside the instructions.
const context = (id: string, name: string): CharacterVoiceContext => {
  const items = Array.from({length: 60}, (_, index) => ({
    text: `- trait: ${name.toUpperCase()}-FACT-${String(index).padStart(2, '0')} keeps her word when it costs her`,
    provenance: {type: 'canonical-fact' as const, id: `${id}-${index}`},
    rank: 3
  }));
  return {
    entityId: id,
    name,
    position: {kind: 'latest'},
    positionLabel: 'the latest point in the manuscript',
    snapshot: null,
    sections: [
      {kind: 'canon-record', source: `Accepted canon: World Bible record - ${name}`, content: `${name} RECORD`, provenance: []},
      {
        kind: 'accepted-facts',
        source: `Accepted canon facts - ${name}`,
        content: items.map((item) => item.text).join('\n'),
        provenance: items.map((item) => item.provenance),
        items
      }
    ]
  };
};

const contexts: Record<string, CharacterVoiceContext> = {aria: context('aria', 'Aria'), borin: context('borin', 'Borin')};
const run = vi.fn(async () => ({answer: 'A scene.', stopped: false}));

vi.mock('../../hooks/useCharacterLabData', () => ({
  useCharacterLabData: () => ({
    isLoaded: true,
    loadError: null,
    aiConfig: {
      provider: 'local-openai',
      configs: {'local-openai': {}},
      promptTools: [],
      defaultToolIds: [],
      allowSceneDrafts: true,
      inspectorSettings: {enableAIConsultation: true, maxConsultationsPerDay: 10, maxContextChars: 1800, maxResponseTokens: 500}
    },
    characterOptions: [
      {id: 'aria', name: 'Aria'},
      {id: 'borin', name: 'Borin'}
    ],
    documents: [],
    chapterCards: [],
    openThreads: [],
    saveToScratchpad: vi.fn(),
    buildContext: (entityId: string) => ({context: contexts[entityId], error: null})
  })
}));
vi.mock('../../hooks/useModelRun', () => ({
  useModelRun: () => ({isRunning: false, run, stop: vi.fn(), reset: vi.fn()})
}));
vi.mock('../../hooks/useConsultationBudget', () => ({
  useConsultationBudget: () => ({
    blocked: false,
    blockedMessage: null,
    grantMore: vi.fn(),
    isLocal: true,
    route: {kind: 'local-server'},
    spend: vi.fn(),
    status: null
  })
}));
vi.mock('../../hooks/useModelContextSize', () => ({useModelContextSize: () => ({tokens: 2048, source: 'reported'})}));
vi.mock('../../services/llm/LLMService', () => ({LLMService: class {}}));
vi.mock('../common/ModelRunProgress', () => ({ModelRunProgress: () => null}));
vi.mock('../common/ConsultationBudgetNotice', () => ({ConsultationBudgetNotice: () => null}));

afterEach(() => run.mockClear());

const sentSystemPrompt = () => (run.mock.calls[0] as unknown as [unknown, {systemPrompt: string}])[1].systemPrompt;

describe('scene dialogs on a small model (4.71)', () => {
  it('a character scene fits the cast into the context, first character first, and shows what was left out', async () => {
    render(
      <MemoryRouter>
        <CharacterSceneDialog isOpen projectId='p1' initialEntityIds={['aria', 'borin']} defaultPosition={{kind: 'latest'}} onClose={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByLabelText('Left out of the model’s context')).toHaveTextContent('The model takes 2,048 tokens.');
    fireEvent.change(screen.getByLabelText('Scene setup'), {target: {value: 'Borin blocks the forge door.'}});
    fireEvent.click(screen.getByRole('button', {name: 'Write scene'}));
    await waitFor(() => expect(run).toHaveBeenCalled());
    const prompt = sentSystemPrompt();
    expect(prompt).toContain('Aria RECORD');
    expect(prompt).toContain('Borin RECORD');
    expect(prompt).toContain('ARIA-FACT-00');
    expect(prompt).not.toContain('ARIA-FACT-59');
    expect(prompt).toMatch(/more accepted facts left out to fit the model's context/);
  });

  it('a scene draft fits the point-of-view character first', async () => {
    render(
      <MemoryRouter>
        <SceneDraftDialog isOpen projectId='p1' sceneId='s1' sceneTitle='The forge' onInsert={vi.fn()} onClose={vi.fn()} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByLabelText('Aria'));
    fireEvent.click(screen.getByLabelText('Borin'));
    fireEvent.change(screen.getByLabelText('Point of view'), {target: {value: 'borin'}});
    // Shown before the goal is written.
    expect(screen.getByLabelText('Left out of the model’s context')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/The scene’s goal/), {target: {value: 'Borin bargains.'}});
    fireEvent.click(screen.getByRole('button', {name: 'Draft scene'}));
    await waitFor(() => expect(run).toHaveBeenCalled());
    const prompt = sentSystemPrompt();
    const kept = (name: string) => (prompt.match(new RegExp(`${name}-FACT-`, 'g')) ?? []).length;
    expect(kept('BORIN')).toBeGreaterThan(kept('ARIA'));
  });
});
