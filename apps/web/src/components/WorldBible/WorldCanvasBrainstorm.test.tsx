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
import {createEmptyWorldCanvas, updateLensNote} from '../../services/worldBible/worldCanvasService';
import {WorldCanvasBrainstorm} from './WorldCanvasBrainstorm';

const mocks = vi.hoisted(() => ({
  complete: vi.fn()
}));

vi.mock('../../services/llm/LLMService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/llm/LLMService')>();
  return {
    LLMService: class extends actual.LLMService {
      complete = mocks.complete;
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
  blocked: false,
  blockedMessage: null,
  spend: vi.fn(),
  grantMore: vi.fn(),
  refresh: vi.fn(),
  ...overrides
});

const canvas = updateLensNote(
  {...createEmptyWorldCanvas('project-1'), premise: 'A city powered by borrowed memories.'},
  'factions',
  'The Cinder Compact hoards old memories.'
);

const renderBrainstorm = (props: Partial<Parameters<typeof WorldCanvasBrainstorm>[0]> = {}) => {
  const handlers = {
    onKeepAsSourceNote: vi.fn().mockResolvedValue(undefined),
    onAddQuestion: vi.fn(),
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

const reply = (items: Array<{kind: string; text: string}>) => ({content: JSON.stringify({items})});

describe('WorldCanvasBrainstorm', () => {
  beforeEach(() => {
    resetWorldCanvasBrainstormSession();
    mocks.complete.mockReset();
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
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it('treats a hosted provider with no API key as not configured', () => {
    renderBrainstorm({aiConfig: {provider: 'openai', configs: {}} as ProjectAISettings});

    expect(screen.getByText(/OpenAI API key is missing/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Ask for tensions and questions'})).toBeDisabled();
  });

  it('names the provider before the first request and spends one consultation per click', async () => {
    mocks.complete.mockResolvedValue(reply([
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
    expect(mocks.complete).toHaveBeenCalledTimes(1);
    expect(mocks.complete.mock.calls[0][0]).toMatchObject({
      responseFormat: 'json',
      think: false,
      cache: false,
      maxTokens: BRAINSTORM_MIN_RESPONSE_TOKENS
    });
    expect(screen.queryByText(/to Anthropic’s servers/)).not.toBeInTheDocument();
  });

  it('keeps, adds, and dismisses items one at a time', async () => {
    mocks.complete.mockResolvedValue(reply([
      {kind: 'tension', text: 'The Compact needs the city to forget.'},
      {kind: 'question', text: 'Who remembers the founders?'},
      {kind: 'alternative', text: 'What if the memories are sold, not borrowed?'}
    ]));
    const {onKeepAsSourceNote, onAddQuestion} = renderBrainstorm();
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
    fireEvent.click(within(question).getByRole('button', {name: 'Add as question'}));
    expect(onAddQuestion).toHaveBeenCalledWith('Who remembers the founders?', 'factions');

    const alternative = screen.getByText('What if the memories are sold, not borrowed?').closest('li')!;
    fireEvent.click(within(alternative).getByRole('button', {name: 'Dismiss'}));
    expect(screen.queryByText('What if the memories are sold, not borrowed?')).not.toBeInTheDocument();
    expect(onKeepAsSourceNote).toHaveBeenCalledTimes(1);
    expect(onAddQuestion).toHaveBeenCalledTimes(1);
  });

  it('adds a non-question item as a question only after the author rewrites it', async () => {
    mocks.complete.mockResolvedValue(reply([
      {kind: 'implication', text: 'Forgetting spreads faster in the harbor.'}
    ]));
    const {onAddQuestion} = renderBrainstorm();
    fireEvent.click(screen.getByRole('button', {name: 'Ask for tensions and questions'}));
    await screen.findByText('Forgetting spreads faster in the harbor.');

    expect(screen.queryByRole('button', {name: 'Add as question'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Rewrite as question'}));
    const add = screen.getByRole('button', {name: 'Add as question'});
    expect(add).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Rewrite as a question'), {
      target: {value: 'Why does forgetting spread faster in the harbor?'}
    });
    fireEvent.click(add);
    expect(onAddQuestion).toHaveBeenCalledWith(
      'Why does forgetting spread faster in the harbor?',
      'factions'
    );
  });

  it('shows the fallback message for a malformed reply and changes nothing else', async () => {
    mocks.complete.mockResolvedValue({content: 'Here are some ideas about the Compact.'});
    const {onKeepAsSourceNote, onAddQuestion} = renderBrainstorm();
    fireEvent.click(screen.getByRole('button', {name: 'Ask for tensions and questions'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(BRAINSTORM_INVALID_RESPONSE_MESSAGE);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Show the model’s reply'));
    expect(screen.getByText('Here are some ideas about the Compact.')).toBeVisible();
    expect(onKeepAsSourceNote).not.toHaveBeenCalled();
    expect(onAddQuestion).not.toHaveBeenCalled();
  });

  it('refuses with the over-budget message and makes no request when the budget is spent', () => {
    const budget = buildBudget({
      blocked: true,
      blockedMessage: 'You have used all 20 AI consultations for this project today.'
    });
    renderBrainstorm({budget});
    fireEvent.click(screen.getByRole('button', {name: 'Ask for tensions and questions'}));

    expect(screen.getByRole('alert')).toHaveTextContent('You have used all 20 AI consultations');
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(budget.spend).not.toHaveBeenCalled();
  });

  it('confirms before a new request replaces unreviewed ideas', async () => {
    mocks.complete.mockResolvedValue(reply([{kind: 'tension', text: 'The Compact needs the city to forget.'}]));
    const {requestConfirm} = renderBrainstorm();
    fireEvent.click(screen.getByRole('button', {name: 'Ask for tensions and questions'}));
    await screen.findByText('The Compact needs the city to forget.');

    fireEvent.click(screen.getByRole('button', {name: 'Ask for tensions and questions'}));
    expect(requestConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Replace unreviewed ideas?'
    }));
    expect(mocks.complete).toHaveBeenCalledTimes(1);
  });

  it('explains an empty reply instead of calling it unreadable', async () => {
    mocks.complete.mockResolvedValue({content: ''});
    renderBrainstorm();
    fireEvent.click(screen.getByRole('button', {name: 'Ask for tensions and questions'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(BRAINSTORM_EMPTY_RESPONSE_MESSAGE);
    expect(screen.queryByText('Show the model’s reply')).not.toBeInTheDocument();
  });
});
