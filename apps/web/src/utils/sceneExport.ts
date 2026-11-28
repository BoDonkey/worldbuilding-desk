import type {WritingDocument} from '../entityTypes';
import {htmlTextContent} from './textHelpers';
import {buildZip} from './zip';
import {sanitizeFileNamePart, triggerBytesDownload} from './downloadJson';
import {DEFAULT_EXPORT_PARAGRAPH_STYLE, type ExportParagraphStyle} from './exportParagraphStyle';

/** A scene break (the editor's horizontal rule) inside the scene text blocks. */
const SCENE_BREAK = '\uE000scene-break\uE000';
/** How a scene break reads in EPUB and DOCX exports. */
const SCENE_BREAK_TEXT = '* * *';

function htmlToPlainTextWithParagraphs(html: string): string {
  const normalized = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\b[^>]*>/gi, `\n\n${SCENE_BREAK}\n\n`)
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(div|blockquote)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');
  return htmlTextContent(normalized).replace(/\r\n/g, '\n').trim();
}

/** Paragraph text blocks; scene breaks are SCENE_BREAK blocks. */
function sceneTextBlocks(scene: WritingDocument): string[] {
  const text = htmlToPlainTextWithParagraphs(scene.content);
  if (!text) {
    return [];
  }
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  // A scene that only has scene breaks has no content.
  return blocks.some((block) => block !== SCENE_BREAK) ? blocks : [];
}

type ExportBlockKind = 'first' | 'body' | 'scene-break';

/**
 * Each block with its layout role: the first paragraph of a scene and the one
 * after a scene break take no first-line indent (4.98).
 */
function exportBlocks(scene: WritingDocument): Array<{kind: ExportBlockKind; text: string}> {
  let afterBreak = true;
  return sceneTextBlocks(scene).map((block) => {
    if (block === SCENE_BREAK) {
      afterBreak = true;
      return {kind: 'scene-break', text: SCENE_BREAK_TEXT};
    }
    const kind: ExportBlockKind = afterBreak ? 'first' : 'body';
    afterBreak = false;
    return {kind, text: block};
  });
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}[\]()#+!|>~-])/g, '\\$1');
}

function toMarkdownText(value: string): string {
  return value
    .split('\n')
    .map((line) => line.trimEnd())
    .join('  \n');
}

