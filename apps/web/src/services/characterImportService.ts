import {parseRtfToText} from '../utils/importText';

export type CharacterImportSectionAction = 'notes' | 'description' | 'ignore' | 'later';

export interface CharacterImportSectionDraft {
  id: string;
  title: string;
  content: string;
  action: CharacterImportSectionAction;
}

export interface CharacterImportDraft {
  sourceKind?: 'import' | 'ai';
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

const readU16LE = (bytes: Uint8Array, offset: number): number =>
  bytes[offset] | (bytes[offset + 1] << 8);

const readU32LE = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0;

const findDocxDocumentEntry = (
  bytes: Uint8Array
): {
  compressionMethod: number;
  compressedData: Uint8Array;
} | null => {
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;
  const minEocdSize = 22;
  const maxCommentLength = 0xffff;
  const searchStart = Math.max(0, bytes.length - (minEocdSize + maxCommentLength));
  let eocdOffset = -1;
  for (let i = bytes.length - minEocdSize; i >= searchStart; i -= 1) {
    if (readU32LE(bytes, i) === eocdSignature) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return null;

  const centralDirectorySize = readU32LE(bytes, eocdOffset + 12);
  const centralDirectoryOffset = readU32LE(bytes, eocdOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > bytes.length) return null;

  const decoder = new TextDecoder('utf-8');
  let cursor = centralDirectoryOffset;

  while (cursor + 46 <= centralDirectoryEnd) {
    if (readU32LE(bytes, cursor) !== centralSignature) {
      break;
    }
    const compressionMethod = readU16LE(bytes, cursor + 10);
    const compressedSize = readU32LE(bytes, cursor + 20);
    const fileNameLength = readU16LE(bytes, cursor + 28);
    const extraLength = readU16LE(bytes, cursor + 30);
    const commentLength = readU16LE(bytes, cursor + 32);
    const localHeaderOffset = readU32LE(bytes, cursor + 42);
    const fileNameStart = cursor + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > bytes.length) return null;

    const fileName = decoder.decode(bytes.slice(fileNameStart, fileNameEnd));
    cursor = fileNameEnd + extraLength + commentLength;

    if (fileName !== 'word/document.xml') continue;
    if (localHeaderOffset + 30 > bytes.length) return null;
    if (readU32LE(bytes, localHeaderOffset) !== localSignature) return null;

    const localNameLength = readU16LE(bytes, localHeaderOffset + 26);
    const localExtraLength = readU16LE(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) return null;

    return {
      compressionMethod,
      compressedData: bytes.slice(dataStart, dataEnd)
    };
  }

  return null;
};

const inflateRaw = async (compressedData: Uint8Array): Promise<Uint8Array> => {
  const copy = new Uint8Array(compressedData.byteLength);
  copy.set(compressedData);
  const stream = new Blob([copy.buffer]).stream().pipeThrough(
    new DecompressionStream('deflate-raw')
  );
  const decompressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(decompressed);
};

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
  const entry = findDocxDocumentEntry(bytes);
  if (!entry) {
    throw new Error('Could not read DOCX structure.');
  }

  let xmlBytes: Uint8Array;
  if (entry.compressionMethod === 0) {
    xmlBytes = entry.compressedData;
  } else if (entry.compressionMethod === 8) {
    xmlBytes = await inflateRaw(entry.compressedData);
  } else {
    throw new Error(`Unsupported DOCX compression method (${entry.compressionMethod}).`);
  }

  const xml = new TextDecoder('utf-8').decode(xmlBytes);
  return docxXmlToText(xml);
};

const htmlToText = (raw: string): string => {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(raw, 'text/html');
  return parsed.body.textContent?.trim() ?? '';
};

const normalizeLine = (line: string) =>
  line
    .replace(/^[\s\u200f\u200e]+/g, '')
    .replace(/^[•*·▪◦]\s*/u, '')
    .replace(/\t+/g, ' ')
    .trim();

const looksLikeSectionHeading = (line: string) => {
  if (!line) return false;
  if (!line.endsWith(':')) return false;
  const candidate = line.slice(0, -1).trim();
  if (!candidate) return false;
  if (candidate.includes('  ')) return false;
  return !candidate.includes(':');
};

const parseLabelValue = (line: string): {label: string; value: string} | null => {
  const match = line.match(/^([^:]{1,80}):\s*(.+)$/);
  if (!match) return null;
  return {
    label: match[1].trim(),
    value: match[2].trim()
  };
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
  'skills and stuff',
  'traits',
  'special traits',
  'flaws',
  'secrets'
]);

const parseInlineSectionStart = (line: string): {title: string; content: string} | null => {
  const pair = parseLabelValue(line);
  if (!pair) return null;
  const normalizedLabel = pair.label.toLowerCase();
  if (!inlineSectionLabels.has(normalizedLabel)) return null;
  return {
    title: pair.label,
    content: pair.value
  };
};

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || crypto.randomUUID();

const compactText = (value: string, limit = 360) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
};

