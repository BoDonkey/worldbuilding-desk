import type {StatBlockSourceType, StatBlockStyle} from '../entityTypes';

export interface ParsedStatBlockToken {
  sourceType: StatBlockSourceType;
  sourceRef: string;
  style: StatBlockStyle;
}

export interface CharacterStatEntry {
  name: string;
  baseValue: number;
  effectiveValue: number;
  modifierNotes?: string;
}

export interface CharacterResourceEntry {
  name: string;
  current: number;
  max: number;
  effectiveCurrent: number;
  effectiveMax: number;
}

export interface CharacterStatBlockInput {
  name: string;
  level: number;
  effectiveLevel: number;
  experience: number;
  stats: CharacterStatEntry[];
  resources: CharacterResourceEntry[];
  activeNotes: string[];
}

export interface ItemStatBlockInput {
  name: string;
  fields: Array<{key: string; value: string}>;
}

const TOKEN_REGEX = /\{\{STAT_BLOCK:(character|item):([^}]+):(full|buffs|compact)\}\}/g;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function toHtmlParagraphs(lines: string[]): string {
  const chunks: string[] = [];
  let current: string[] = [];

  lines.forEach((line) => {
    if (!line.trim()) {
      if (current.length > 0) {
        chunks.push(`<p>${current.map(escapeHtml).join('<br />')}</p>`);
        current = [];
      }
      return;
    }
    current.push(line);
  });

  if (current.length > 0) {
    chunks.push(`<p>${current.map(escapeHtml).join('<br />')}</p>`);
  }

  return chunks.join('');
}

export function formatEntityFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim())
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value).trim();
}

export function createStatBlockToken(params: ParsedStatBlockToken): string {
  return `{{STAT_BLOCK:${params.sourceType}:${params.sourceRef}:${params.style}}}`;
}

export function parseStatBlockToken(token: string): ParsedStatBlockToken | null {
  const match = token.trim().match(
    /^\{\{STAT_BLOCK:(character|item):([^}]+):(full|buffs|compact)\}\}$/
  );
  if (!match) return null;
  return {
    sourceType: match[1] as StatBlockSourceType,
    sourceRef: match[2],
    style: match[3] as StatBlockStyle
  };
}

export function replaceStatBlockTokensInHtml(
  html: string,
  resolver: (token: ParsedStatBlockToken) => string | null
): {html: string; replacedCount: number} {
  TOKEN_REGEX.lastIndex = 0;
  let replacedCount = 0;
  const updatedHtml = html.replace(
    TOKEN_REGEX,
    (_match, sourceType: string, sourceRef: string, style: string) => {
      const resolved = resolver({
        sourceType: sourceType as StatBlockSourceType,
        sourceRef,
        style: style as StatBlockStyle
      });
      if (!resolved) {
        return _match;
      }
      replacedCount += 1;
      return resolved;
    }
  );
  return {html: updatedHtml, replacedCount};
}

export function buildCharacterStatBlockHtml(
  input: CharacterStatBlockInput,
  style: StatBlockStyle
): string {
  const lines: string[] = [];
  const styleLabel =
    style === 'full' ? 'All Stats' : style === 'buffs' ? 'Buffs Only' : 'Compact';

  lines.push(`[Character Status • ${styleLabel}]`);
  lines.push(input.name);
  lines.push(
    `Level ${input.effectiveLevel} (base ${input.level}) • ${input.experience} XP`
  );
  lines.push('');

  const statLines = input.stats.map((stat) => {
    const delta = stat.effectiveValue - stat.baseValue;
    return {
      hasBuff: delta !== 0 || Boolean(stat.modifierNotes),
      text:
        `${stat.name}: ${stat.baseValue}` +
        (stat.effectiveValue !== stat.baseValue ? ` -> ${stat.effectiveValue}` : '') +
        (delta !== 0 ? ` (${delta >= 0 ? '+' : ''}${delta})` : '') +
        (stat.modifierNotes ? ` [${stat.modifierNotes}]` : '')
    };
  });

  const resourceLines = input.resources.map((resource) => {
    const hasBuff =
      resource.effectiveCurrent !== resource.current ||
      resource.effectiveMax !== resource.max;
    return {
      hasBuff,
      text:
        `${resource.name}: ${resource.current}/${resource.max}` +
        (hasBuff
          ? ` -> ${resource.effectiveCurrent}/${resource.effectiveMax}`
          : '')
    };
  });

  if (style !== 'compact') {
    const statsToRender =
      style === 'buffs' ? statLines.filter((entry) => entry.hasBuff) : statLines;
    const resourcesToRender =
      style === 'buffs'
        ? resourceLines.filter((entry) => entry.hasBuff)
        : resourceLines;

    if (statsToRender.length > 0) {
      lines.push('Stats');
      statsToRender.forEach((entry) => lines.push(`- ${entry.text}`));
    }

    if (resourcesToRender.length > 0) {
      if (lines[lines.length - 1] !== '') {
        lines.push('');
      }
      lines.push('Resources');
      resourcesToRender.forEach((entry) => lines.push(`- ${entry.text}`));
    }
  } else {
    const compactStats = statLines.slice(0, 4).map((entry) => entry.text).join(' | ');
    if (compactStats) lines.push(compactStats);
    const compactResources = resourceLines.map((entry) => entry.text).join(' | ');
    if (compactResources) lines.push(compactResources);
  }

  const notes = style === 'buffs' ? input.activeNotes : input.activeNotes.slice(0, 3);
  if (notes.length > 0) {
    if (lines[lines.length - 1] !== '') {
      lines.push('');
    }
    lines.push('Active Effects');
    notes.forEach((note) => lines.push(`- ${note}`));
  } else if (style === 'buffs') {
    lines.push('No active buffs detected.');
  }

  return toHtmlParagraphs(lines);
}

export function buildItemStatBlockHtml(
  input: ItemStatBlockInput,
  style: StatBlockStyle
): string {
  const lines: string[] = [];
  const styleLabel =
    style === 'full' ? 'All Fields' : style === 'buffs' ? 'Buff Fields' : 'Compact';
  const filteredFields =
    style === 'full'
      ? input.fields
      : style === 'buffs'
        ? input.fields.filter((field) =>
            /(buff|bonus|modifier|effect)/i.test(field.key)
          )
        : input.fields.slice(0, 6);

  lines.push(`[Item Status • ${styleLabel}]`);
  lines.push(input.name);
  lines.push('');

  if (filteredFields.length === 0) {
    lines.push(
      style === 'buffs'
        ? 'No buff/effect fields found on this item.'
        : 'No item stats found.'
    );
  } else {
    filteredFields.forEach((field) => {
      lines.push(`- ${field.key}: ${field.value}`);
    });
  }

  return toHtmlParagraphs(lines);
}
