import {describe, expect, it} from 'vitest';
import {
  convertPlainTextToRichHtml,
  extractPlainTextFromRichText,
  extractStructuredSummaryFromRichText,
  isRichTextEffectivelyEmpty,
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

});
