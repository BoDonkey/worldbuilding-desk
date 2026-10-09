import {describe, expect, it} from 'vitest';
import type {EntityCategory} from '../../entityTypes';
import {
  classifyImportSections,
  detectImportDocumentName,
  detectImportSections,
  mapImportedTextToFields,
  markdownToRichHtml,
  reconcileImportSectionDestinations,
  stripMarkdownComments
} from './worldBibleImportParsing';
import type {WorldBibleImportSectionDraft} from './worldBibleImportParsing';

const characters: EntityCategory = {
  id: 'characters',
  projectId: 'project',
  kind: 'character',
  name: 'Characters',
  slug: 'characters',
  createdAt: 1,
  fieldSchema: [
    {key: 'description', label: 'Description', type: 'textarea'},
    {key: 'age', label: 'Age', type: 'text'},
    {key: 'role', label: 'Role', type: 'text'},
    {key: 'notes', label: 'Notes', type: 'textarea'}
  ]
};

const withBackground: EntityCategory = {
  ...characters,
  fieldSchema: [
    ...characters.fieldSchema,
    {key: 'background', label: 'Background', type: 'textarea'}
  ]
};

// Mirrors the structure of the author's Markdown character sheet (2026-10-08
// dogfood): H1 title, H2 sections, bold list labels, HTML comments, and a
// trailing colon-style heading.
const markdownSheet = stripMarkdownComments([
  '# Character Sheet: Mira Holt',
  '',
  '<!-- Merged from two drafts. [CHECK] markers need a decision. -->',
  '',
  '## Basic Information',
  '- **Name:** Mira Holt',
  '- Member of the Holt clan',
  '- **Age:** Mid-30s',
  '- **Occupation:** Detective partnered with Ansel Varga',
  '',
  '## Physical Description',
  '- **Height:** 6 ft 1 in',
  '- **Eyes:** Brown with rings like a tree',
  '',
  '## Background',
  '- **Family:** Raised in a mixed community.',
  '',
  '## Naming Note: "Holt"',
  'The surname marks clan affiliation.',
  '',
  'Open questions:',
  '1. **Clan Significance:** What does a clan represent?'
].join('\n')).trim();

describe('Markdown document import', () => {
  it('detects H2 sections, keeps the H1 as the title, and reads bold list labels', () => {
    expect(detectImportDocumentName(markdownSheet, 'Character Sheet - Mira Holt.md')).toBe(
      'Mira Holt'
    );
    expect(detectImportSections(markdownSheet).map((section) => section.title)).toEqual([
      'Basic Information',
      'Physical Description',
      'Background',
      'Naming Note: "Holt"',
      'Open questions'
    ]);
  });

  it('fills Age and Role from label rows and keeps Markdown structure in Description', () => {
    const sections = classifyImportSections(
      detectImportSections(markdownSheet),
      characters,
      'Mira Holt'
    );
    const fields = mapImportedTextToFields(
      characters,
      markdownSheet,
      undefined,
      sections,
      'markdown'
    );

    expect(fields.age).toBe('Mid-30s');
    expect(fields.role).toBe('Detective partnered with Ansel Varga');
    expect(fields.description).toContain('<h1>Character Sheet: Mira Holt</h1>');
    expect(fields.description).toContain('<h2>Basic Information</h2>');
    expect(fields.description).toContain('<li><strong>Age:</strong> Mid-30s</li>');
    expect(fields.description).toContain('<h2>Open questions</h2>');
    expect(fields.description).not.toContain('**');
    expect(fields.description).not.toContain('CHECK');
  });

  it('prefers an exact label match over an alias', () => {
    const category: EntityCategory = {
      ...characters,
      fieldSchema: [
        ...characters.fieldSchema,
        {key: 'occupation', label: 'Occupation', type: 'text'}
      ]
    };
    const fields = mapImportedTextToFields(category, 'Occupation: Courier', undefined, []);

    expect(fields.occupation).toBe('Courier');
    expect(fields.role).toBeUndefined();
  });

  it('maps label rows even when no headings are detected', () => {
    const fields = mapImportedTextToFields(
      characters,
      'Age: 41\nA quiet archivist.',
      undefined,
      []
    );

    expect(fields.age).toBe('41');
    expect(fields.description).toContain('A quiet archivist.');
  });

  it('treats a leading heading with its own content as a section, not a title', () => {
    const source = '## Overview\nA river city.\n\n## History\nFounded twice.';

    expect(detectImportSections(source).map((section) => section.title)).toEqual([
      'Overview',
      'History'
    ]);
  });
});

describe('same-named import headings', () => {
  it('appends every section that lands in one field instead of overwriting', () => {
    const source = [
      'Background:',
      'Family: Raised by his mother.',
      '',
      '### Academic Background',
      'Several colleges.',
      '',
      'Background:',
      'Early education abroad.'
    ].join('\n');
    const sections = detectImportSections(source).map((section) => ({
      ...section,
      action: 'new-field' as const
    }));
    const fields = mapImportedTextToFields(withBackground, source, undefined, sections);

    expect(sections.map((section) => section.title)).toEqual([
      'Background',
      'Academic Background',
      'Background'
    ]);
    expect(fields.background).toContain('Raised by his mother.');
    expect(fields.background).toContain('Early education abroad.');
  });
});

