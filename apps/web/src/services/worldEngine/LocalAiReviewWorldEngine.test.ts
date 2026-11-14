import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {ProjectAISettings} from '../../entityTypes';
import type {GuardrailIssue} from '../consistency';
import {clearInstalledOllamaModelsCache} from '../llm/ollamaModels';
import {LocalAiReviewWorldEngine} from './LocalAiReviewWorldEngine';
import type {ReviewClassification, WorldEngine, WorldEngineReviewResult} from './types';

const sourceText = 'Mira met Kessel at the gate.';
const issue: GuardrailIssue = {
  code: 'UNKNOWN_ENTITY',
  severity: 'warning',
  message: 'Unknown name "Kessel".',
  span: {start: 9, end: 15},
  surface: 'Kessel'
};
const deterministicNote: ReviewClassification = {
  issueCode: 'UNKNOWN_ENTITY',
  confidence: 0.5,
  summary: 'Deterministic note.'
};

const baseEngine = {
  getStatus: async () => ({state: 'available', modelLabel: 'Deterministic'}),
  extractObservations: async () => [],
  reviewText: async () =>
    ({
      proposal: {text: sourceText},
      validation: {allowCommit: true, issues: [issue]},
      observations: [],
      issueAnnotations: [{...deterministicNote, source: 'deterministic', engineLabel: 'Deterministic'}]
    }) as unknown as WorldEngineReviewResult,
  classifyReviewItem: async () => deterministicNote,
  applyAcceptedProposal: async () => undefined
} satisfies WorldEngine;

const reply = JSON.stringify([
  {issueCode: 'UNKNOWN_ENTITY', confidence: 0.9, summary: 'Local model note.', evidenceStart: null, evidenceEnd: null}
]);

const settings = (overrides: Record<string, unknown> = {}) =>
  ({provider: 'ollama', configs: {}, aiCoaching: true, ...overrides}) as unknown as ProjectAISettings;

/** Answers Ollama's installed-model list and chat endpoint; returns the chat request bodies. */
function stubOllama(models: Array<Record<string, unknown>>) {
  const chatBodies: Array<Record<string, unknown>> = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).endsWith('/api/tags')) return new Response(JSON.stringify({models}));
    chatBodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({message: {content: reply}}));
  });
  vi.stubGlobal('fetch', fetchMock);
  return {chatBodies, fetchMock};
}

const review = (engine: LocalAiReviewWorldEngine) =>
  engine.reviewText({} as Parameters<WorldEngine['reviewText']>[0]);

describe('local AI review annotations (slice 3.41)', () => {
  beforeEach(() => {
    clearInstalledOllamaModelsCache();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('replaces the deterministic note with the local model note', async () => {
    const {chatBodies} = stubOllama([{name: 'qwen3:latest'}]);
    const result = await review(new LocalAiReviewWorldEngine(baseEngine, settings()));
    expect(result.issueAnnotations).toEqual([
      expect.objectContaining({
        source: 'local-ai',
        engineLabel: 'Local AI review (qwen3:latest)',
        summary: 'Local model note.',
        confidence: 0.9
      })
    ]);
    expect(chatBodies).toHaveLength(1);
    expect(chatBodies[0]).toMatchObject({model: 'qwen3:latest'});
  });

  it('sends nothing when AI coaching is off, and keeps the deterministic notes', async () => {
    const {chatBodies} = stubOllama([{name: 'qwen3:latest'}]);
    const result = await review(
      new LocalAiReviewWorldEngine(baseEngine, settings({aiCoaching: false}))
    );
    expect(chatBodies).toEqual([]);
    expect(result.issueAnnotations).toEqual([expect.objectContaining({source: 'deterministic'})]);
  });

  it('skips a cloud model listed first and uses the first local one', async () => {
    const {chatBodies} = stubOllama([
      {name: 'big:cloud'},
      {name: 'hosted', remote_host: 'https://ollama.com'},
      {name: 'qwen3:latest'}
    ]);
    const engine = new LocalAiReviewWorldEngine(baseEngine, settings());
    expect(await engine.getStatus()).toEqual({
      state: 'available',
      modelLabel: 'Local AI review (qwen3:latest)'
    });
    await review(engine);
    expect(chatBodies.map((body) => body.model)).toEqual(['qwen3:latest']);
  });

  it('refuses a configured cloud model without sending', async () => {
    const {chatBodies} = stubOllama([{name: 'big:cloud'}, {name: 'qwen3:latest'}]);
    const engine = new LocalAiReviewWorldEngine(
      baseEngine,
      settings({configs: {ollama: {model: 'big:cloud'}}})
    );
    expect(await engine.getStatus()).toMatchObject({state: 'installedUnavailable'});
    const result = await review(engine);
    expect(chatBodies).toEqual([]);
    expect(result.issueAnnotations).toEqual([expect.objectContaining({source: 'deterministic'})]);
  });

  it('reports not installed when only cloud models are listed', async () => {
    stubOllama([{name: 'big:cloud'}]);
    const engine = new LocalAiReviewWorldEngine(baseEngine, settings());
    expect(await engine.getStatus()).toEqual({state: 'notInstalled'});
  });

  it('never queries a remote Ollama address', async () => {
    const {fetchMock} = stubOllama([{name: 'qwen3:latest'}]);
    const engine = new LocalAiReviewWorldEngine(
      baseEngine,
      settings({configs: {ollama: {baseUrl: 'http://192.168.1.20:11434'}}})
    );
    expect(await engine.getStatus()).toMatchObject({state: 'installedUnavailable'});
    await review(engine);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses Ollama through the main process in the desktop app, whatever the project provider', async () => {
    const {chatBodies} = stubOllama([{name: 'qwen3:latest'}]);
    const llmComplete = vi.fn(async () => reply);
    vi.stubGlobal('window', {
      electronAPI: {
        llmComplete,
        providerKeys: {status: vi.fn(async () => ({})), set: vi.fn(), clear: vi.fn()}
      }
    });
    const result = await review(
      new LocalAiReviewWorldEngine(baseEngine, settings({provider: 'anthropic'}))
    );
    expect(result.issueAnnotations).toEqual([expect.objectContaining({source: 'local-ai'})]);
    // The renderer only listed the installed models; the review text went to the main process.
    expect(chatBodies).toEqual([]);
    expect(llmComplete).toHaveBeenCalledTimes(1);
    const [payload] = llmComplete.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(payload).toMatchObject({
      providerId: 'ollama',
      request: {feature: 'local-review', model: 'qwen3:latest'}
    });
  });
});
