import {htmlTextContent} from './textHelpers';
import {readZipEntry} from './unzip';

export const fileNameToTitle = (name: string): string => {
  const base = name.replace(/\.[^.]+$/, '').trim();
  return base || 'Imported scene';
};

const plainTextToHtml = (text: string): string => {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    return '<p></p>';
  }
  return paragraphs.map((chunk) => `<p>${chunk.replace(/\n/g, '<br />')}</p>`).join('');
};

export const fileToHtml = (fileName: string, rawContent: string): string => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    return rawContent.trim() || '<p></p>';
  }
  return plainTextToHtml(rawContent);
};

const htmlLikeToPlainText = (raw: string): string =>
  htmlTextContent(raw).replace(/\s+\n/g, '\n').trim();

export const parsePagesToText = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const preferredEntries = [
    'quicklook/preview.txt',
    'quicklook/preview.html',
    'quicklook/preview.htm',
    'index.xml'
  ];

  const entry = await readZipEntry(
    bytes,
    (fileName) => preferredEntries.includes(fileName.toLowerCase()),
    '.pages entry'
  );
  if (!entry) {
    throw new Error('No readable text preview found in .pages package.');
  }

  const raw = new TextDecoder('utf-8').decode(entry.data).trim();
  if (!raw) {
    throw new Error('Empty text payload in .pages package.');
  }

  const lowerName = entry.fileName.toLowerCase();
  if (lowerName.endsWith('.txt')) {
    return raw;
  }

  const normalized = htmlLikeToPlainText(raw);
  if (!normalized) {
    throw new Error('Unable to extract readable text from .pages payload.');
  }
  return normalized;
};
