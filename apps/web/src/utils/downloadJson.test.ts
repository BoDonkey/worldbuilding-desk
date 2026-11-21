import {describe, expect, it} from 'vitest';
import {sanitizeFileNamePart} from './downloadJson';

describe('sanitizeFileNamePart', () => {
  it('lowercases a name and joins anything other than letters, digits, - and _ into one dash', () => {
    expect(sanitizeFileNamePart('  The Salt Door: Book 1!  ')).toBe('the-salt-door-book-1');
    expect(sanitizeFileNamePart('ash__and--ember')).toBe('ash__and-ember');
  });

  it('uses the fallback when nothing usable is left', () => {
    expect(sanitizeFileNamePart('!!!')).toBe('project');
    expect(sanitizeFileNamePart('背景', 'untitled')).toBe('untitled');
  });
});
