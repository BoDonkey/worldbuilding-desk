import type {LoreDocumentFormat} from '../../entityTypes';
import {parseDocxFileToMarkdown} from './docxToMarkdown';

export interface ParsedLoreImport {
  title: string;
  content: string;
  format: LoreDocumentFormat;
  fileName: string;
  mimeType?: string;
}

export const isMarkdownFileName = (fileName: string): boolean =>
  /\.(md|markdown)$/i.test(fileName);

const fileNameToTitle = (name: string): string => {
  const base = name.replace(/\.[^.]+$/, '').trim();
  return base || 'Imported lore document';
};

export async function parseLoreImport(file: File): Promise<ParsedLoreImport> {
  const lowerName = file.name.toLowerCase();
  const isDocx = lowerName.endsWith('.docx');
  const content = isDocx ? await parseDocxFileToMarkdown(file) : await file.text();
  const format: LoreDocumentFormat =
    isDocx || isMarkdownFileName(lowerName) ? 'markdown' : 'plain_text';

  const normalized = content.trim();
  if (!normalized) {
    throw new Error('Imported file was empty.');
  }

  return {
    title: fileNameToTitle(file.name),
    content: normalized,
    format,
    fileName: file.name,
    mimeType: file.type || undefined
  };
}
