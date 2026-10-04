import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {ProjectAISettings} from '../../entityTypes';
import type {UseConsultationBudget} from '../../hooks/useConsultationBudget';
import {getConsultationBudgetStatus} from '../../services/editor';
import {
  BRAINSTORM_EMPTY_RESPONSE_MESSAGE,
  BRAINSTORM_INVALID_RESPONSE_MESSAGE,
  BRAINSTORM_MIN_RESPONSE_TOKENS
} from '../../services/worldBible/worldCanvasBrainstorm';
import {resetWorldCanvasBrainstormSession} from '../../services/worldBible/worldCanvasBrainstormSession';
import {createEmptyWorldCanvas, getActiveSketch, openLens, updateSketchText} from '../../services/worldBible/worldCanvasService';
import {WorldCanvasBrainstorm} from './WorldCanvasBrainstorm';

const mocks = vi.hoisted(() => ({
  stream: vi.fn()
}));

vi.mock('../../services/llm/LLMService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/llm/LLMService')>();
  return {
    LLMService: class extends actual.LLMService {
      stream = mocks.stream;
    }
  };
});

const hostedConfig: ProjectAISettings = {
  provider: 'anthropic',
  configs: {anthropic: {apiKey: 'test-key', model: 'claude-test'}}
} as ProjectAISettings;

const buildBudget = (overrides: Partial<UseConsultationBudget> = {}): UseConsultationBudget => ({
  status: getConsultationBudgetStatus('project-1', 20),
  isLocal: false,
  route: {kind: 'hosted', provider: 'anthropic', isPrivateLocal: false, allowsRequests: true},
  blocked: false,
  blockedMessage: null,
  spend: vi.fn(),
  grantMore: vi.fn(),
  refresh: vi.fn(),
  ...overrides
});

const openedCanvas = openLens({...createEmptyWorldCanvas('project-1'), premise: 'A city powered by borrowed memories.'}, 'factions');
const canvas = updateSketchText(openedCanvas, 'factions', getActiveSketch(openedCanvas.lenses[0]).id, 'The Cinder Compact hoards old memories.');

const renderBrainstorm = (props: Partial<Parameters<typeof WorldCanvasBrainstorm>[0]> = {}) => {
  const handlers = {
    onKeepAsSourceNote: vi.fn().mockResolvedValue(undefined),
    onAddOpenThread: vi.fn(),
    onFeedback: vi.fn(),
    requestConfirm: vi.fn()
  };
  const budget = props.budget ?? buildBudget();
  render(
    <MemoryRouter>
      <WorldCanvasBrainstorm
        projectId='project-1'
        focus={{type: 'lens', kind: 'factions'}}
        canvas={canvas}
        canonNames={['Sera Vale']}
        aiConfig={hostedConfig}
        budget={budget}
        {...handlers}
        {...props}
      />
    </MemoryRouter>
  );
  return {...handlers, budget};
};

/** Streams a reply the way Ollama does: thinking fragments first, then the answer. */
const respondWith = (answer: string, thinking: string[] = []) => {
  mocks.stream.mockImplementation(async function* () {
    for (const fragment of thinking) yield `<think>${fragment}</think>`;
    if (answer) yield answer;
  });
};
const reply = (items: Array<{kind: string; text: string}>) => JSON.stringify({items});

