import {describe, expect, it} from 'vitest';
import {
  detectImportDocumentName,
  detectImportSections,
  mapImportedTextToFields,
  markdownToRichHtml
} from './useWorldBibleImports';
import type {EntityCategory} from '../entityTypes';

describe('markdownToRichHtml', () => {
  it('renders common AI concept markdown without exposing raw syntax', () => {
    const html = markdownToRichHtml(
      [
        '# Item Concept: The Silver-Sewn',
        '',
        '## Visible Traits',
        '* **Material:** Worn velvet.',
        '* **Glow:** Moonlit seams hum.',
        '',
        '## Hidden Traits',
        'The dog reveals emotional truth.'
      ].join('\n')
    );

    expect(html).toContain('<h1>Item Concept: The Silver-Sewn</h1>');
    expect(html).toContain('<h2>Visible Traits</h2>');
    expect(html).toContain('<strong>Material:</strong> Worn velvet.');
    expect(html).toContain('<li>');
    expect(html).not.toContain('## Visible Traits');
    expect(html).not.toContain('* **Material:**');
  });

  it('escapes raw html in markdown input', () => {
    const html = markdownToRichHtml('<script>alert("x")</script>\n\n**Safe** text');

    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('<strong>Safe</strong> text');
  });

  it('renders markdown line breaks without escaping generated br tags', () => {
    const html = markdownToRichHtml('Overview\nThe item hums.');

    expect(html).toContain('Overview<br />The item hums.');
    expect(html).not.toContain('&lt;br /&gt;');
  });
});

describe('document import structure detection', () => {
  it('detects concept names and section headings from race sheets', () => {
    const source = [
      'Concept: The Sireneans',
      '',
      'Background and Traits:',
      'Origin: The Sireneans could hail from a mystical region.',
      'Appearance: They might resemble humans but possess ethereal qualities.',
      '',
      'Interaction with Other Races:',
      'Humans: Their relationship with humans is fraught with exploitation.',
      'Other Races: Relations with other races vary.',
      '',
      'Role in the Story:',
      'The plight of the Sireneans can be a significant element.'
    ].join('\n');

    expect(detectImportDocumentName(source, 'Race Sheet_ Sireneans.docx')).toBe(
      'The Sireneans'
    );
    expect(detectImportSections(source).map((section) => section.title)).toEqual([
      'Background and Traits',
      'Interaction with Other Races',
      'Role in the Story'
    ]);
  });

  it('does not use collapsed document body text as the import name', () => {
    const source =
      'Concept: The Sireneans Background and Traits: Origin: The Sireneans could hail from a mystical region. Appearance: They might resemble humans.';

    expect(detectImportDocumentName(source, 'Race Sheet_ Sireneans.docx')).toBe(
      'The Sireneans'
    );
  });

  it('detects inline section headings when DOCX text collapses paragraphs', () => {
    const source =
      'Concept: The Sireneans Background and Traits: Origin: The Sireneans could hail from a mystical region. Appearance: They might resemble humans. Cultural Aspects: Their society is complex. Sireneans and Trafficking: The exploitation of Sireneans is a dark aspect. Interaction with Other Races: Humans mistrust them. Role in the Story: Their plight highlights consent.';

    const sections = detectImportSections(source);
    expect(sections.map((section) => section.title)).toEqual([
      'Background and Traits',
      'Sireneans and Trafficking',
      'Interaction with Other Races',
      'Role in the Story'
    ]);
    expect(sections[0]?.content).toContain('Cultural Aspects');
  });

  it('allows short section headings when they are visually separated', () => {
    const source = [
      'Name: Marrow Glass',
      '',
      'Culture:',
      'Trade families keep the old recipes.',
      '',
      'History:',
      'The city remembers the first kiln.'
    ].join('\n');

    expect(detectImportSections(source).map((section) => section.title)).toEqual([
      'Culture',
      'History'
    ]);
  });

  it('keeps only intro text in description when splitting detected sections into fields', () => {
    const source = [
      'Concept: The Sireneans',
      '',
      'Background and Traits:',
      'Origin: The Sireneans could hail from a mystical region.',
      'Cultural Aspects: Their society is complex.',
      '',
      'Interaction with Other Races:',
      'Humans mistrust them.'
    ].join('\n');
    const category: EntityCategory = {
      id: 'races',
      projectId: 'project',
      name: 'Races',
      slug: 'races',
      createdAt: 1,
      fieldSchema: [
        {key: 'description', label: 'Description', type: 'textarea'},
        {key: 'background_and_traits', label: 'Background and Traits', type: 'textarea'},
        {
          key: 'interaction_with_other_races',
          label: 'Interaction with Other Races',
          type: 'textarea'
        }
      ]
    };

    const sections = detectImportSections(source);
    const fields = mapImportedTextToFields(category, source, undefined, sections);

    expect(fields.description).toContain('Concept: The Sireneans');
    expect(fields.description).not.toContain('Interaction with Other Races:');
    expect(fields.background_and_traits).toContain('Cultural Aspects');
    expect(fields.interaction_with_other_races).toContain('Humans mistrust them.');
    expect(fields).not.toHaveProperty('cultural_aspects');
  });

  it('fills existing fields from nested label lines without creating new section fields', () => {
    const source = [
      'Concept: The Sireneans',
      '',
      'Background and Traits:',
      'Origin: The Sireneans could hail from a mystical region.',
      'Cultural Aspects: Their society is complex.',
      '',
      'Role in the Story:',
      'Their plight highlights consent.'
    ].join('\n');
    const category: EntityCategory = {
      id: 'races',
      projectId: 'project',
      name: 'Races',
      slug: 'races',
      createdAt: 1,
      fieldSchema: [
        {key: 'description', label: 'Description', type: 'textarea'},
        {key: 'background_and_traits', label: 'Background and Traits', type: 'textarea'},
        {key: 'cultural_aspects', label: 'Cultural Aspects', type: 'textarea'},
        {key: 'role_in_the_story', label: 'Role in the Story', type: 'textarea'}
      ]
    };

    const sections = detectImportSections(source);
    const fields = mapImportedTextToFields(category, source, undefined, sections);

    expect(sections.map((section) => section.title)).toEqual([
      'Background and Traits',
      'Role in the Story'
    ]);
    expect(fields.cultural_aspects).toContain('Their society is complex.');
    expect(fields.role_in_the_story).toContain('Their plight highlights consent.');
  });
});