export function buildScenesMarkdown(params: {
  projectName: string;
  scenes: WritingDocument[];
}): string {
  const lines: string[] = [];
  lines.push(`# ${params.projectName} - Scene Export`);
  lines.push('');
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  params.scenes.forEach((scene, index) => {
    const title = scene.title.trim() || `Untitled scene ${index + 1}`;
    lines.push(`## ${index + 1}. ${escapeMarkdown(title)}`);
    lines.push('');
    const blocks = sceneTextBlocks(scene).filter((block) => block !== SCENE_BREAK);
    if (blocks.length === 0) {
      lines.push('_No content_');
      lines.push('');
      return;
    }
    blocks.forEach((block) => {
      lines.push(toMarkdownText(block));
      lines.push('');
    });
  });

  return lines.join('\n').trimEnd() + '\n';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function textToWordRunXml(value: string): string {
  const segments = value.split('\n');
  return segments
    .map((segment, index) => {
      const escaped = escapeXml(segment);
      const run = `<w:r><w:t xml:space="preserve">${escaped || ' '}</w:t></w:r>`;
      if (index === 0) {
        return run;
      }
      return `<w:r><w:br/></w:r>${run}`;
    })
    .join('');
}

function sceneParagraphXml(scene: WritingDocument, index: number): string {
  const title = scene.title.trim() || `Untitled scene ${index + 1}`;
  const heading = `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${textToWordRunXml(
    `${index + 1}. ${title}`
  )}</w:p>`;
  const blocks = exportBlocks(scene);
  if (blocks.length === 0) {
    return `${heading}<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>`;
  }
  const body = blocks
    .map((block) => `<w:p>${DOCX_PARAGRAPH_PROPERTIES[block.kind]}${textToWordRunXml(block.text)}</w:p>`)
    .join('');
  return heading + body;
}

/** Body paragraphs use Normal; the others name their own style. */
const DOCX_PARAGRAPH_PROPERTIES: Record<ExportBlockKind, string> = {
  first: '<w:pPr><w:pStyle w:val="FirstParagraph"/></w:pPr>',
  body: '',
  'scene-break': '<w:pPr><w:pStyle w:val="SceneBreak"/></w:pPr>'
};

/** 1.5em at 12pt, matching the editor's indent; twentieths of a point. */
const DOCX_FIRST_LINE_INDENT = 360;

/**
 * The styles part. Paragraph layout lives in styles, not on each paragraph, so
 * a publisher or typesetter can restyle the whole file at once.
 */
export function buildDocxStylesXml(paragraphStyle: ExportParagraphStyle): string {
  const indented = paragraphStyle === 'indented';
  const normalParagraph = indented
    ? `<w:spacing w:after="0" w:line="276" w:lineRule="auto"/><w:ind w:firstLine="${DOCX_FIRST_LINE_INDENT}"/>`
    : '<w:spacing w:after="240" w:line="276" w:lineRule="auto"/><w:ind w:firstLine="0"/>';
  const noIndent = '<w:ind w:firstLine="0"/>';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults>' +
    '<w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>' +
    '<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
    '</w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/>' +
    `<w:pPr>${normalParagraph}</w:pPr></w:style>` +
    '<w:style w:type="paragraph" w:styleId="FirstParagraph"><w:name w:val="First Paragraph"/>' +
    `<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr>${noIndent}</w:pPr></w:style>` +
    '<w:style w:type="paragraph" w:styleId="SceneBreak"><w:name w:val="Scene Break"/>' +
    '<w:basedOn w:val="Normal"/><w:next w:val="FirstParagraph"/><w:qFormat/>' +
    `<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="240"/>${noIndent}<w:jc w:val="center"/></w:pPr></w:style>` +
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/>' +
    '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
    `<w:pPr><w:spacing w:after="480"/>${noIndent}<w:jc w:val="center"/></w:pPr>` +
    '<w:rPr><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>' +
    '<w:basedOn w:val="Normal"/><w:next w:val="FirstParagraph"/><w:qFormat/>' +
    `<w:pPr><w:keepNext/><w:spacing w:before="480" w:after="240"/>${noIndent}<w:outlineLvl w:val="0"/></w:pPr>` +
    '<w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>' +
    '</w:styles>'
  );
}

interface SceneExportParams {
  projectName: string;
  scenes: WritingDocument[];
  /** EPUB and DOCX only; Indented when not given. */
  paragraphStyle?: ExportParagraphStyle;
}

