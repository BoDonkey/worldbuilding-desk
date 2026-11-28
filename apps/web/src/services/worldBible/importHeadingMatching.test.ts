import {describe, expect, it} from 'vitest';
import type {WorldBibleImportSectionDraft} from './worldBibleImportParsing';
import {applyHeadingDestinationToMatches, findMatchingHeadingDrafts} from './importHeadingMatching';

const section = (
  id: string,
  title: string,
  extra: Partial<WorldBibleImportSectionDraft> = {}
): WorldBibleImportSectionDraft => ({id, title, content: '', action: 'record-section', ...extra});

const draft = (id: string, sections: WorldBibleImportSectionDraft[], extra: Record<string, unknown> = {}) => ({
  id,
  categoryId: 'characters',
  useDetectedSections: true,
  detectedSections: sections,
  ...extra
});

describe('importHeadingMatching (4.99)', () => {
  const source = draft('a', [section('a1', 'Appearance', {action: 'new-field', chosenByAuthor: true})]);

  it('finds the same heading on other pending drafts in the category', () => {
    const drafts = [
      source,
      draft('b', [section('b1', '  appearance ')]),
      draft('c', [section('c1', 'Appearance')], {categoryId: 'places'}),
      draft('d', [section('d1', 'Appearance')], {status: 'imported'}),
      draft('e', [section('e1', 'Appearance')], {parseError: 'Unreadable'}),
      draft('f', [section('f1', 'Appearance')], {useDetectedSections: false}),
      draft('g', [section('g1', 'History')])
    ];
    expect(findMatchingHeadingDrafts(drafts, 'a', 'a1')).toEqual([{draftId: 'b', sectionIds: ['b1']}]);
  });

  it('skips headings the author set by hand and ones already going there', () => {
    const drafts = [
      source,
      draft('b', [section('b1', 'Appearance', {action: 'ignore', chosenByAuthor: true})]),
      draft('c', [section('c1', 'Appearance', {action: 'new-field'})])
    ];
    expect(findMatchingHeadingDrafts(drafts, 'a', 'a1')).toEqual([]);
  });

  it('copies the destination without marking it as set by hand', () => {
    const sourceDraft = draft('a', [
      section('a1', 'Appearance', {action: 'new-field', newFieldLabel: 'Looks', chosenByAuthor: true})
    ]);
    const drafts = [sourceDraft, draft('b', [section('b1', 'Appearance'), section('b2', 'History')])];
    const next = applyHeadingDestinationToMatches(drafts, 'a', 'a1');
    expect(next[0]).toBe(drafts[0]);
    expect(next[1].detectedSections).toEqual([
      section('b1', 'Appearance', {action: 'new-field', newFieldLabel: 'Looks', fieldKey: undefined}),
      section('b2', 'History')
    ]);
    // Renaming the source's new field makes the copy different again, so it can follow.
    const renamed = next.map((item) =>
      item.id === 'a'
        ? {...item, detectedSections: [{...item.detectedSections[0], newFieldLabel: 'Look'}]}
        : item
    );
    expect(findMatchingHeadingDrafts(renamed, 'a', 'a1')).toEqual([{draftId: 'b', sectionIds: ['b1']}]);
  });

  it('returns the same drafts when nothing matches', () => {
    const drafts = [source];
    expect(applyHeadingDestinationToMatches(drafts, 'a', 'a1')).toBe(drafts);
  });
});
