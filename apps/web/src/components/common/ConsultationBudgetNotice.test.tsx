import {fireEvent, render, renderHook, screen, act, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ConsultationBudgetNotice} from './ConsultationBudgetNotice';
import {useConsultationBudget} from '../../hooks/useConsultationBudget';
import {getConsultationBudgetStatus, recordConsultation} from '../../services/editor';
import type {InspectorSettings, ProjectAISettings} from '../../entityTypes';
import {clearInstalledOllamaModelsCache} from '../../services/llm/ollamaModels';

const inspector = (limit: number): InspectorSettings => ({
  enableAIConsultation: true,
  maxConsultationsPerDay: limit,
  maxContextChars: 1800,
  maxResponseTokens: 500
});

const statusFor = (projectId: string, limit: number) =>
  getConsultationBudgetStatus(projectId, limit);

describe('ConsultationBudgetNotice', () => {
  it('states the cost and what is left before the request', () => {
    recordConsultation('p1', 'assistant', 'anthropic', 20);
    recordConsultation('p1', 'writing-coach', 'anthropic', 20);

    render(
      <ConsultationBudgetNotice
        status={statusFor('p1', 20)}
        isLocal={false}
        onGrantMore={vi.fn()}
      />
    );

    expect(screen.getByText(/Costs 1 of this project's 20 daily AI consultations/)).toBeVisible();
    expect(screen.getByText(/18 left/)).toBeVisible();
    expect(screen.getByText(/midnight tonight/)).toBeVisible();
  });

  it('blocks with an alert that names the reset and offers more for today', () => {
    for (let i = 0; i < 4; i += 1) recordConsultation('p2', 'assistant', 'anthropic', 4);
    const onGrantMore = vi.fn();

    render(
      <ConsultationBudgetNotice
        status={statusFor('p2', 4)}
        isLocal={false}
        onGrantMore={onGrantMore}
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('You have used all 4 AI consultations for this project today');
    expect(alert).toHaveTextContent('midnight tonight');

    fireEvent.click(screen.getByRole('button', {name: /Add 10 more for today/}));
    expect(onGrantMore).toHaveBeenCalledTimes(1);
  });

  it('says a local request costs nothing rather than showing a budget', () => {
    for (let i = 0; i < 20; i += 1) recordConsultation('p3', 'assistant', 'anthropic', 20);

    render(
      <ConsultationBudgetNotice
        status={statusFor('p3', 20)}
        isLocal
        onGrantMore={vi.fn()}
      />
    );

    expect(screen.getByText(/Runs on your local model/)).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders nothing when hidden', () => {
    const {container} = render(
      <ConsultationBudgetNotice
        status={statusFor('p4', 20)}
        isLocal={false}
        onGrantMore={vi.fn()}
        hidden
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});

const HOSTED = {provider: 'anthropic', configs: {}} as unknown as ProjectAISettings;
const ollamaConfig = (model: string) =>
  ({provider: 'ollama', configs: {ollama: {baseUrl: 'http://localhost:11434', model}}}) as unknown as ProjectAISettings;
function stubOllamaTags(models: Array<Record<string, unknown>>) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({models}), {status: 200})));
}

describe('useConsultationBudget', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearInstalledOllamaModelsCache();
  });

  it('spends against the project budget and re-renders the new status', () => {
    const {result} = renderHook(() => useConsultationBudget('p5', inspector(3), HOSTED));

    expect(result.current.status.remaining).toBe(3);
    expect(result.current.blocked).toBe(false);

    act(() => result.current.spend('writing-coach'));
    expect(result.current.status.used).toBe(1);
    expect(result.current.status.byFeature).toEqual([
      {feature: 'writing-coach', label: 'Writing coach', count: 1}
    ]);

    act(() => {
      result.current.spend('writing-coach');
      result.current.spend('assistant');
    });
    expect(result.current.blocked).toBe(true);
    expect(result.current.blockedMessage).toMatch(/used all 3 AI consultations/);
  });

  it('unblocks in place when the author grants more for today', () => {
    const {result} = renderHook(() => useConsultationBudget('p6', inspector(1), HOSTED));

    act(() => result.current.spend('assistant'));
    expect(result.current.blocked).toBe(true);

    act(() => result.current.grantMore());
    expect(result.current.blocked).toBe(false);
    expect(result.current.status.limit).toBe(11);
    expect(result.current.status.configuredLimit).toBe(1);
  });

  it('does not spend the budget for a verified private-local Ollama model', async () => {
    stubOllamaTags([{name: 'qwen3:8b'}]);
    const {result} = renderHook(() => useConsultationBudget('p7', inspector(2), ollamaConfig('qwen3:8b')));
    await waitFor(() => expect(result.current.isLocal).toBe(true));

    act(() => {
      result.current.spend('assistant');
      result.current.spend('assistant');
      result.current.spend('assistant');
    });

    expect(result.current.route.kind).toBe('private-local');
    expect(result.current.status.used).toBe(0);
    expect(result.current.status.localUsed).toBe(3);
    expect(result.current.blocked).toBe(false);
  });

  it('budgets an Ollama cloud model and an unverifiable Ollama model', async () => {
    stubOllamaTags([{name: 'gpt-oss:120b-cloud', remote_host: 'https://ollama.com:443'}]);
    const cloud = renderHook(() => useConsultationBudget('p8', inspector(2), ollamaConfig('gpt-oss:120b-cloud')));
    expect(cloud.result.current.route.kind).toBe('ollama-cloud');
    act(() => cloud.result.current.spend('assistant'));
    expect(cloud.result.current.status.used).toBe(1);

    clearInstalledOllamaModelsCache();
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    const unreachable = renderHook(() => useConsultationBudget('p9', inspector(2), ollamaConfig('qwen3:8b')));
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    expect(unreachable.result.current.route.kind).toBe('ollama-unverified');
    expect(unreachable.result.current.isLocal).toBe(false);
    act(() => unreachable.result.current.spend('assistant'));
    expect(unreachable.result.current.status.used).toBe(1);
  });
});
