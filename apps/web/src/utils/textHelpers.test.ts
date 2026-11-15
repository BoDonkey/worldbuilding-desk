import {describe, expect, it} from 'vitest';
import {htmlTextContent, htmlToPlainText} from './textHelpers';

// Node project: no DOMParser, so this pins the fallback, which must read
// HTML the way the browser's textContent does.
describe('the shared HTML-to-text decoder without a DOM', () => {
  it('drops tags without inserting spaces and decodes entities once', () => {
    expect(htmlTextContent('<p>Se<b>ra</b></p><p>Kael</p>')).toBe('SeraKael');
    expect(htmlTextContent('<p>Tom &amp; Jerry &amp;lt; &quot;x&quot; it&#39;s</p>')).toBe('Tom & Jerry &lt; "x" it\'s');
    expect(htmlTextContent('a&nbsp;b')).toBe('a b');
  });

  it('collapses whitespace for the one-line form', () => {
    expect(htmlToPlainText('<p>  Sera\n picked&nbsp;up </p>')).toBe('Sera picked up');
    expect(htmlToPlainText('')).toBe('');
  });
});