describe('markdownToRichHtml lists', () => {
  it('closes each list item exactly once, including nested and mixed lists', () => {
    const html = markdownToRichHtml(
      ['- one', '- two', '  - two a', '  - two b', '- three', '1. first', '2. second'].join('\n')
    );

    expect(html).toBe(
      '<ul><li>one</li><li>two<ul><li>two a</li><li>two b</li></ul></li><li>three</li></ul>' +
        '<ol><li>first</li><li>second</li></ol>'
    );
  });
});

describe('markdownToRichHtml tables and links', () => {
  it('keeps escaped pipes and <br> line breaks inside table cells', () => {
    const html = markdownToRichHtml(
      ['| Trait | Notes |', '| --- | --- |', '| Height \\| build | one<br>two |'].join('\n')
    );

    expect(html).toBe(
      '<table><thead><tr><th>Trait</th><th>Notes</th></tr></thead>' +
        '<tbody><tr><td>Height | build</td><td>one<br />two</td></tr></tbody></table>'
    );
  });

  it('reads backslash escapes as literal text and <br> as a line break', () => {
    expect(markdownToRichHtml('\\# not a heading')).toBe('<p># not a heading</p>');
    expect(markdownToRichHtml('\\- 5 \\* 3 \\*kept\\* snake\\_case \\<br> one<br>two')).toBe(
      '<p>- 5 * 3 *kept* snake_case &lt;br&gt; one<br />two</p>'
    );
  });

  it('links only web and mail URLs and never breaks out of the href', () => {
    expect(markdownToRichHtml('[site](https://example.com/a"b)')).toBe(
      '<p><a href="https://example.com/a&quot;b">site</a></p>'
    );
    expect(markdownToRichHtml('[bad](javascript:alert(1))')).toBe('<p>bad)</p>');
  });
});

const section = (
  title: string,
  content: string,
  destination: Partial<WorldBibleImportSectionDraft> = {}
): WorldBibleImportSectionDraft => ({
  id: title,
  title,
  content,
  action: 'record-section',
  ...destination
});

describe('import heading destinations', () => {
  it('classifies a heading that matches a field to that field key', () => {
    const [age] = classifyImportSections([section('Age', '41')], characters, 'Mira');

    expect(age).toMatchObject({action: 'existing-field', fieldKey: 'age'});
  });

  it('sends a heading to the field the author picked, whatever its title', () => {
    const fields = mapImportedTextToFields(
      withBackground,
      'Schooling:\nTaught at home.',
      undefined,
      [section('Schooling', 'Taught at home.', {action: 'existing-field', fieldKey: 'background'})]
    );

    expect(fields.background).toContain('Taught at home.');
    expect(fields.description ?? '').not.toContain('Taught at home.');
  });

  it('fills a planned new field by its label once the field exists', () => {
    const category: EntityCategory = {
      ...characters,
      fieldSchema: [...characters.fieldSchema, {key: 'education', label: 'Education', type: 'textarea'}]
    };
    const fields = mapImportedTextToFields(category, 'Schooling:\nTaught at home.', undefined, [
      section('Schooling', 'Taught at home.', {action: 'new-field', newFieldLabel: 'Education'})
    ]);

    expect(fields.education).toContain('Taught at home.');
  });

  it('turns a planned new field into the existing field once another import creates it', () => {
    const planned = [section('Schooling', 'Home.', {action: 'new-field', newFieldLabel: 'Education'})];
    const before = reconcileImportSectionDestinations(planned, characters, 'Mira');
    const after = reconcileImportSectionDestinations(
      planned,
      {
        ...characters,
        fieldSchema: [...characters.fieldSchema, {key: 'education', label: 'Education', type: 'textarea'}]
      },
      'Mira'
    );

    expect(before).toBe(planned);
    expect(after[0]).toMatchObject({action: 'existing-field', fieldKey: 'education'});
    expect(after[0].newFieldLabel).toBeUndefined();
  });

  it('reclassifies a heading whose chosen field no longer exists', () => {
    const [reconciled] = reconcileImportSectionDestinations(
      [section('Age', '41', {action: 'existing-field', fieldKey: 'deleted_field'})],
      characters,
      'Mira'
    );

    expect(reconciled).toMatchObject({action: 'existing-field', fieldKey: 'age'});
  });

  it('keeps author choices that are still valid', () => {
    const sections = [
      section('Age', '41', {action: 'existing-field', fieldKey: 'role'}),
      section('Rumors', 'Unclear.', {action: 'ignore'})
    ];

    expect(reconcileImportSectionDestinations(sections, characters, 'Mira')).toBe(sections);
  });
});
