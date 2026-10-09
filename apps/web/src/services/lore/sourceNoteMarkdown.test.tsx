import {Editor} from '@tiptap/core';
import type {JSONContent} from '@tiptap/core';
import {afterEach, describe, expect, it} from 'vitest';
import {sourceNoteEditorExtensions} from '../../components/SourceNotes/sourceNoteEditorExtensions';
import {sourceNoteContentToHtml} from './sourceNoteFormat';
import {sourceNoteDocToMarkdown} from './sourceNoteMarkdown';

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

const load = (markdown: string): Editor => {
  const editor = new Editor({
    extensions: sourceNoteEditorExtensions,
    content: sourceNoteContentToHtml(markdown, 'markdown') || '<p></p>'
  });
  editors.push(editor);
  return editor;
};

const roundTrip = (markdown: string): string => sourceNoteDocToMarkdown(load(markdown).getJSON());

const text = (value: string, marks: string[] = [], href?: string): JSONContent => ({
  type: 'text',
  text: value,
  marks: marks.map((type) => (type === 'link' ? {type, attrs: {href}} : {type}))
});
const paragraph = (...content: JSONContent[]): JSONContent => ({type: 'paragraph', content});
const doc = (...content: JSONContent[]): JSONContent => ({type: 'doc', content});

describe('sourceNoteDocToMarkdown', () => {
  it('nests marks without breaking them and keeps whitespace outside markers', () => {
    expect(
      sourceNoteDocToMarkdown(
        doc(
          paragraph(
            text('She is '),
            text('very ', ['bold']),
            text('stubborn', ['bold', 'italic']),
            text(' and', ['bold']),
            text(' kind. See '),
            text('the map', ['link'], 'https://example.com/a map'),
            text(' or '),
            text('ls -la', ['code'])
          )
        )
      )
    ).toBe('She is **very _stubborn_ and** kind. See [the map](https://example.com/a%20map) or `ls -la`');
  });

  it('escapes text the renderer would read as markup', () => {
    expect(
      sourceNoteDocToMarkdown(
        doc(
          paragraph(text('# not a heading')),
          paragraph(text('- not a list, 5 * 3, snake_case, a|b, <br> and [x]')),
          paragraph(text('1. not numbered'), {type: 'hardBreak'}, text('> not a quote'))
        )
      )
    ).toBe(
      [
        '\\# not a heading',
        '\\- not a list, 5 \\* 3, snake\\_case, a\\|b, \\<br> and \\[x\\]',
        '1\\. not numbered\n\\> not a quote'
      ].join('\n\n')
    );
  });

  it('drops empty paragraphs and writes tables with a header row and padded cells', () => {
    const cell = (type: string, ...content: JSONContent[]): JSONContent => ({type, content});
    expect(
      sourceNoteDocToMarkdown(
        doc(
          paragraph(),
          {
            type: 'table',
            content: [
              {type: 'tableRow', content: [cell('tableHeader', paragraph(text('Trait'))), cell('tableHeader', paragraph(text('Value')))]},
              {
                type: 'tableRow',
                content: [
                  {...cell('tableCell', paragraph(text('Wide'))), attrs: {colspan: 2}}
                ]
              },
              {
                type: 'tableRow',
                content: [
                  cell('tableCell', paragraph(text('a|b'))),
                  cell('tableCell', paragraph(text('one'), {type: 'hardBreak'}, text('two')), paragraph(text('three')))
                ]
              }
            ]
          }
        )
      )
    ).toBe(
      ['| Trait | Value |', '| --- | --- |', '| Wide |   |', '| a\\|b | one<br>two<br>three |'].join('\n')
    );
  });
});

describe('Source Note Markdown round trip through the editor', () => {
  const canonical = [
    '# Camila Garcia deTerra',
    '## Basic Information',
    '**Age:** Mid-30s',
    'She _never_ forgets, and **rarely _ever_ forgives**.\nA second line.',
    '- Stubborn\n- Loyal\n  - To her sister\n- Patient',
    '1. Arrive\n2. Depart',
    '> A quoted line',
    '---',
    '| Trait | Value |\n| --- | --- |\n| Height | 5\'8" |\n| Languages | Spanish<br>English |',
    'Escaped \\* star, a\\|b, snake\\_case, and [a link](https://example.com).'
  ].join('\n\n');

  it('keeps canonical Markdown unchanged', () => {
    expect(roundTrip(canonical)).toBe(canonical);
  });

  it('normalizes other spellings once, then holds steady and renders the same', () => {
    const imported = [
      '# Camila',
      '- **Age:** Mid-30s',
      '* *Occupation:* Archivist',
      '',
      '| **Trait** | **Value** |',
      '| --- | --- |',
      '| Height | 5\'8" \\| tall |',
      '| Notes | Measured<br>twice |',
      '',
      '***Both*** and __strong__'
    ].join('\n');
    const once = roundTrip(imported);
    expect(roundTrip(once)).toBe(once);
    // Bold-italic may nest either way round; both render the same.
    const nestBoldOutside = (html: string) =>
      html.replace(/<em><strong>([^<]*)<\/strong><\/em>/g, '<strong><em>$1</em></strong>');
    expect(nestBoldOutside(sourceNoteContentToHtml(once, 'markdown'))).toBe(
      nestBoldOutside(sourceNoteContentToHtml(imported, 'markdown'))
    );
  });
});
