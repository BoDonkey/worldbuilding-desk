import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {ChapterCard, ProjectAISettings, WritingDocument} from '../../entityTypes';
import {CorkboardPlanningChat} from './CorkboardPlanningChat';

const mocks = vi.hoisted(() => ({stream: vi.fn()}));

vi.mock('../../services/rag/getRAGService', () => ({
  getRAGService: vi.fn(async () => ({search: vi.fn(async () => [])}))
}));
vi.mock('../../services/llm/LLMService', () => ({
  LLMService: class {
    async *stream(request: unknown) {
      mocks.stream(request);
      yield 'Chapter two could raise the stakes earlier.';
    }
  }
}));

const aiConfig = (aiCoaching = true): ProjectAISettings => ({
  provider: 'anthropic',
  configs: {anthropic: {apiKey: 'test-key', model: 'claude-test'}},
  promptTools: [],
  defaultToolIds: [],
  inspectorSettings: {maxConsultationsPerDay: 20, maxContextChars: 1800, maxResponseTokens: 500, lowCostModel: ''},
  aiCoaching,
  aiProse: false
});

const card = (id: string, order: number, title: string, summary: string, sceneIds: string[] = []): ChapterCard => ({
  id,
  projectId: 'p1',
  title,
  summary,
  status: 'planned',
  order,
  sceneIds,
  plotPoints: [],
  createdAt: 0,
  updatedAt: 0
});

const cards = [
  card('c1', 1, 'Arrival', 'The heroine reaches the city.'),
  card('c2', 2, 'The Market', 'She is robbed in the market.', ['s1']),
  card('c3', 3, 'Escape', 'She flees over the walls.')
];
const documents: WritingDocument[] = [
  {id: 's1', projectId: 'p1', title: 'Market scene', content: '<p>The private prose of the scene.</p>', createdAt: 0, updatedAt: 0}
];

type StreamedRequest = {feature: string; systemPrompt: string; context: {source: string; content: string}[]};

const renderChat = (config = aiConfig()) =>
  render(
    <MemoryRouter>
      <CorkboardPlanningChat
        projectId={`planning-${Math.random()}`}
        aiConfig={config}
        cards={cards}
        documents={documents}
        selectedCard={cards[1]!}
      />
    </MemoryRouter>
  );

const ask = (text: string) => {
  fireEvent.change(screen.getByRole('textbox', {name: 'Message'}), {target: {value: text}});
  fireEvent.click(screen.getByRole('button', {name: 'Send'}));
};

describe('CorkboardPlanningChat (4.85)', () => {
  const writes: string[] = [];

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mocks.stream.mockReset();
    writes.length = 0;
    for (const method of ['put', 'add', 'delete', 'clear'] as const) {
      vi.spyOn(IDBObjectStore.prototype, method).mockImplementation(function (this: IDBObjectStore) {
        writes.push(`${method}:${this.name}`);
        throw new Error('The planning chat must not write to the project database.');
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks about the whole board with every card in order and no scene prose', async () => {
    renderChat();
    ask('Where does the middle sag?');
    expect(await screen.findByText('Chapter two could raise the stakes earlier.')).toBeInTheDocument();

    const request = mocks.stream.mock.calls[0]![0] as StreamedRequest;
    expect(request.feature).toBe('corkboard-planning');
    expect(request.systemPrompt).toContain('You cannot change the corkboard');
    const plan = request.context.find((chunk) => chunk.source.startsWith('Corkboard plan'))!;
    expect(plan.source).toContain('whole board');
    expect(plan.content.indexOf('Arrival')).toBeLessThan(plan.content.indexOf('The Market'));
    expect(plan.content.indexOf('The Market')).toBeLessThan(plan.content.indexOf('Escape'));
    expect(plan.content).toContain('Market scene (6 words)');
    expect(plan.content).not.toContain('private prose');
    expect(writes).toEqual([]);
  });

  it('asks about this card with its neighbours, and sends an excerpt only when asked', async () => {
    renderChat();
    fireEvent.click(screen.getByRole('radio', {name: 'This card: The Market'}));
    fireEvent.click(screen.getByRole('checkbox', {name: /Include the opening of each linked scene/}));
    expect(screen.getByText(/the opening of each linked scene, and related World Bible records/)).toBeInTheDocument();
    ask('What scenes does this chapter need?');
    await screen.findByText('Chapter two could raise the stakes earlier.');

    const request = mocks.stream.mock.calls[0]![0] as StreamedRequest;
    const plan = request.context.find((chunk) => chunk.source.startsWith('Corkboard plan'))!;
    expect(plan.source).toContain('chapter 2, The Market');
    expect(plan.content).toContain('Previous chapter — Chapter 1: Arrival');
    expect(plan.content).toContain('Next chapter — Chapter 3: Escape');
    expect(plan.content).toContain('Opening excerpt: "The private prose of the scene."');
    expect(writes).toEqual([]);
  });

  it('keeps earlier turns in the next request', async () => {
    renderChat();
    ask('First question?');
    await screen.findByText('Chapter two could raise the stakes earlier.');
    ask('And then?');
    await waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(2));
    const second = mocks.stream.mock.calls[1]![0] as {messages: {role: string; content: string}[]};
    expect(second.messages.map((message) => message.content)).toEqual([
      'First question?',
      'Chapter two could raise the stakes earlier.',
      'And then?'
    ]);
  });

  it('offers nothing to send when AI coaching is off', () => {
    renderChat(aiConfig(false));
    expect(screen.getByText(/AI coaching is off for this project/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Send'})).not.toBeInTheDocument();
    expect(mocks.stream).not.toHaveBeenCalled();
  });
});