export function buildScenesDocx(params: SceneExportParams): Uint8Array {
  const encoder = new TextEncoder();
  const bodyXml = params.scenes
    .map((scene, index) => sceneParagraphXml(scene, index))
    .join('');
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" ' +
    'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
    'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ' +
    'xmlns:v="urn:schemas-microsoft-com:vml" ' +
    'xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:w10="urn:schemas-microsoft-com:office:word" ' +
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" ' +
    'xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" ' +
    'xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex" ' +
    'xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid" ' +
    'xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml" ' +
    'xmlns:w16du="http://schemas.microsoft.com/office/word/2023/wordml/word16du" ' +
    'xmlns:w16sdtdh="http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash" ' +
    'xmlns:w16sdtfl="http://schemas.microsoft.com/office/word/2024/wordml/sdtformatlock" ' +
    'xmlns:w16se="http://schemas.microsoft.com/office/word/2015/wordml/symex" ' +
    'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" ' +
    'xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" ' +
    'xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" ' +
    'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" ' +
    'mc:Ignorable="w14 w15 w16se w16cid w16 w16cex w16sdtdh w16sdtfl w16du wp14">' +
    '<w:body>' +
    `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr>${textToWordRunXml(
      params.projectName
    )}</w:p>` +
    bodyXml +
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
    '</w:body></w:document>';

  const contentTypesXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>';

  const relsXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
    '</Relationships>';

  const documentRelsXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';
  const stylesXml = buildDocxStylesXml(params.paragraphStyle ?? DEFAULT_EXPORT_PARAGRAPH_STYLE);

  const coreXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
    'xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:dcmitype="http://purl.org/dc/dcmitype/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${escapeXml(params.projectName)} Scene Export</dc:title>` +
    '<dc:creator>SagaSpine</dc:creator>' +
    `<cp:lastModifiedBy>SagaSpine</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>` +
    '</cp:coreProperties>';

  const appXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>SagaSpine</Application>' +
    '</Properties>';

  return buildZip([
    {fileName: '[Content_Types].xml', fileData: encoder.encode(contentTypesXml)},
    {fileName: '_rels/.rels', fileData: encoder.encode(relsXml)},
    {fileName: 'docProps/core.xml', fileData: encoder.encode(coreXml)},
    {fileName: 'docProps/app.xml', fileData: encoder.encode(appXml)},
    {fileName: 'word/document.xml', fileData: encoder.encode(documentXml)},
    {fileName: 'word/_rels/document.xml.rels', fileData: encoder.encode(documentRelsXml)},
    {fileName: 'word/styles.xml', fileData: encoder.encode(stylesXml)}
  ]);
}

function buildSceneChapterXhtml(scene: WritingDocument, index: number): string {
  const title = scene.title.trim() || `Untitled scene ${index + 1}`;
  const blocks = exportBlocks(scene);
  const body =
    blocks.length === 0
      ? '<p class="first">No content.</p>'
      : blocks
          .map((block) => {
            const className = block.kind === 'body' ? '' : ` class="${block.kind}"`;
            return `<p${className}>${escapeXml(block.text).replace(/\n/g, '<br />')}</p>`;
          })
          .join('');
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<html xmlns="http://www.w3.org/1999/xhtml" lang="en">' +
    '<head>' +
    `<title>${escapeXml(title)}</title>` +
    '<meta charset="utf-8"/>' +
    '<link rel="stylesheet" type="text/css" href="../styles/book.css"/>' +
    '</head>' +
    `<body><h1>${escapeXml(`${index + 1}. ${title}`)}</h1>${body}</body>` +
    '</html>'
  );
}

/** The EPUB stylesheet; `p.first` and `p.scene-break` never take the indent. */
export function buildEpubStylesheet(paragraphStyle: ExportParagraphStyle): string {
  const paragraph =
    paragraphStyle === 'indented'
      ? 'p{margin:0;text-indent:1.5em;white-space:pre-wrap;}'
      : 'p{margin:0 0 1em;text-indent:0;white-space:pre-wrap;}';
  return (
    'body{font-family:serif;line-height:1.5;margin:5%;}' +
    'h1{font-size:1.5em;margin:0 0 1em;}' +
    paragraph +
    'p.first{text-indent:0;}' +
    'p.scene-break{text-indent:0;text-align:center;margin:1em 0;}'
  );
}

