// @vitest-environment jsdom
import {beforeEach, describe, expect, it} from 'vitest';
import type {WritingDocument} from '../entityTypes';
import {readZipEntryText} from './unzip';
import {
  buildDocxStylesXml,
  buildEpubStylesheet,
  buildScenesDocx,
  buildScenesEpub,
  buildScenesMarkdown
} from './sceneExport';
import {readExportParagraphStyle, writeExportParagraphStyle} from './exportParagraphStyle';

const scene = (content: string, title = 'Arrival'): WritingDocument =>
  ({id: 'scene-1', projectId: 'p1', title, content, createdAt: 0, updatedAt: 0}) as WritingDocument;

const CONTENT = '<p>One.</p><p>Two.</p><hr><p>Three.</p><p>Four.</p>';

const epubChapter = async (bytes: Uint8Array) =>
  (await readZipEntryText(bytes, 'OEBPS/text/001-arrival.xhtml'))!;

describe('scene export paragraph style (4.98)', () => {
  it('marks the first paragraph and the one after a scene break in EPUB', async () => {
    const xhtml = await epubChapter(buildScenesEpub({projectName: 'Book', scenes: [scene(CONTENT)]}));
    expect(xhtml).toContain(
      '<p class="first">One.</p><p>Two.</p><p class="scene-break">* * *</p><p class="first">Three.</p><p>Four.</p>'
    );
  });

  it('writes an indented or spaced EPUB stylesheet, Indented by default', async () => {
    const css = (bytes: Uint8Array) => readZipEntryText(bytes, 'OEBPS/styles/book.css');
    expect(await css(buildScenesEpub({projectName: 'Book', scenes: [scene(CONTENT)]}))).toBe(
      buildEpubStylesheet('indented')
    );
    expect(await css(buildScenesEpub({projectName: 'Book', scenes: [scene(CONTENT)], paragraphStyle: 'spaced'}))).toBe(
      buildEpubStylesheet('spaced')
    );
    expect(buildEpubStylesheet('indented')).toContain('p{margin:0;text-indent:1.5em;');
    expect(buildEpubStylesheet('spaced')).toContain('p{margin:0 0 1em;text-indent:0;');
    expect(buildEpubStylesheet('spaced')).toContain('p.first{text-indent:0;}');
  });

  it('puts DOCX paragraph layout in a linked styles part', async () => {
    const bytes = buildScenesDocx({projectName: 'Book', scenes: [scene(CONTENT)]});
    const types = await readZipEntryText(bytes, '[Content_Types].xml');
    const rels = await readZipEntryText(bytes, 'word/_rels/document.xml.rels');
    const styles = await readZipEntryText(bytes, 'word/styles.xml');
    const document = (await readZipEntryText(bytes, 'word/document.xml'))!;
    expect(types).toContain('PartName="/word/styles.xml"');
    expect(rels).toContain('Target="styles.xml"');
    expect(styles).toBe(buildDocxStylesXml('indented'));
    expect(document).toContain(
      '<w:p><w:pPr><w:pStyle w:val="FirstParagraph"/></w:pPr><w:r><w:t xml:space="preserve">One.</w:t></w:r></w:p>' +
        '<w:p><w:r><w:t xml:space="preserve">Two.</w:t></w:r></w:p>' +
        '<w:p><w:pPr><w:pStyle w:val="SceneBreak"/></w:pPr><w:r><w:t xml:space="preserve">* * *</w:t></w:r></w:p>' +
        '<w:p><w:pPr><w:pStyle w:val="FirstParagraph"/></w:pPr><w:r><w:t xml:space="preserve">Three.</w:t></w:r></w:p>'
    );
    // No direct indent formatting on paragraphs; it all comes from styles.
    expect(document).not.toContain('w:ind');
  });

  it('indents Normal only in the indented DOCX style', () => {
    const normal = (xml: string) => xml.match(/w:styleId="Normal">.*?<\/w:style>/)![0];
    expect(normal(buildDocxStylesXml('indented'))).toContain('<w:ind w:firstLine="360"/>');
    expect(normal(buildDocxStylesXml('indented'))).toContain('w:after="0"');
    expect(normal(buildDocxStylesXml('spaced'))).toContain('<w:ind w:firstLine="0"/>');
    expect(normal(buildDocxStylesXml('spaced'))).toContain('w:after="240"');
  });

  it('leaves Markdown export unchanged, with no scene-break marker', () => {
    const markdown = buildScenesMarkdown({projectName: 'Book', scenes: [scene(CONTENT)]});
    expect(markdown).toContain('One.\n\nTwo.\n\nThree.\n\nFour.\n');
    expect(markdown).not.toContain('scene-break');
    expect(markdown).not.toContain('* * *');
  });

  it('treats a scene with only a scene break as empty', async () => {
    const xhtml = await epubChapter(buildScenesEpub({projectName: 'Book', scenes: [scene('<hr>')]}));
    expect(xhtml).toContain('<p class="first">No content.</p>');
  });
});

describe('export paragraph style preference', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to Indented and is remembered per project', () => {
    expect(readExportParagraphStyle('p1')).toBe('indented');
    expect(readExportParagraphStyle(null)).toBe('indented');
    writeExportParagraphStyle('p1', 'spaced');
    expect(readExportParagraphStyle('p1')).toBe('spaced');
    expect(readExportParagraphStyle('p2')).toBe('indented');
  });

  it('ignores unknown stored values', () => {
    localStorage.setItem('exportParagraphStyle:p1', 'double');
    expect(readExportParagraphStyle('p1')).toBe('indented');
  });
});
