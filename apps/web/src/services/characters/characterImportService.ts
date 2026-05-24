import {parseRtfToText} from '../../utils/importText';

export type CharacterImportSectionAction = 'description' | 'notes' | 'ignore';

export interface CharacterImportSectionDraft {
  id: string;
  title: string;
  content: string;
  action: CharacterImportSectionAction;
}

export interface CharacterImportDraft {
  sourceFileName?: string;
  sourceText: string;
  detectedName: string;
  detectedAge: string;
  detectedRole: string;
  detectedDescription: string;
  sections: CharacterImportSectionDraft[];
  unmatchedText: string;
  warnings: string[];
}

const normalizeLine = (line: string): string =>
  line
    .replace(/^[\s\u200f\u200e]+/g, '')
    .replace(/^[•*·▪◦]\s*/u, '')
    .replace(/\t+/g, ' ')
    .trim();

const parseLabelValue = (line: string): {label: string; value: string} | null => {
  const match = line.match(/^([^:]{1,80}):\s*(.+)$/);
  if (!match) return null;
  return {label: match[1].trim(), value: match[2].trim()};
};

const looksLikeSectionHeading = (line: string): boolean => {
  if (!line.endsWith(':')) return false;
  const candidate = line.slice(0, -1).trim();
  return Boolean(candidate) && !candidate.includes(':') && !candidate.includes('  ');
};

const inlineSectionLabels = new Set([
  'appearance',
  'background',
  'personality',
  'goals',
  'motivations',
  'relationships',
  'voice',
  'skills',
  'traits',
  'flaws',
  'secrets',
  'notes'
]);

const slugify = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
  crypto.randomUUID();

const compactText = (value: string, limit = 420): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
};

const htmlToText = (raw: string): string => {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(raw, 'text/html');
  return parsed.body.textContent?.trim() ?? '';
};

const readU16LE = (bytes: Uint8Array, offset: number): number =>
  bytes[offset] | (bytes[offset + 1] << 8);

const readU32LE = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0;

const docxXmlToText = (xml: string): string => {
  const withBreaks = xml
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<w:cr\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n\n');
  const withoutTags = withBreaks.replace(/<[^>]+>/g, '');
  const parser = new DOMParser();
  const decoded = parser.parseFromString(
    `<!doctype html><body>${withoutTags}`,
    'text/html'
  ).body.textContent;
  return decoded?.trim() ?? '';
};