const buildDescriptionCandidate = (
  sections: Array<{title: string; content: string}>,
  fallbackText: string
) => {
  const preferredTitles = ['personality', 'background', 'basic information', 'goals and motivations'];
  const preferredSections = sections.filter((section) =>
    preferredTitles.includes(section.title.toLowerCase())
  );
  const source = preferredSections.map((section) => section.content).join('\n\n') || fallbackText;
  return compactText(source, 420);
};

const findFirstLabeledValue = (labeledValues: Map<string, string>, labels: string[]) => {
  for (const label of labels) {
    const value = labeledValues.get(label);
    if (value?.trim()) {
      return value.trim();
    }
  }
  return '';
};

const findApproximateAge = (sourceText: string) => {
  const exactAgeMatch = sourceText.match(/\b(\d{1,3})\s*(?:years old|year old|yo)\b/i);
  if (exactAgeMatch) {
    return exactAgeMatch[1];
  }

  const decadeQualifierMatch = sourceText.match(/\b(early|mid|late)\s+(\d{2})s\b/i);
  if (decadeQualifierMatch) {
    const [, qualifier, decade] = decadeQualifierMatch;
    return `${qualifier.toLowerCase()} ${decade}s`;
  }

  const decadeMatch = sourceText.match(/\b(\d{2})s\b/);
  if (decadeMatch) {
    return `${decadeMatch[1]}s`;
  }

  return '';
};

export async function readCharacterImportFile(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.docx')) {
    return parseDocxToText(file);
  }
  if (lower.endsWith('.rtf')) {
    return parseRtfToText(await file.text());
  }
  if (
    lower.endsWith('.html') ||
    lower.endsWith('.htm')
  ) {
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
  const warnings: string[] = [];
  const sections: Array<{title: string; contentLines: string[]}> = [];
  const unmatched: string[] = [];
  let currentSection: {title: string; contentLines: string[]} | null = null;

  for (const line of lines) {
    if (!line) {
      if (currentSection) {
        currentSection.contentLines.push('');
      } else {
        unmatched.push('');
      }
      continue;
    }
    if (looksLikeSectionHeading(line)) {
      currentSection = {title: line.slice(0, -1).trim(), contentLines: []};
      sections.push(currentSection);
      continue;
    }
    const inlineSection = parseInlineSectionStart(line);
    if (inlineSection) {
      currentSection = {title: inlineSection.title, contentLines: inlineSection.content ? [inlineSection.content] : []};
      sections.push(currentSection);
      continue;
    }
    if (currentSection) {
      currentSection.contentLines.push(line);
    } else {
      unmatched.push(line);
    }
  }

  const sectionDrafts = sections
    .map((section) => ({
      title: section.title,
      content: section.contentLines.join('\n').trim()
    }))
    .filter((section) => section.content);

  const labeledValues = new Map<string, string>();
  sectionDrafts.forEach((section) => {
    section.content.split('\n').forEach((line) => {
      const pair = parseLabelValue(normalizeLine(line));
      if (pair && !labeledValues.has(pair.label.toLowerCase())) {
        labeledValues.set(pair.label.toLowerCase(), pair.value);
      }
    });
  });
  unmatched.forEach((line) => {
    const pair = parseLabelValue(normalizeLine(line));
    if (pair && !labeledValues.has(pair.label.toLowerCase())) {
      labeledValues.set(pair.label.toLowerCase(), pair.value);
    }
  });

  const detectedName =
    findFirstLabeledValue(labeledValues, ['name', 'character', 'character name']) ||
    normalizeLine(
      unmatched.find((line) => /^(character sheet|character|character name)\s*:/i.test(line))?.split(':').slice(1).join(':') ?? ''
    ) ||
    (sourceFileName?.replace(/\.[^.]+$/, '').replace(/^character sheet[_: -]*/i, '').trim() ?? '') ||
    '';
  const detectedAge =
    findFirstLabeledValue(labeledValues, ['age']) ||
    findApproximateAge(normalizedSource);
  const detectedRole =
    labeledValues.get('occupation') ??
    labeledValues.get('role') ??
    '';

  const unmatchedText = unmatched.join('\n').trim();
  const descriptionCandidate = buildDescriptionCandidate(
    sectionDrafts,
    normalizedSource
  );

  if (sectionDrafts.some((section) => /history|literature/i.test(section.title)) ||
      /leo tolstoy|pope leo|characters in literature/i.test(normalizedSource.toLowerCase())) {
    warnings.push('Some content looks like reference material or brainstorming rather than core character canon.');
  }
  if (!detectedName) {
    warnings.push('No reliable character name was detected. Review before saving.');
  }

  return {
    sourceKind: 'import',
    sourceFileName,
    sourceText: normalizedSource,
    detectedName,
    detectedAge,
    detectedRole,
    detectedDescription: descriptionCandidate,
    sections: sectionDrafts.map((section, index) => ({
      id: `${slugify(section.title)}-${index}`,
      title: section.title,
      content: section.content,
      action:
        /personality|background|special traits|skills|social dynamics|goals/i.test(section.title)
          ? 'notes'
          : /physical description/i.test(section.title)
            ? 'description'
            : /history|literature/i.test(section.title)
              ? 'ignore'
              : 'notes'
    })),
    unmatchedText,
    warnings
  };
}
