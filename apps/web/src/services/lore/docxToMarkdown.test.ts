import {describe, expect, it} from 'vitest';
import {docxXmlToMarkdown} from './docxToMarkdown';

const run = (text: string, properties = '') =>
  `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;

const paragraph = (content: string, properties = '') =>
  `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}${content}</w:p>`;

const listItem = (text: string, numId: string, ilvl = '0') =>
  paragraph(run(text), `<w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr>`);

const cell = (content: string, properties = '') =>
  `<w:tc>${properties ? `<w:tcPr>${properties}</w:tcPr>` : ''}${content}</w:tc>`;

const row = (...cells: string[]) => `<w:tr>${cells.join('')}</w:tr>`;
const table = (...rows: string[]) => `<w:tbl><w:tblPr/>${rows.join('')}</w:tbl>`;

const documentXml = (...blocks: string[]) =>
  `<w:document><w:body>${blocks.join('')}<w:sectPr/></w:body></w:document>`;

const numberingXml = [
  '<w:numbering>',
  '<w:abstractNum w:abstractNumId="10"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl>',
  '<w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>',
  '<w:abstractNum w:abstractNumId="20"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>',
  '<w:num w:numId="1"><w:abstractNumId w:val="10"/></w:num>',
  '<w:num w:numId="2"><w:abstractNumId w:val="20"/></w:num>',
  '</w:numbering>'
].join('');

describe('docxXmlToMarkdown', () => {
  it('keeps headings, emphasis, and paragraphs', () => {
    const markdown = docxXmlToMarkdown(
      documentXml(
        paragraph(run('Camila Garcia deTerra'), '<w:pStyle w:val="Heading1"/>'),
        paragraph(run('Age:', '<w:b/>') + run(' Mid-30s')),
        paragraph(run('She ') + run('never', '<w:i/>') + run(' forgets &amp; rarely ') + run('forgives', '<w:b/><w:i/>') + run('.')),
        paragraph(run('Not bold', '<w:b w:val="0"/>')),
        paragraph('')
      )
    );

    expect(markdown).toBe(
      [
        '# Camila Garcia deTerra',
        '**Age:** Mid-30s',
        'She *never* forgets & rarely ***forgives***.',
        'Not bold'
      ].join('\n\n')
    );
  });

  it('writes bullet and numbered lists from numbering.xml, including nesting', () => {
    const markdown = docxXmlToMarkdown(
      documentXml(
        paragraph(run('Traits')),
        listItem('Stubborn', '1'),
        listItem('About her temper', '1', '1'),
        listItem('Loyal', '1'),
        listItem('Arrive', '2'),
        listItem('Depart', '2'),
        paragraph(run('After'))
      ),
      '',
      numberingXml
    );

    expect(markdown).toBe(
      [
        'Traits',
        '- Stubborn\n  - About her temper\n- Loyal\n1. Arrive\n1. Depart',
        'After'
      ].join('\n\n')
    );
  });

  it('treats list numbering without numbering.xml as bullets and numId 0 as no list', () => {
    const markdown = docxXmlToMarkdown(
      documentXml(listItem('Item', '7'), listItem('Not a list', '0'))
    );

    expect(markdown).toBe('- Item\n\nNot a list');
  });

  it('writes tables as pipe tables with merged cells, escaped pipes, and multi-paragraph cells', () => {
    const markdown = docxXmlToMarkdown(
      documentXml(
        paragraph(run('Before')),
        table(
          row(cell(paragraph(run('Trait'))), cell(paragraph(run('Value'))), cell(paragraph(run('Notes')))),
          row(
            cell(paragraph(run('Height'))),
            cell(paragraph(run('5\'8" | tall', '<w:b/>'))),
            cell(paragraph(run('Measured')) + paragraph(run('twice')), '<w:vMerge w:val="restart"/>')
          ),
          row(
            cell(paragraph(run('Spanning both')), '<w:gridSpan w:val="2"/>'),
            cell(paragraph(''), '<w:vMerge/>')
          )
        ),
        paragraph(run('After'))
      )
    );

    expect(markdown).toBe(
      [
        'Before',
        [
          '| Trait | Value | Notes |',
          '| --- | --- | --- |',
          '| Height | **5\'8" \\| tall** | Measured<br>twice |',
          '| Spanning both |   |   |'
        ].join('\n'),
        'After'
      ].join('\n\n')
    );
  });

  it('reads paragraphs inside content controls and skips deleted text and drawings', () => {
    const markdown = docxXmlToMarkdown(
      documentXml(
        '<w:sdt><w:sdtPr/><w:sdtContent>' + paragraph(run('Inside control')) + '</w:sdtContent></w:sdt>',
        paragraph(
          run('Kept') +
            '<w:del><w:r><w:delText>gone</w:delText></w:r></w:del>' +
            '<w:r><w:drawing><w:txbxContent><w:p><w:r><w:t>box</w:t></w:r></w:p></w:txbxContent></w:drawing></w:r>'
        )
      )
    );

    expect(markdown).toBe('Inside control\n\nKept');
  });
});
