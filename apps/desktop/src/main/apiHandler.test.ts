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

  it('accepts a short named object schema and refuses anything else', () => {
    const withSchema = (responseSchema: unknown) => ({
      ...base(),
      providerId: 'local-openai',
      request: {...base().request, responseSchema}
    });
    expect(() => validatePayload(withSchema({name: 'canvas_brainstorm', schema: {type: 'object'}}))).not.toThrow();
    for (const bad of [null, 'schema', {name: 'x'}, {name: 'bad name!', schema: {}}, {name: 'x', schema: []}]) {
      expect(() => validatePayload(withSchema(bad))).toThrow(/responseSchema must be/);
    }
    expect(() => validatePayload(withSchema({name: 'x', schema: {description: 'a'.repeat(20001)}}))).toThrow(/too large/);
  });

  it('accepts a whole-number Maximum reply length within bounds and refuses anything else (4.75)', () => {
    const withLength = (maxReplyTokens: unknown) => ({
      ...base(),
      providerId: 'local-openai',
      providerConfig: {baseUrl: 'http://localhost:5001/v1', maxReplyTokens}
    });
    expect(() => validatePayload(withLength(4096))).not.toThrow();
    expect(() => validatePayload(withLength(undefined))).not.toThrow();
    for (const bad of [63, 131073, 512.5, '4096', null, Number.NaN]) {
      expect(() => validatePayload(withLength(bad))).toThrow(/maxReplyTokens must be a whole number from 64 to 131072/);
    }
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
