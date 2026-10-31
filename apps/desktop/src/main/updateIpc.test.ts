import {describe, expect, it} from 'vitest';
import {testUpdateFeedUrl} from './updateIpc';

describe('testUpdateFeedUrl', () => {
  it('accepts only a loopback HTTP feed', () => {
    expect(testUpdateFeedUrl('http://127.0.0.1:47811/')).toBe('http://127.0.0.1:47811/');
    expect(testUpdateFeedUrl('http://localhost:47811/feed')).toBe('http://localhost:47811/feed');
    expect(testUpdateFeedUrl(undefined)).toBeNull();
    expect(testUpdateFeedUrl('')).toBeNull();
    expect(testUpdateFeedUrl('https://evil.example/feed')).toBeNull();
    expect(testUpdateFeedUrl('http://127.0.0.1.evil.example/')).toBeNull();
    expect(testUpdateFeedUrl('file:///tmp/feed')).toBeNull();
    expect(testUpdateFeedUrl('not a url')).toBeNull();
  });
});