describe('WorldCanvasBrainstorm', () => {
  beforeEach(() => {
    resetWorldCanvasBrainstormSession();
    mocks.stream.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('explains and links to Settings when no provider is configured, without a request', () => {
    renderBrainstorm({aiConfig: undefined});

    expect(screen.getByText(/AI provider is not configured/)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Open Settings'})).toHaveAttribute('href', '/settings');
    const button = screen.getByRole('button', {name: 'Ask for tensions and questions'});
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('treats a hosted provider with no API key as not configured', () => {
    renderBrainstorm({aiConfig: {provider: 'openai', configs: {}} as ProjectAISettings});

    expect(screen.getByText(/OpenAI API key is missing/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Ask for tensions and questions'})).toBeDisabled();
  });

  it('names the provider before the first request and spends one consultation per click', async () => {
    respondWith(reply([
      {kind: 'tension', text: 'The Compact needs the city to forget.'},
      {kind: 'question', text: 'Who remembers the founders?'}
    ]));
    const {budget} = renderBrainstorm();

    expect(screen.getByText(/to Anthropic’s servers/)).toBeInTheDocument();
    expect(screen.getByText(/Costs 1 of this project's 20 daily AI consultations/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Ask for tensions and questions'}));

    expect(await screen.findByText('The Compact needs the city to forget.')).toBeInTheDocument();
    expect(budget.spend).toHaveBeenCalledTimes(1);
    expect(budget.spend).toHaveBeenCalledWith('canvas-brainstorm');
    expect(mocks.stream).toHaveBeenCalledTimes(1);
    expect(mocks.stream.mock.calls[0][0]).toMatchObject({
      responseFormat: 'json',
      cache: false,
      maxTokens: BRAINSTORM_MIN_RESPONSE_TOKENS
    });
    expect(screen.queryByText(/to Anthropic’s servers/)).not.toBeInTheDocument();
  });

  it('keeps, adds, and dismisses items one at a time', async () => {
    respondWith(reply([
      {kind: 'tension', text: 'The Compact needs the city to forget.'},
      {kind: 'question', text: 'Who remembers the founders?'},
      {kind: 'alternative', text: 'What if the memories are sold, not borrowed?'}
    ]));
    const {onKeepAsSourceNote, onAddOpenThread} = renderBrainstorm();
    fireEvent.click(screen.getByRole('button', {name: 'Ask for tensions and questions'}));
    await screen.findByText('The Compact needs the city to forget.');

    const tension = screen.getByText('The Compact needs the city to forget.').closest('li')!;
    fireEvent.click(within(tension).getByRole('button', {name: 'Keep as Source Note'}));
    await waitFor(() => expect(onKeepAsSourceNote).toHaveBeenCalledWith({
      lensKind: 'factions',
      kindLabel: 'Tension',
      text: 'The Compact needs the city to forget.'
    }));
    await waitFor(() =>
      expect(screen.queryByText('The Compact needs the city to forget.')).not.toBeInTheDocument()
    );

    const question = screen.getByText('Who remembers the founders?').closest('li')!;
    fireEvent.click(within(question).getByRole('button', {name: 'Keep as Open Thread'}));
    expect(onAddOpenThread).toHaveBeenCalledWith('Who remembers the founders?', 'factions');

    const alternative = screen.getByText('What if the memories are sold, not borrowed?').closest('li')!;
    fireEvent.click(within(alternative).getByRole('button', {name: 'Dismiss'}));
    expect(screen.queryByText('What if the memories are sold, not borrowed?')).not.toBeInTheDocument();
    expect(onKeepAsSourceNote).toHaveBeenCalledTimes(1);
    expect(onAddOpenThread).toHaveBeenCalledTimes(1);
  });

  it('keeps a statement-form implication as an Open Thread without forced question grammar', async () => {
    respondWith(reply([
      {kind: 'implication', text: 'Forgetting spreads faster in the harbor.'}
    ]));
    const {onAddOpenThread} = renderBrainstorm();
    fireEvent.click(screen.getByRole('button', {name: 'Ask for tensions and questions'}));
    await screen.findByText('Forgetting spreads faster in the harbor.');

    fireEvent.click(screen.getByRole('button', {name: 'Keep as Open Thread'}));
    expect(onAddOpenThread).toHaveBeenCalledWith('Forgetting spreads faster in the harbor.', 'factions');
  });

  it('shows the fallback message for a malformed reply and changes nothing else', async () => {
    respondWith('Here are some ideas about the Compact.');
    const {onKeepAsSourceNote, onAddOpenThread} = renderBrainstorm();
    fireEvent.click(screen.getByRole('button', {name: 'Ask for tensions and questions'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(BRAINSTORM_INVALID_RESPONSE_MESSAGE);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Show the model’s reply'));
    expect(screen.getByText('Here are some ideas about the Compact.')).toBeVisible();
    expect(onKeepAsSourceNote).not.toHaveBeenCalled();
    expect(onAddOpenThread).not.toHaveBeenCalled();
  });

  it('refuses with the over-budget message and makes no request when the budget is spent', () => {
    const budget = buildBudget({
      blocked: true,
      blockedMessage: 'You have used all 20 AI consultations for this project today.'
    });
    renderBrainstorm({budget});
    fireEvent.click(screen.getByRole('button', {name: 'Ask for tensions and questions'}));

    expect(screen.getByRole('alert')).toHaveTextContent('You have used all 20 AI consultations');
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(budget.spend).not.toHaveBeenCalled();
  });

  it('confirms before a new request replaces unreviewed ideas', async () => {
    respondWith(reply([{kind: 'tension', text: 'The Compact needs the city to forget.'}]));
    const {requestConfirm} = renderBrainstorm();
    fireEvent.click(screen.getByRole('button', {name: 'Ask for tensions and questions'}));
    await screen.findByText('The Compact needs the city to forget.');

    fireEvent.click(screen.getByRole('button', {name: 'Ask for tensions and questions'}));
    expect(requestConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Replace unreviewed ideas?'
    }));
    expect(mocks.stream).toHaveBeenCalledTimes(1);
  });

  it('explains an empty reply instead of calling it unreadable', async () => {
    respondWith('');
    renderBrainstorm();
    fireEvent.click(screen.getByRole('button', {name: 'Ask for tensions and questions'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(BRAINSTORM_EMPTY_RESPONSE_MESSAGE);
    expect(screen.queryByText('Show the model’s reply')).not.toBeInTheDocument();
  });

  it('sends no cap to a local model and parses only the answer, not the thinking', async () => {
    respondWith(
      reply([{kind: 'question', text: 'Who keeps the shrine of forgotten names?'}]),
      ['The author wants {"items": ideas}.', ' Keep it short.']
    );
    renderBrainstorm({
      aiConfig: {provider: 'ollama', configs: {ollama: {model: 'qwen3'}}} as ProjectAISettings,
      budget: buildBudget({isLocal: true})
    });
    fireEvent.click(screen.getByRole('button', {name: 'Ask for tensions and questions'}));

    expect(await screen.findByText('Who keeps the shrine of forgotten names?')).toBeInTheDocument();
    expect(mocks.stream.mock.calls[0][0]).not.toHaveProperty('maxTokens', expect.anything());
    expect(mocks.stream.mock.calls[0][0].think).toBeUndefined();
    expect(screen.getByText('Show thinking (8 words)')).toBeInTheDocument();
  });
});
