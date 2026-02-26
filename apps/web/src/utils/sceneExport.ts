import type {WritingDocument} from '../entityTypes';
import {buildZip} from './zip';

function sanitizeFileNamePart(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'project';
}

function downloadBlob(fileName: string, data: Uint8Array, type: string): void {
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(data);
  const blob = new Blob([bytes], {type});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function decodeHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<!doctype html><body>${html}`, 'text/html');
  return doc.body.textContent ?? '';
}

function htmlToPlainTextWithParagraphs(html: string): string {
  const normalized = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(div|blockquote)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');
  return decodeHtml(normalized).replace(/\r\n/g, '\n').trim();
}

function sceneTextBlocks(scene: WritingDocument): string[] {
  const text = htmlToPlainTextWithParagraphs(scene.content);
  if (!text) {
    return [];
  }
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
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
    const blocks = sceneTextBlocks(scene);
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
  const blocks = sceneTextBlocks(scene);
  if (blocks.length === 0) {
    return `${heading}<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>`;
  }
  const body = blocks
    .map((block) => `<w:p>${textToWordRunXml(block)}</w:p>`)
    .join('');
  return heading + body;
}

export function buildScenesDocx(params: {
  projectName: string;
  scenes: WritingDocument[];
}): Uint8Array {
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

  const coreXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
    'xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:dcmitype="http://purl.org/dc/dcmitype/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${escapeXml(params.projectName)} Scene Export</dc:title>` +
    '<dc:creator>Worldbuilding Desk</dc:creator>' +
    `<cp:lastModifiedBy>Worldbuilding Desk</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>` +
    '</cp:coreProperties>';

  const appXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>Worldbuilding Desk</Application>' +
    '</Properties>';

  return buildZip([
    {fileName: '[Content_Types].xml', fileData: encoder.encode(contentTypesXml)},
    {fileName: '_rels/.rels', fileData: encoder.encode(relsXml)},
    {fileName: 'docProps/core.xml', fileData: encoder.encode(coreXml)},
    {fileName: 'docProps/app.xml', fileData: encoder.encode(appXml)},
    {fileName: 'word/document.xml', fileData: encoder.encode(documentXml)}
  ]);
}

function sanitizeId(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'item';
}

function buildSceneChapterXhtml(scene: WritingDocument, index: number): string {
  const title = scene.title.trim() || `Untitled scene ${index + 1}`;
  const blocks = sceneTextBlocks(scene);
  const body =
    blocks.length === 0
      ? '<p>No content.</p>'
      : blocks
          .map((block) => `<p>${escapeXml(block).replace(/\n/g, '<br />')}</p>`)
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

export function buildScenesEpub(params: {
  projectName: string;
  scenes: WritingDocument[];
}): Uint8Array {
  const encoder = new TextEncoder();
  const bookId = `urn:uuid:${crypto.randomUUID()}`;
  const modifiedIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const escapedProjectName = escapeXml(params.projectName);

  const chapterEntries = params.scenes.map((scene, index) => {
    const sceneBase = sanitizeId(scene.title || `scene-${index + 1}`);
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
    '<dc:creator>Worldbuilding Desk</dc:creator>' +
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

  const stylesheet =
    'body{font-family:serif;line-height:1.5;margin:5%;}' +
    'h1{font-size:1.5em;margin:0 0 1em;}' +
    'p{margin:0 0 1em;white-space:pre-wrap;}';

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
  downloadBlob(fileName, bytes, 'text/markdown;charset=utf-8');
}

export function exportScenesAsDocx(params: {
  projectName: string;
  scenes: WritingDocument[];
}): void {
  const bytes = buildScenesDocx(params);
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `${sanitizeFileNamePart(params.projectName)}-scenes-${stamp}.docx`;
  downloadBlob(
    fileName,
    bytes,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

export function exportScenesAsEpub(params: {
  projectName: string;
  scenes: WritingDocument[];
}): void {
  const bytes = buildScenesEpub(params);
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `${sanitizeFileNamePart(params.projectName)}-scenes-${stamp}.epub`;
  downloadBlob(fileName, bytes, 'application/epub+zip');
}
