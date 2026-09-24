import {describe, expect, it} from 'vitest';
import {
  HOSTED_RESPONSE_LIMIT_MESSAGE,
  assertHostedResponseComplete,
  geminiThinkingConfig,
  getHostedResponseCostCeiling,
  openAIUsesReasoning
} from './hostedResponsePolicy';

describe('hosted response cost ceiling', () => {
  it('uses the largest real hosted cap and rounds the estimate upward to cents', () => {
    expect(getHostedResponseCostCeiling('openai', 'gpt-4o-mini', 500)).toMatchObject({
      tokens: 1500,
      maximumOutputUsd: 0.01,
      outputUsdPerMillionTokens: 0.6
    });
  });

  it('keeps an unknown model explicit instead of guessing a price', () => {
    expect(getHostedResponseCostCeiling('anthropic', 'custom-model', 2000)).toEqual({
      tokens: 2000,
      model: 'custom-model'
    });
    expect(getHostedResponseCostCeiling('ollama', 'qwen3', 500)).toBeNull();
  });
});

describe('hosted provider policy', () => {
  it('recognizes provider cap stop reasons and permits normal stops', () => {
    expect(() => assertHostedResponseComplete('anthropic', 'end_turn')).not.toThrow();
    expect(() => assertHostedResponseComplete('openai', 'stop')).not.toThrow();
    expect(() => assertHostedResponseComplete('gemini', 'STOP')).not.toThrow();
    expect(() => assertHostedResponseComplete('anthropic', 'max_tokens')).toThrow(HOSTED_RESPONSE_LIMIT_MESSAGE);
    expect(() => assertHostedResponseComplete('openai', 'length')).toThrow(HOSTED_RESPONSE_LIMIT_MESSAGE);
    expect(() => assertHostedResponseComplete('gemini', 'MAX_TOKENS')).toThrow(HOSTED_RESPONSE_LIMIT_MESSAGE);
  });

  it('minimizes unavoidable hosted reasoning by known model family', () => {
    expect(openAIUsesReasoning('o3-mini')).toBe(true);
    expect(openAIUsesReasoning('gpt-5-mini')).toBe(true);
    expect(openAIUsesReasoning('gpt-4o-mini')).toBe(false);
    expect(geminiThinkingConfig('gemini-2.5-flash')).toEqual({thinkingBudget: 0});
    expect(geminiThinkingConfig('gemini-2.5-pro')).toEqual({thinkingBudget: 128});
    expect(geminiThinkingConfig('gemini-2.5-pro', 100)).toBeUndefined();
    expect(geminiThinkingConfig('gemini-3.5-flash')).toEqual({thinkingLevel: 'low'});
    expect(geminiThinkingConfig('custom-gemini')).toBeUndefined();
  });
});
