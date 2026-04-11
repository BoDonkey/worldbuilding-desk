import type {StatBlockSourceType, StatBlockStyle} from '../entityTypes';

export interface ParsedStatBlockToken {
  sourceType: StatBlockSourceType;
  sourceRef: string;
  style: StatBlockStyle;
  label?: string;
  selectedStatIds?: string[];
  selectedResourceIds?: string[];
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

export type StatBlockTokenPresentationStatus = 'resolved' | 'ambiguous' | 'missing';

export interface StatBlockTokenPresentation {
  rawToken: string;
  label: string;
  status: StatBlockTokenPresentationStatus;
  title: string;
}

const TOKEN_REGEX =
  /\{\{STAT_BLOCK:(character|item):([^}:]+):(full|buffs|compact)(?::([^}]+))?\}\}/g;

function encodeSelectionIds(ids: string[] | undefined): string {
  if (!ids || ids.length === 0) return '';
  return ids.map((id) => encodeURIComponent(id)).join(',');
}

function decodeSelectionIds(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        return decodeURIComponent(entry);
      } catch {
        return entry;
      }
    });
}

function parseSelectionSegment(
  segment: string | undefined
): {
  label?: string;
  selectedStatIds?: string[];
  selectedResourceIds?: string[];
} {
  if (!segment) return {};
  const parsed = segment.split(';').reduce(
    (acc, part) => {
      const [rawKey, ...rest] = part.split('=');
      const key = rawKey?.trim();
      const value = rest.join('=').trim();
      if (!key) return acc;
      if (key === 'l') {
        try {
          acc.label = decodeURIComponent(value);
        } catch {
          acc.label = value;
        }
      } else if (key === 's') {
        acc.selectedStatIds = decodeSelectionIds(value);
      } else if (key === 'r') {
        acc.selectedResourceIds = decodeSelectionIds(value);
      }
      return acc;
    },
    {} as {
      label?: string;
      selectedStatIds?: string[];
      selectedResourceIds?: string[];
    }
  );
  return parsed;
}

function buildSelectionSegment(params: ParsedStatBlockToken): string | null {
  const parts: string[] = [];
  if (params.label?.trim()) {
    parts.push(`l=${encodeURIComponent(params.label.trim())}`);
  }
  if (params.sourceType !== 'character') {
    return parts.length > 0 ? parts.join(';') : null;
  }
  if (!params.selectedStatIds && !params.selectedResourceIds && parts.length === 0) {
    return null;
  }
  parts.push(`s=${encodeSelectionIds(params.selectedStatIds)}`);
  parts.push(`r=${encodeSelectionIds(params.selectedResourceIds)}`);
  return parts.join(';');
}

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
  const selectionSegment = buildSelectionSegment(params);
  return selectionSegment
    ? `{{STAT_BLOCK:${params.sourceType}:${params.sourceRef}:${params.style}:${selectionSegment}}}`
    : `{{STAT_BLOCK:${params.sourceType}:${params.sourceRef}:${params.style}}}`;
}

export function parseStatBlockToken(token: string): ParsedStatBlockToken | null {
  const match = token.trim().match(
    /^\{\{STAT_BLOCK:(character|item):([^}:]+):(full|buffs|compact)(?::([^}]+))?\}\}$/
  );
  if (!match) return null;
  const selection = parseSelectionSegment(match[4]);
  return {
    sourceType: match[1] as StatBlockSourceType,
    sourceRef: match[2],
    style: match[3] as StatBlockStyle,
    ...selection
  };
}

