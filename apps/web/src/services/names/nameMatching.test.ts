import {describe, expect, it} from 'vitest';
import {normalizeNameExact, normalizeNameLoose} from './nameMatching';

describe('normalizeNameExact', () => {
  it('ignores case and spacing only', () => {
    expect(normalizeNameExact('  Kael   Voss ')).toBe('kael voss');
    expect(normalizeNameExact('Ember-Archive')).toBe('ember-archive');
    expect(normalizeNameExact('The Archive')).toBe('the archive');
  });

  it('keeps letters from every script', () => {
    expect(normalizeNameExact(' Москва ')).toBe('москва');
  });
});

describe('normalizeNameLoose', () => {
  it('ignores case, punctuation, and hyphens', () => {
    expect(normalizeNameLoose('Ember-Archive!')).toBe('ember archive');
    expect(normalizeNameLoose("Kael's vault")).toBe('kael s vault');
  });

  it('drops a leading "the" only when asked', () => {
    expect(normalizeNameLoose('The Ember Archive')).toBe('the ember archive');
    expect(normalizeNameLoose('The Ember Archive', {dropLeadingArticle: true})).toBe('ember archive');
    expect(normalizeNameLoose('Theron', {dropLeadingArticle: true})).toBe('theron');
  });

  it('keeps non-Latin letters and accents instead of dropping them', () => {
    expect(normalizeNameLoose('Москва')).toBe('москва');
    expect(normalizeNameLoose('Αθήνα')).toBe('αθήνα');
    expect(normalizeNameLoose('京都・東山')).toBe('京都 東山');
    expect(normalizeNameLoose('Café Noir')).toBe('café noir');
    expect(normalizeNameLoose('नई दिल्ली')).toBe('नई दिल्ली');
  });

  it('treats composed and decomposed accents as the same name', () => {
    expect(normalizeNameLoose('Café')).toBe(normalizeNameLoose('Café'));
  });
});