export function buildScenesEpub(params: SceneExportParams): Uint8Array {
  const encoder = new TextEncoder();
  const bookId = `urn:uuid:${crypto.randomUUID()}`;
  const modifiedIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const escapedProjectName = escapeXml(params.projectName);

  const chapterEntries = params.scenes.map((scene, index) => {
    const sceneBase = sanitizeFileNamePart(scene.title || `scene-${index + 1}`, 'item');
    const chapterFile = `text/${String(index + 1).padStart(3, '0')}-${sceneBase}.xhtml`;
    const chapterId = `chapter-${index + 1}`;
    const navLabel = scene.title.trim() || `Untitled scene ${index + 1}`;
    return {
      chapterFile,
      chapterId,
      navLabel,
      chapterXml: buildSceneChapterXhtml(scene, index)
    };
  });

  const manifestItems = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="style" href="styles/book.css" media-type="text/css"/>',
    ...chapterEntries.map(
      (chapter) =>
        `<item id="${chapter.chapterId}" href="${chapter.chapterFile}" media-type="application/xhtml+xml"/>`
    )
  ].join('');

  const spineItems = chapterEntries
    .map((chapter) => `<itemref idref="${chapter.chapterId}"/>`)
    .join('');

  const navPoints = chapterEntries
    .map(
      (chapter, index) =>
        `<li><a href="${chapter.chapterFile}">${escapeXml(
          `${index + 1}. ${chapter.navLabel}`
        )}</a></li>`
    )
    .join('');

  const packageOpf =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">' +
    '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    `<dc:identifier id="bookid">${escapeXml(bookId)}</dc:identifier>` +
    `<dc:title>${escapedProjectName} Scene Export</dc:title>` +
    '<dc:creator>SagaSpine</dc:creator>' +
    '<dc:language>en</dc:language>' +
    `<meta property="dcterms:modified">${modifiedIso}</meta>` +
    '</metadata>' +
    `<manifest>${manifestItems}</manifest>` +
    `<spine>${spineItems}</spine>` +
    '</package>';

  const navXhtml =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">' +
    '<head><meta charset="utf-8"/>' +
    `<title>${escapedProjectName} Table of Contents</title>` +
    '<link rel="stylesheet" type="text/css" href="styles/book.css"/>' +
    '</head>' +
    '<body>' +
    '<nav epub:type="toc" id="toc">' +
    '<h1>Table of Contents</h1>' +
    `<ol>${navPoints}</ol>` +
    '</nav>' +
    '</body>' +
    '</html>';

  const containerXml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
    '<rootfiles>' +
    '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>' +
    '</rootfiles>' +
    '</container>';

  const stylesheet = buildEpubStylesheet(params.paragraphStyle ?? DEFAULT_EXPORT_PARAGRAPH_STYLE);

  return buildZip([
    {fileName: 'mimetype', fileData: encoder.encode('application/epub+zip')},
    {fileName: 'META-INF/container.xml', fileData: encoder.encode(containerXml)},
    {fileName: 'OEBPS/content.opf', fileData: encoder.encode(packageOpf)},
    {fileName: 'OEBPS/nav.xhtml', fileData: encoder.encode(navXhtml)},
    {fileName: 'OEBPS/styles/book.css', fileData: encoder.encode(stylesheet)},
    ...chapterEntries.map((chapter) => ({
      fileName: `OEBPS/${chapter.chapterFile}`,
      fileData: encoder.encode(chapter.chapterXml)
    }))
  ]);
}

export function exportScenesAsMarkdown(params: {
  projectName: string;
  scenes: WritingDocument[];
}): void {
  const markdown = buildScenesMarkdown(params);
  const bytes = new TextEncoder().encode(markdown);
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `${sanitizeFileNamePart(params.projectName)}-scenes-${stamp}.md`;
  triggerBytesDownload(fileName, bytes, 'text/markdown;charset=utf-8');
}

export function exportScenesAsDocx(params: SceneExportParams): void {
  const bytes = buildScenesDocx(params);
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `${sanitizeFileNamePart(params.projectName)}-scenes-${stamp}.docx`;
  triggerBytesDownload(
    fileName,
    bytes,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

export function exportScenesAsEpub(params: SceneExportParams): void {
  const bytes = buildScenesEpub(params);
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `${sanitizeFileNamePart(params.projectName)}-scenes-${stamp}.epub`;
  triggerBytesDownload(fileName, bytes, 'application/epub+zip');
}
