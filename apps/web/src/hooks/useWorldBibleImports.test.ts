import {describe, expect, it} from 'vitest';
import {
  detectImportDocumentName,
  detectImportSections,
  mapImportedTextToFields,
  markdownToRichHtml
} from './useWorldBibleImports';
import type {EntityCategory} from '../entityTypes';

const markExistingFieldSections = (
  sections: ReturnType<typeof detectImportSections>,
  category: EntityCategory
): ReturnType<typeof detectImportSections> =>
  sections.map((section) => {
    const normalizedTitle = section.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const matchesField = category.fieldSchema.some((field) => {
      const normalizedLabel = field.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      return field.key === normalizedTitle || normalizedLabel === normalizedTitle;
    });
    return matchesField ? {...section, action: 'existing-field'} : section;
  });

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

  it('detects character names from shared World Bible imports', () => {
    const source = [
      'Character Name: Camila Garcia deTerra',
      '',
      'Appearance:',
      'Camila carries herself like a practiced courtier.'
    ].join('\n');

    expect(detectImportDocumentName(source, 'Character Sheet_ Unknown.docx')).toBe(
      'Camila Garcia deTerra'
    );
  });

  it('detects character sheet section headings even when followed by label rows', () => {
    const source = [
      'Character Sheet: Camila Garcia deTerra',
      'Basic Information:',
      'Name: Camila Garcia deTerra',
      'Member of the Terra clan',
      'Age: Mid-30s',
      'Occupation: Detective partnered with Leo Muller-Sarkisian',
      'Background: Hybrid with human and Dhemon heritage',
      'Physical Description:',
      'Height: 6 feet 3 inches',
      'Build: Muscular but well-proportioned',
      'Hair: Brunette with green streaks',
      'Complexion: Dusky',
      'Eyes: Brown with rings like a tree',
      'Personality:',
      'General Disposition: Precise, critical, nurturing, and protective.',
      'Skills:',
      'Investigative Skills: Sharp, detail-oriented.',
      'Special Traits:',
      'Magical sight: In low-light conditions, her eyes turn a burning orange.'
    ].join('\n');

    expect(detectImportSections(source).map((section) => section.title)).toEqual([
      'Basic Information',
      'Physical Description',
      'Personality',
      'Skills',
      'Special Traits'
    ]);
  });

  it('maps character sheet sections to existing fields instead of dumping everything into description', () => {
    const source = [
      'Character Sheet: Camila Garcia deTerra',
      'Basic Information:',
      'Name: Camila Garcia deTerra',
      'Member of the Terra clan',
      'Age: Mid-30s',
      'Occupation: Detective partnered with Leo Muller-Sarkisian',
      'Background: Hybrid with human and Dhemon heritage',
      'Physical Description:',
      'Height: 6 feet 3 inches',
      'Build: Muscular but well-proportioned',
      'Personality:',
      'General Disposition: Precise, critical, nurturing, and protective.',
      'Skills:',
      'Investigative Skills: Sharp, detail-oriented.'
    ].join('\n');
    const category: EntityCategory = {
      id: 'characters',
      projectId: 'project',
      name: 'Characters',
      slug: 'characters',
      createdAt: 1,
      fieldSchema: [
        {key: 'description', label: 'Description', type: 'textarea'},
        {key: 'age', label: 'Age', type: 'text'},
        {key: 'occupation', label: 'Occupation', type: 'text'},
        {key: 'background', label: 'Background', type: 'textarea'},
        {key: 'physical_description', label: 'Physical Description', type: 'textarea'},
        {key: 'personality', label: 'Personality', type: 'textarea'},
        {key: 'skills', label: 'Skills', type: 'textarea'}
      ]
    };

    const sections = markExistingFieldSections(detectImportSections(source), category);
    const fields = mapImportedTextToFields(category, source, undefined, sections);

    expect(fields.description).toContain('Character Sheet: Camila Garcia deTerra');
    expect(fields.description).toContain('Basic Information');
    expect(fields.description).toContain('Member of the Terra clan');
    expect(fields.description).not.toContain('Physical Description:');
    expect(fields.age).toBe('Mid-30s');
    expect(fields.occupation).toBe('Detective partnered with Leo Muller-Sarkisian');
    expect(fields.background).toContain('Hybrid with human and Dhemon heritage');
    expect(fields.physical_description).toContain('Height: 6 feet 3 inches');
    expect(fields.personality).toContain('Precise, critical');
    expect(fields.skills).toContain('Sharp, detail-oriented');
  });

  it('classifies specific inline headings as record sections when DOCX text collapses paragraphs', () => {
    const source =
      'Concept: The Sireneans Background and Traits: Origin: The Sireneans could hail from a mystical region. Appearance: They might resemble humans. Cultural Aspects: Their society is complex. Sireneans and Trafficking: The exploitation of Sireneans is a dark aspect. Interaction with Other Races: Humans mistrust them. Role in the Story: Their plight highlights consent.';

    const sections = detectImportSections(source);
    expect(sections.map((section) => section.title)).toEqual([
      'Background and Traits',
      'Sireneans and Trafficking',
      'Interaction with Other Races',
      'Role in the Story'
    ]);
    expect(sections.find((section) => section.title === 'Sireneans and Trafficking')?.action).toBe(
      'record-section'
    );
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

    const sections = markExistingFieldSections(detectImportSections(source), category);
    const fields = mapImportedTextToFields(category, source, undefined, sections);

    expect(fields.description).toContain('Concept: The Sireneans');
    expect(fields.description).not.toContain('Interaction with Other Races:');
    expect(fields.background_and_traits).toContain('Cultural Aspects');
    expect(fields.interaction_with_other_races).toContain('Humans mistrust them.');
    expect(fields).not.toHaveProperty('cultural_aspects');
  });

  it('keeps record-specific detected headings in description instead of creating schema fields', () => {
    const source = [
      'Concept: The Sireneans',
      '',
      'Background and Traits:',
      'Origin: The Sireneans could hail from a mystical region.',
      '',
      'Sireneans and Trafficking:',
      'The exploitation of Sireneans is a dark aspect of their history.'
    ].join('\n');
    const category: EntityCategory = {
      id: 'races',
      projectId: 'project',
      name: 'Races',
      slug: 'races',
      createdAt: 1,
      fieldSchema: [
        {key: 'description', label: 'Description', type: 'textarea'},
        {key: 'background_and_traits', label: 'Background and Traits', type: 'textarea'}
      ]
    };

    const sections = markExistingFieldSections(detectImportSections(source), category);
    const fields = mapImportedTextToFields(category, source, undefined, sections);

    expect(fields.background_and_traits).toContain('mystical region');
    expect(fields.description).toContain('Concept: The Sireneans');
    expect(fields.description).toContain('Sireneans and Trafficking');
    expect(fields.description).toContain('dark aspect of their history');
    expect(fields).not.toHaveProperty('sireneans_and_trafficking');
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

    const sections = markExistingFieldSections(detectImportSections(source), category);
    const fields = mapImportedTextToFields(category, source, undefined, sections);

    expect(sections.map((section) => section.title)).toEqual([
      'Background and Traits',
      'Role in the Story'
    ]);
    expect(fields.cultural_aspects).toContain('Their society is complex.');
    expect(fields.role_in_the_story).toContain('Their plight highlights consent.');
  });
});
