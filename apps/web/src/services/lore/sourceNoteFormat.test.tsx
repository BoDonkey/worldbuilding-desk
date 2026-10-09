import {describe, expect, it} from 'vitest';
import {
  resolveSourceNoteFormat,
  sanitizeSourceNoteHtml,
  sourceNoteContentToHtml
} from './sourceNoteFormat';

describe('resolveSourceNoteFormat', () => {
  it('reads Markdown imports saved as plain text before 4.57 as Markdown', () => {
    expect(
      resolveSourceNoteFormat({
        format: 'plain_text',
        source: {type: 'import', fileName: 'Camila.MD'}
      })
    ).toBe('markdown');
    expect(
      resolveSourceNoteFormat({
        format: 'plain_text',
        source: {type: 'import', fileName: 'notes.txt'}
      })
    ).toBe('plain_text');
    expect(resolveSourceNoteFormat({format: 'plain_text', source: {type: 'manual'}})).toBe(
      'plain_text'
    );
    expect(resolveSourceNoteFormat({format: 'markdown', source: {type: 'manual'}})).toBe(
      'markdown'
    );
  });
});

describe('sourceNoteContentToHtml', () => {
  it('renders Markdown headings, emphasis, lists, and tables', () => {
    const html = sourceNoteContentToHtml(
      [
        '## Background',
        '- **Age:** Mid-30s',
        '',
        '| Trait | Value |',
        '| --- | --- |',
        '| Height | 5\'8" |'
      ].join('\n'),
      'markdown'
    );

    expect(html).toBe(
      '<h2>Background</h2><ul><li><strong>Age:</strong> Mid-30s</li></ul>' +
        '<table><thead><tr><th>Trait</th><th>Value</th></tr></thead>' +
        '<tbody><tr><td>Height</td><td>5\'8"</td></tr></tbody></table>'
    );
  });

  it('shows plain text as escaped paragraphs without reading Markdown', () => {
    expect(sourceNoteContentToHtml('**not bold** <b>x</b>\nline two\n\nNext', 'plain_text')).toBe(
      '<p>**not bold** &lt;b&gt;x&lt;/b&gt;<br>line two</p><p>Next</p>'
    );
  });

  it('returns nothing for an empty note', () => {
    expect(sourceNoteContentToHtml('  \n ', 'markdown')).toBe('');
  });
});

describe('sanitizeSourceNoteHtml', () => {
  it('drops scripts, unwraps unknown tags, and strips attributes and unsafe links', () => {
    const html = sanitizeSourceNoteHtml(
      '<p onclick="steal()" style="color:red">Hi <img src=x onerror="steal()"><span class="a">there</span></p>' +
        '<script>steal()</script><a href="javascript:steal()">bad</a>' +
        '<a href="https://example.com" onclick="steal()">good</a>'
    );

    expect(html).toBe(
      '<p>Hi there</p><a>bad</a>' +
        '<a href="https://example.com" target="_blank" rel="noopener noreferrer">good</a>'
    );
  });
});
