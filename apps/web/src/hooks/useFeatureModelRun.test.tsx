import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ProjectAISettings} from '../entityTypes';
import type {UseConsultationBudget} from './useConsultationBudget';
import {useFeatureModelRun} from './useFeatureModelRun';

const mocks = vi.hoisted(() => ({stream: vi.fn()}));

vi.mock('../services/llm/LLMService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/llm/LLMService')>();
  return {
    LLMService: class extends actual.LLMService {
      stream = mocks.stream;
    }
  };
});

const aiConfig = {
  provider: 'anthropic',
  configs: {anthropic: {apiKey: 'test-key', model: 'claude-test'}},
  promptTools: [],
  defaultToolIds: [],
  aiCoaching: true,
  aiProse: true
} as unknown as ProjectAISettings;

const budget = (overrides: Partial<UseConsultationBudget> = {}) =>
  ({blocked: false, blockedMessage: null, spend: vi.fn(), ...overrides}) as unknown as UseConsultationBudget;

const request = {feature: 'writing-coach' as const, messages: [{role: 'user' as const, content: 'Hi'}]};
const providerMessages = {notConfigured: 'No provider for this feature.'};

describe('useFeatureModelRun', () => {
  beforeEach(() => {
    mocks.stream.mockReset();
    mocks.stream.mockImplementation(async function* () {
      yield 'An answer.';
    });
  });

  it('spends one consultation under the request feature and streams the answer', async () => {
    const spending = budget();
    const {result} = renderHook(() => useFeatureModelRun({aiConfig, budget: spending, providerMessages}));
    expect(result.current.providerIssue).toBeNull();

    let answer = '';
    await act(async () => {
      answer = (await result.current.run(request)).answer;
    });

    expect(answer).toBe('An answer.');
    expect(spending.spend).toHaveBeenCalledTimes(1);
    expect(spending.spend).toHaveBeenCalledWith('writing-coach');
    expect(mocks.stream).toHaveBeenCalledWith(expect.objectContaining({feature: 'writing-coach'}));
  });

  it('names the feature’s provider issue and refuses to run without a provider', async () => {
    const spending = budget();
    const {result} = renderHook(() =>
      useFeatureModelRun({aiConfig: undefined, budget: spending, providerMessages})
    );
    expect(result.current.providerIssue).toBe('No provider for this feature.');

    await expect(result.current.run(request)).rejects.toThrow('No provider for this feature.');
    expect(spending.spend).not.toHaveBeenCalled();
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('refuses without spending when the budget is used up', async () => {
    const spending = budget({blocked: true, blockedMessage: 'Used up for today.'});
    const {result} = renderHook(() => useFeatureModelRun({aiConfig, budget: spending, providerMessages}));

    await expect(result.current.run(request)).rejects.toThrow('Used up for today.');
    expect(spending.spend).not.toHaveBeenCalled();
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('does not spend when the provider setup is rejected', async () => {
    const spending = budget();
    const broken = {...aiConfig, provider: 'no-such-provider'} as unknown as ProjectAISettings;
    const {result} = renderHook(() => useFeatureModelRun({aiConfig: broken, budget: spending, providerMessages}));
    expect(result.current.providerIssue).not.toBeNull();

    await expect(result.current.run(request)).rejects.toThrow();
    expect(spending.spend).not.toHaveBeenCalled();
  });
});