const parseDocxToText = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;
  const minEocdSize = 22;
  const searchStart = Math.max(0, bytes.length - (minEocdSize + 0xffff));
  let eocdOffset = -1;

  for (let i = bytes.length - minEocdSize; i >= searchStart; i -= 1) {
    if (readU32LE(bytes, i) === eocdSignature) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('Could not read DOCX structure.');

  const centralDirectorySize = readU32LE(bytes, eocdOffset + 12);
  const centralDirectoryOffset = readU32LE(bytes, eocdOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  const decoder = new TextDecoder('utf-8');
  let cursor = centralDirectoryOffset;

  while (cursor + 46 <= centralDirectoryEnd) {
    if (readU32LE(bytes, cursor) !== centralSignature) break;
    const compressionMethod = readU16LE(bytes, cursor + 10);
    const compressedSize = readU32LE(bytes, cursor + 20);
    const fileNameLength = readU16LE(bytes, cursor + 28);
    const extraLength = readU16LE(bytes, cursor + 30);
    const commentLength = readU16LE(bytes, cursor + 32);
    const localHeaderOffset = readU32LE(bytes, cursor + 42);
    const fileNameStart = cursor + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const fileName = decoder.decode(bytes.slice(fileNameStart, fileNameEnd));
    cursor = fileNameEnd + extraLength + commentLength;

    if (fileName !== 'word/document.xml') continue;
    if (readU32LE(bytes, localHeaderOffset) !== localSignature) {
      throw new Error('Could not read DOCX document content.');
    }

    const localNameLength = readU16LE(bytes, localHeaderOffset + 26);
    const localExtraLength = readU16LE(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedData = bytes.slice(dataStart, dataStart + compressedSize);
    let xmlBytes: Uint8Array;
    if (compressionMethod === 0) {
      xmlBytes = compressedData;
    } else if (compressionMethod === 8) {
      const copy = new Uint8Array(compressedData.byteLength);
      copy.set(compressedData);
      const stream = new Blob([copy.buffer]).stream().pipeThrough(
        new DecompressionStream('deflate-raw')
      );
      xmlBytes = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      throw new Error(`Unsupported DOCX compression method (${compressionMethod}).`);
    }
    return docxXmlToText(decoder.decode(xmlBytes));
  }

  throw new Error('Could not find DOCX document content.');
};

export async function readCharacterImportFile(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.docx')) return parseDocxToText(file);
  if (lower.endsWith('.rtf')) return parseRtfToText(await file.text());
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    return htmlToText(await file.text());
  }
  return file.text();
}

export function parseCharacterImportText(
  sourceText: string,
  sourceFileName?: string
): CharacterImportDraft {
  const normalizedSource = sourceText.replace(/\r/g, '').trim();
  const lines = normalizedSource.split('\n').map(normalizeLine);
  const sections: Array<{title: string; contentLines: string[]}> = [];
  const unmatched: string[] = [];
  let currentSection: {title: string; contentLines: string[]} | null = null;

  for (const line of lines) {
    if (!line) {
      if (currentSection) currentSection.contentLines.push('');
      else unmatched.push('');
      continue;
    }

    if (looksLikeSectionHeading(line)) {
      currentSection = {title: line.slice(0, -1).trim(), contentLines: []};
      sections.push(currentSection);
      continue;
    }

    const pair = parseLabelValue(line);
    if (pair && inlineSectionLabels.has(pair.label.toLowerCase())) {
      currentSection = {title: pair.label, contentLines: [pair.value]};
      sections.push(currentSection);
      continue;
    }

    if (currentSection) currentSection.contentLines.push(line);
    else unmatched.push(line);
  }

  const sectionDrafts = sections
    .map((section) => ({
      title: section.title,
      content: section.contentLines.join('\n').trim()
    }))
    .filter((section) => section.content);
  const labeledValues = new Map<string, string>();

  [...unmatched, ...sectionDrafts.flatMap((section) => section.content.split('\n'))].forEach(
    (line) => {
      const pair = parseLabelValue(normalizeLine(line));
      if (pair && !labeledValues.has(pair.label.toLowerCase())) {
        labeledValues.set(pair.label.toLowerCase(), pair.value);
      }
    }
  );

  const detectedName =
    labeledValues.get('name') ??
    labeledValues.get('character') ??
    labeledValues.get('character name') ??
    sourceFileName?.replace(/\.[^.]+$/, '').replace(/^character sheet[_: -]*/i, '').trim() ??
    '';
  const detectedAge =
    labeledValues.get('age') ??
    normalizedSource.match(/\b(\d{1,3})\s*(?:years old|year old|yo)\b/i)?.[1] ??
    '';
  const detectedRole =
    labeledValues.get('role') ?? labeledValues.get('occupation') ?? '';
  const preferredDescription = sectionDrafts.find((section) =>
    /personality|background|appearance|description/i.test(section.title)
  )?.content;
  const unmatchedText = unmatched.join('\n').trim();
  const warnings: string[] = [];

  if (!detectedName.trim()) {
    warnings.push('No reliable character name was detected. Review before saving.');
  }

  return {
    sourceFileName,
    sourceText: normalizedSource,
    detectedName,
    detectedAge,
    detectedRole,
    detectedDescription: compactText(preferredDescription || unmatchedText || normalizedSource),
    sections: sectionDrafts.map((section, index) => ({
      id: `${slugify(section.title)}-${index}`,
      title: section.title,
      content: section.content,
      action: /appearance|description/i.test(section.title) ? 'description' : 'notes'
    })),
    unmatchedText,
    warnings
  };
}
