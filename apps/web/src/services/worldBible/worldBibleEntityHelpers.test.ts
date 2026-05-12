import {describe, expect, it} from 'vitest';
import {
  ALTERNATIVE_NAMES_KEY,
  buildCanonicalAliasList,
  convertPlainTextToRichHtml,
  extractPlainTextFromRichText,
  extractStructuredSummaryFromRichText,
  getAliasConversionPlan,
  isRichTextEffectivelyEmpty,
  mergeEntityFields,
  normalizeRichTextValue,
  normalizeName,
  parseAlternativeNames
} from './worldBibleEntityHelpers';

describe('worldBibleEntityHelpers', () => {
  it('normalizes and deduplicates alternative names case-insensitively', () => {
    expect(normalizeName('  Ember   Archive  ')).toBe('ember archive');
    expect(parseAlternativeNames('Kael, kael,  Ember Archive , ember archive')).toEqual([
      'kael',
      'ember archive'
    ]);
  });

  it('preserves the previous name as an alias when renaming', () => {
    expect(
      buildCanonicalAliasList({
        previousName: 'Kael',
        nextName: 'Kaelor',
        aliases: [' Wanderer ', 'kael', 'WANDERER']
      })
    ).toEqual(['kael', 'WANDERER']);
  });

  it('normalizes plain text into rich text html and extracts plain text back out', () => {
    expect(convertPlainTextToRichHtml('First line\nSecond line')).toBe(
      '<p>First line<br />Second line</p>'
    );
    expect(normalizeRichTextValue('Plain paragraph')).toBe('<p>Plain paragraph</p>');
    expect(extractPlainTextFromRichText('<p>Alpha <strong>Beta</strong></p>')).toBe(
      'Alpha Beta'
    );
    expect(isRichTextEffectivelyEmpty('<p></p>')).toBe(true);
    expect(isRichTextEffectivelyEmpty('<p><br></p>')).toBe(true);
  });

  it('preserves lightweight structure for summary excerpts', () => {
    expect(
      extractStructuredSummaryFromRichText(
        [
          '<p>Capital districts:</p>',
          '<ul><li>Old Ward</li><li>River Gate</li></ul>',
          '<blockquote>Speak softly. Carry fire.</blockquote>',
          '<table><tr><th>House</th><th>Seat</th></tr><tr><td>Ember</td><td>Glass Keep</td></tr></table>'
        ].join('')
      )
    ).toBe(
      'Capital districts: • - Old Ward • - River Gate • "Speak softly. Carry fire." • House: Ember | Seat: Glass Keep'
    );
  });

  it('fills empty fields and merges alternative names without clobbering populated data', () => {
    const merged = mergeEntityFields(
      {
        description: 'Existing summary',
        notes: '',
        tags: [],
        [ALTERNATIVE_NAMES_KEY]: 'Kael'
      },
      {
        description: 'Incoming summary',
        notes: 'Fresh notes',
        tags: ['chosen'],
        [ALTERNATIVE_NAMES_KEY]: 'Wanderer, kael'
      }
    );

    expect(merged).toEqual({
      description: 'Existing summary',
      notes: 'Fresh notes',
      tags: ['chosen'],
      [ALTERNATIVE_NAMES_KEY]: 'kael, Wanderer'
    });
  });

  it('builds an alias-conversion plan only when the source has no unique field content', () => {
    const convertible = getAliasConversionPlan({
      sourceName: 'Kael',
      sourceFields: {
        [ALTERNATIVE_NAMES_KEY]: 'Wanderer'
      },
      sourceLinks: ['doc-1'],
      targetName: 'Kaelor',
      targetFields: {
        summary: 'Known scout'
      },
      targetLinks: [],
      sourceIndexedAliases: ['The Scout'],
      targetIndexedAliases: ['Bladeborn'],
      alternativeNamesKey: ALTERNATIVE_NAMES_KEY,
      normalizeName,
      parseAlternativeNames
    });

    expect(convertible.transferAliases).toEqual([
      'Bladeborn',
      'The Scout',
      'Wanderer',
      'Kael'
    ]);
    expect(convertible.mergedLinks).toEqual(['doc-1']);
    expect(convertible.canDeleteSource).toBe(true);
    expect(convertible.blockingFieldKeys).toEqual([]);
    expect(convertible.hasLinkChanges).toBe(true);

    const blocked = getAliasConversionPlan({
      sourceName: 'Kael',
      sourceFields: {
        summary: 'Unique backstory',
        [ALTERNATIVE_NAMES_KEY]: 'Wanderer'
      },
      sourceLinks: [],
      targetName: 'Kaelor',
      targetFields: {
        summary: ''
      },
      targetLinks: [],
      sourceIndexedAliases: [],
      targetIndexedAliases: [],
      alternativeNamesKey: ALTERNATIVE_NAMES_KEY,
      normalizeName,
      parseAlternativeNames
    });

    expect(blocked.canDeleteSource).toBe(false);
    expect(blocked.blockingFieldKeys).toEqual(['summary']);
  });
});
