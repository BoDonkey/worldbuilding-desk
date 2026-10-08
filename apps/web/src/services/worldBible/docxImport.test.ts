import {describe, expect, it} from 'vitest';
import {docxXmlToImportDocument} from './docxImport';
import {detectImportSections} from './worldBibleImportParsing';

const paragraph = (text: string, style?: string, outlineLevel?: number) =>
  `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${
    outlineLevel === undefined ? '' : `<w:outlineLvl w:val="${outlineLevel}"/>`
  }</w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

const documentXml = (...paragraphs: string[]) =>
  `<w:document><w:body>${paragraphs.join('')}</w:body></w:document>`;

// Pages exports use style ids with spaces and put the outline level on the style.
const pagesStyles = [
  '<w:styles>',
  '<w:style w:type="paragraph" w:styleId="Body"><w:name w:val="Body"/>',
  '<w:pPr><w:outlineLvl w:val="9"/></w:pPr></w:style>',
  '<w:style w:type="paragraph" w:styleId="Heading 2"><w:name w:val="Heading 2"/>',
  '<w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>',
  '<w:style w:type="paragraph" w:styleId="Heading 3"><w:name w:val="Heading 3"/>',
  '<w:pPr><w:outlineLvl w:val="2"/></w:pPr></w:style>',
  '</w:styles>'
].join('');

describe('docxXmlToImportDocument', () => {
  it('keeps Pages-style heading paragraphs as Markdown headings and HTML headings', () => {
    const result = docxXmlToImportDocument(
      documentXml(
        paragraph('Character Sheet: Ansel Varga', 'Heading 3'),
        paragraph('Basic Information:', 'Body'),
        paragraph('Age: Mid-30s', 'Body'),
        paragraph('Ansel&apos;s Academic Background', 'Heading 3'),
        paragraph('Several colleges &amp; programs.', 'Body'),
        paragraph('Academic Appointment', 'Heading 2'),
        paragraph('A visiting chair.', 'Body')
      ),
      pagesStyles
    );

    expect(result.text.split('\n\n')).toEqual([
      '### Character Sheet: Ansel Varga',
      'Basic Information:',
      'Age: Mid-30s',
      "### Ansel's Academic Background",
      'Several colleges & programs.',
      '## Academic Appointment',
      'A visiting chair.'
    ]);
    expect(result.html).toContain('<h3>Character Sheet: Ansel Varga</h3>');
    expect(result.html).toContain('<p>Several colleges &amp; programs.</p>');
    expect(detectImportSections(result.text).map((section) => section.title)).toEqual([
      'Basic Information',
      "Ansel's Academic Background",
      'Academic Appointment'
    ]);
  });

  it('recognizes Word heading style ids without styles.xml and paragraph outline levels', () => {
    const result = docxXmlToImportDocument(
      documentXml(
        paragraph('Title', 'Title'),
        paragraph('Overview', 'Heading1'),
        paragraph('Promoted line', undefined, 1),
        paragraph('Body text')
      )
    );

    expect(result.text.split('\n\n')).toEqual([
      '# Title',
      '# Overview',
      '## Promoted line',
      'Body text'
    ]);
  });

  it('follows basedOn chains and drops deleted tracked-change text', () => {
    const styles = [
      '<w:styles>',
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style>',
      '<w:style w:type="paragraph" w:styleId="SheetHeading"><w:name w:val="Sheet Heading"/>',
      '<w:basedOn w:val="Heading2"/></w:style>',
      '</w:styles>'
    ].join('');
    const result = docxXmlToImportDocument(
      documentXml(
        paragraph('Skills', 'SheetHeading'),
        '<w:p><w:r><w:t>Kept</w:t></w:r><w:del><w:r><w:delText>Removed</w:delText></w:r></w:del></w:p>'
      ),
      styles
    );

    expect(result.text).toBe('## Skills\n\nKept');
  });
});
