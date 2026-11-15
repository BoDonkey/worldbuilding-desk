import {describe, expect, it} from 'vitest';
import {hashString} from './hashString';

describe('hashString', () => {
  it('is stable across releases, since stored sourceHash values depend on it', () => {
    expect(hashString('scene text')).toBe('h39ecb526');
    expect(hashString('')).toBe('h1505');
    expect(hashString('changed text')).not.toBe(hashString('scene text'));
  });
});
