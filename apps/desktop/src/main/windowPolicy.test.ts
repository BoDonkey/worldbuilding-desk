import {describe, expect, it} from 'vitest';
import {buildDevContentSecurityPolicy, isRendererNavigation} from './windowPolicy';

describe('isRendererNavigation', () => {
  it('allows only the dev server origin in development', () => {
    const renderer = 'http://localhost:5173/';
    expect(isRendererNavigation('http://localhost:5173/workspace?x=1#y', renderer)).toBe(true);
    expect(isRendererNavigation('http://localhost:5174/', renderer)).toBe(false);
    expect(isRendererNavigation('https://example.com/', renderer)).toBe(false);
  });

  it('allows only the packaged index file in production', () => {
    const renderer = 'file:///Applications/SagaSpine.app/Contents/Resources/renderer/index.html';
    expect(isRendererNavigation(`${renderer}#/workspace`, renderer)).toBe(true);
    expect(isRendererNavigation('file:///etc/passwd', renderer)).toBe(false);
    expect(isRendererNavigation('https://example.com/', renderer)).toBe(false);
    expect(isRendererNavigation('not a url', renderer)).toBe(false);
  });
});

describe('buildDevContentSecurityPolicy', () => {
  it('limits connections to the dev server, loopback, and embedding-model hosts', () => {
    const policy = buildDevContentSecurityPolicy('http://localhost:5173');
    const connect = policy.split('; ').find((directive) => directive.startsWith('connect-src')) ?? '';

    expect(connect).toContain('ws://localhost:5173');
    expect(connect).toContain('http://127.0.0.1:*');
    expect(connect).not.toMatch(/anthropic|openai|googleapis/);
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
  });
});
