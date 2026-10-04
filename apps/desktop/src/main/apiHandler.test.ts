import {describe, expect, it} from 'vitest';
import {validatePayload} from './apiHandler';

const base = () => ({
  providerId: 'anthropic',
  request: {messages: [{role: 'user', content: 'Hello'}]}
});

describe('validatePayload', () => {
  it('accepts a well-formed request without a key', () => {
    expect(() => validatePayload(base())).not.toThrow();
    expect(() => validatePayload({...base(), providerId: 'gemini'})).not.toThrow();
    expect(() =>
      validatePayload({...base(), providerId: 'ollama', providerConfig: {baseUrl: 'http://localhost:11434'}})
    ).not.toThrow();
  });

  it('refuses a key sent from the renderer, even an empty one', () => {
    expect(() => validatePayload({...base(), apiKey: 'sk-ant-secret'})).toThrow(/must not be sent/);
    expect(() => validatePayload({...base(), apiKey: undefined})).toThrow(/must not be sent/);
  });

  it('refuses unknown providers and addresses outside the provider policy', () => {
    expect(() => validatePayload({...base(), providerId: 'mistral'})).toThrow(/providerId/);
    expect(() =>
      validatePayload({...base(), providerId: 'openai', providerConfig: {baseUrl: 'https://evil.example'}})
    ).toThrow(/only sends openai requests/);
    expect(() =>
      validatePayload({...base(), providerId: 'ollama', providerConfig: {baseUrl: 'http://10.0.0.5:11434'}})
    ).toThrow(/must run on this computer/);
    expect(() => validatePayload({...base(), providerConfig: 'https://api.anthropic.com'})).toThrow(/providerConfig/);
  });

  it('keeps the existing request shape checks', () => {
    expect(() => validatePayload({...base(), request: {messages: []}})).toThrow(/cannot be empty/);
    expect(() =>
      validatePayload({...base(), request: {messages: [{role: 'tool', content: 'x'}]}})
    ).toThrow(/role/);
    expect(() =>
      validatePayload({...base(), request: {...base().request, maxTokens: 0}})
    ).toThrow(/maxTokens/);
  });
});
