import {describe, expect, it} from 'vitest';
import {isLoopbackHost, resolveProviderBaseUrl} from './endpointPolicy';

describe('resolveProviderBaseUrl', () => {
  it('uses each provider default when no address is configured', () => {
    expect(resolveProviderBaseUrl('anthropic')).toBe('https://api.anthropic.com');
    expect(resolveProviderBaseUrl('openai', '  ')).toBe('https://api.openai.com');
    expect(resolveProviderBaseUrl('gemini')).toBe('https://generativelanguage.googleapis.com/v1beta');
    expect(resolveProviderBaseUrl('ollama')).toBe('http://localhost:11434');
  });

  it('accepts only HTTPS on the provider origin for hosted providers', () => {
    expect(resolveProviderBaseUrl('openai', 'https://api.openai.com/')).toBe('https://api.openai.com');
    expect(resolveProviderBaseUrl('gemini', 'https://generativelanguage.googleapis.com/v1beta/')).toBe(
      'https://generativelanguage.googleapis.com/v1beta'
    );
    for (const address of [
      'http://api.openai.com',
      'https://api.openai.com.evil.example',
      'https://evil.example/v1',
      'https://api.anthropic.com'
    ]) {
      expect(() => resolveProviderBaseUrl('openai', address)).toThrow(/only sends openai requests/);
    }
    expect(() => resolveProviderBaseUrl('anthropic', 'https://proxy.example')).toThrow();
    expect(() => resolveProviderBaseUrl('gemini', 'http://localhost:8080')).toThrow();
  });

  it('allows an explicitly local OpenAI-compatible server', () => {
    expect(resolveProviderBaseUrl('openai', 'http://127.0.0.1:1234')).toBe('http://127.0.0.1:1234');
  });

  it('keeps Ollama on loopback', () => {
    expect(resolveProviderBaseUrl('ollama', 'http://127.0.0.1:11434/')).toBe('http://127.0.0.1:11434');
    expect(resolveProviderBaseUrl('ollama', 'http://[::1]:11434')).toBe('http://[::1]:11434');
    for (const address of ['http://192.168.1.20:11434', 'https://ollama.com', 'http://localhost.evil.example']) {
      expect(() => resolveProviderBaseUrl('ollama', address)).toThrow(/must run on this computer/);
    }
  });

  it('rejects malformed addresses and ones carrying credentials, queries, or fragments', () => {
    expect(() => resolveProviderBaseUrl('ollama', 'not a url')).toThrow(/not a valid URL/);
    expect(() => resolveProviderBaseUrl('ollama', 'file:///etc/passwd')).toThrow();
    expect(() => resolveProviderBaseUrl('openai', 'https://user:pass@api.openai.com')).toThrow(/credentials/);
    expect(() => resolveProviderBaseUrl('ollama', 'http://localhost:11434/?next=x')).toThrow(/query/);
    expect(() => resolveProviderBaseUrl('ollama', 'http://localhost:11434/#x')).toThrow(/fragment/);
  });
});

describe('isLoopbackHost', () => {
  it('recognizes loopback names and addresses only', () => {
    expect(['localhost', '127.0.0.1', '127.8.9.10', '::1', '[::1]'].every(isLoopbackHost)).toBe(true);
    expect(['0.0.0.0', '10.0.0.1', 'localhost.example', '128.0.0.1'].some(isLoopbackHost)).toBe(false);
  });
});