export function replaceStatBlockTokensInHtml(
  html: string,
  resolver: (token: ParsedStatBlockToken) => string | null
): {html: string; replacedCount: number} {
  let replacedCount = 0;
  let updatedHtml = html;

  if (typeof DOMParser !== 'undefined' && updatedHtml.includes('data-stat-block-token=')) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(updatedHtml, 'text/html');
    const tokenElements = doc.querySelectorAll<HTMLElement>('[data-stat-block-token]');
    tokenElements.forEach((element) => {
      const rawToken = element.dataset.statBlockToken;
      if (!rawToken) return;
      const parsed = parseStatBlockToken(rawToken);
      if (!parsed) return;
      const resolved = resolver(parsed);
      if (!resolved || !element.parentNode) {
        return;
      }
      const fragmentHost = doc.createElement('div');
      fragmentHost.innerHTML = resolved;
      while (fragmentHost.firstChild) {
        element.parentNode.insertBefore(fragmentHost.firstChild, element);
      }
      element.remove();
      replacedCount += 1;
    });
    updatedHtml = doc.body.innerHTML;
  }

  TOKEN_REGEX.lastIndex = 0;
  updatedHtml = updatedHtml.replace(
    TOKEN_REGEX,
    (_match, sourceType: string, sourceRef: string, style: string, selection: string) => {
      const resolved = resolver({
        sourceType: sourceType as StatBlockSourceType,
        sourceRef,
        style: style as StatBlockStyle,
        ...parseSelectionSegment(selection)
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

export function getStatBlockTokenDisplayLabel(token: ParsedStatBlockToken): string {
  return token.label?.trim() || token.sourceRef;
}

export function getStatBlockStyleLabel(style: StatBlockStyle): string {
  return style === 'full' ? 'All Stats' : style === 'buffs' ? 'Buffs Only' : 'Compact';
}

export function getDefaultStatBlockTokenPresentation(
  rawToken: string
): StatBlockTokenPresentation {
  const parsed = parseStatBlockToken(rawToken);
  return parsed
    ? {
        rawToken,
        label: `Stat Block: ${getStatBlockTokenDisplayLabel(parsed)} · ${getStatBlockStyleLabel(parsed.style)}`,
        status: 'resolved',
        title: rawToken
      }
    : {
        rawToken,
        label: 'Stat Block',
        status: 'missing',
        title: rawToken
      };
}

export function renderStatBlockTokenChipHtml(
  rawToken: string,
  presentation: StatBlockTokenPresentation = getDefaultStatBlockTokenPresentation(rawToken)
): string {
  const chipLabel = escapeHtml(presentation.label);
  const chipStatus = escapeHtml(presentation.status);
  const chipTitle = escapeHtml(presentation.title);

  return `<span data-stat-block-token="${escapeHtml(rawToken)}" data-stat-block-label="${escapeHtml(
    presentation.label
  )}" data-stat-block-status="${chipStatus}" class="stat-block-token-chip stat-block-token-chip--${chipStatus}" contenteditable="false" title="${chipTitle}">${chipLabel}</span>`;
}

export function serializeStatBlockTokensAsChipHtml(
  html: string,
  presentToken: (rawToken: string) => StatBlockTokenPresentation = getDefaultStatBlockTokenPresentation
): string {
  TOKEN_REGEX.lastIndex = 0;
  return html.replace(TOKEN_REGEX, (rawToken) =>
    renderStatBlockTokenChipHtml(rawToken, presentToken(rawToken))
  );
}

export function extractStatBlockTokensFromHtml(html: string): string[] {
  const tokens: string[] = [];
  TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = null;
  while ((match = TOKEN_REGEX.exec(html)) !== null) {
    tokens.push(match[0]);
  }

  if (typeof DOMParser !== 'undefined' && html.includes('data-stat-block-token=')) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll<HTMLElement>('[data-stat-block-token]').forEach((element) => {
      const rawToken = element.dataset.statBlockToken;
      if (rawToken) {
        tokens.push(rawToken);
      }
    });
  }

  return tokens;
}

export function replaceFirstStatBlockTokenInHtml(
  html: string,
  targetRawToken: string,
  replacementHtml: string
): {html: string; replaced: boolean} {
  if (typeof DOMParser !== 'undefined' && html.includes('data-stat-block-token=')) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const tokenElement = Array.from(
      doc.querySelectorAll<HTMLElement>('[data-stat-block-token]')
    ).find((element) => element.dataset.statBlockToken === targetRawToken);
    if (tokenElement && tokenElement.parentNode) {
      const fragmentHost = doc.createElement('div');
      fragmentHost.innerHTML = replacementHtml;
      while (fragmentHost.firstChild) {
        tokenElement.parentNode.insertBefore(fragmentHost.firstChild, tokenElement);
      }
      tokenElement.remove();
      return {html: doc.body.innerHTML, replaced: true};
    }
  }

  const targetIndex = html.indexOf(targetRawToken);
  if (targetIndex === -1) {
    return {html, replaced: false};
  }

  return {
    html:
      html.slice(0, targetIndex) +
      replacementHtml +
      html.slice(targetIndex + targetRawToken.length),
    replaced: true
  };
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
