import type {AIProviderId} from '../../entityTypes';
import {MANUSCRIPT_WORD_PATTERN} from '../dashboard/storyDashboard';
import {AI_PROVIDER_LABELS} from '../llm/providerLabels';
import type {AITextOrigin} from './aiTextProvenance';

export interface AITextReportSceneInput {
  id: string;
  title: string;
  content: string;
}

/** Marked words and passages from one feature and one provider. */
export interface AITextReportGroup {
  origin: AITextOrigin | 'unknown';
  provider: AIProviderId | 'unknown';
  models: string[];
  words: number;
  passages: number;
}

export interface AITextSceneReport {
  sceneId: string;
  title: string;
  totalWords: number;
  markedWords: number;
  passages: number;
  groups: AITextReportGroup[];
}

export interface AITextReport {
  sceneCount: number;
  totalWords: number;
  markedWords: number;
  passages: number;
  /** Only scenes that contain marked text, in manuscript order. */
  scenes: AITextSceneReport[];
  groups: AITextReportGroup[];
}

export const AI_TEXT_ORIGIN_LABELS: Record<AITextReportGroup['origin'], string> = {
  'scene-revision': 'Assistant revision',
  'character-scene': 'Character scene',
  'scene-draft': 'Scene draft',
  unknown: 'Unknown feature'
};

export function aiTextProviderLabel(provider: AITextReportGroup['provider']): string {
  return provider === 'unknown' ? 'Unknown provider' : AI_PROVIDER_LABELS[provider];
}

const ORIGINS = new Set<string>(['scene-revision', 'character-scene', 'scene-draft']);
const PROVIDERS = new Set<string>(Object.keys(AI_PROVIDER_LABELS));
const BLOCK_TAGS = new Set([
  'P', 'DIV', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'HR', 'BR',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6'
]);

interface Provenance {
  origin: AITextReportGroup['origin'];
  provider: AITextReportGroup['provider'];
  model: string | null;
  /** Same provenance and insert time means the same insert. */
  key: string;
}

interface Passage {
  provenance: Provenance;
  start: number;
  end: number;
  words: number;
}

function readProvenance(element: Element): Provenance {
  const rawOrigin = element.getAttribute('data-ai-text') ?? '';
  const rawProvider = element.getAttribute('data-ai-provider') ?? '';
  const origin = ORIGINS.has(rawOrigin) ? (rawOrigin as AITextOrigin) : 'unknown';
  const provider = PROVIDERS.has(rawProvider) ? (rawProvider as AIProviderId) : 'unknown';
  const model = element.getAttribute('data-ai-model')?.trim() || null;
  const at = element.getAttribute('data-ai-at') ?? '';
  return {origin, provider, model, key: [origin, provider, model ?? '', at].join('|')};
}

/**
 * Flattens scene HTML to text (blocks separated by newlines) and finds the
 * marked passages in it. Marked runs with the same provenance that touch, or
 * are separated only by whitespace or block breaks, are one passage: one
 * multi-paragraph insert is one passage, and text the author marked as their
 * own in the middle splits it in two.
 */
function analyzeScene(html: string): {text: string; passages: Passage[]} {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  let text = '';
  const passages: Passage[] = [];

  const visit = (node: Node, provenance: Provenance | null) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent ?? '';
      const start = text.length;
      text += value;
      if (!provenance || !value.trim()) return;
      const last = passages[passages.length - 1];
      if (last && last.provenance.key === provenance.key && !text.slice(last.end, start).trim()) {
        last.end = text.length;
      } else {
        passages.push({provenance, start, end: text.length, words: 0});
      }
      return;
    }
    if (!(node instanceof Element)) return;
    const own = node.hasAttribute('data-ai-text') ? readProvenance(node) : provenance;
    const isBlock = BLOCK_TAGS.has(node.tagName);
    if (isBlock) text += '\n';
    node.childNodes.forEach((child) => visit(child, own));
    if (isBlock) text += '\n';
  };
  visit(body, null);
  return {text, passages};
}

function addToGroups(groups: AITextReportGroup[], passage: Passage): void {
  const {origin, provider, model} = passage.provenance;
  let group = groups.find((entry) => entry.origin === origin && entry.provider === provider);
  if (!group) {
    group = {origin, provider, models: [], words: 0, passages: 0};
    groups.push(group);
  }
  group.words += passage.words;
  group.passages += 1;
  if (model && !group.models.includes(model)) group.models.push(model);
}

function mergeGroups(target: AITextReportGroup[], source: AITextReportGroup[]): void {
  for (const group of source) {
    const existing = target.find((entry) => entry.origin === group.origin && entry.provider === group.provider);
    if (!existing) {
      target.push({...group, models: [...group.models]});
      continue;
    }
    existing.words += group.words;
    existing.passages += group.passages;
    for (const model of group.models) if (!existing.models.includes(model)) existing.models.push(model);
  }
}

function byWordsDescending(a: AITextReportGroup, b: AITextReportGroup): number {
  return b.words - a.words || b.passages - a.passages;
}

/**
 * Counts the text the app inserted from a model and marked as AI text
 * (Slice 4.50), per scene and by origin and provider. A word counts as marked
 * when any part of it is marked, so a word the author extended stays counted.
 * Unmarked text is never counted: this is a record, not a detector.
 */
export function buildAITextReport(scenes: AITextReportSceneInput[]): AITextReport {
  const report: AITextReport = {
    sceneCount: scenes.length,
    totalWords: 0,
    markedWords: 0,
    passages: 0,
    scenes: [],
    groups: []
  };

  for (const scene of scenes) {
    const {text, passages} = analyzeScene(scene.content);
    let totalWords = 0;
    let markedWords = 0;
    let index = 0;
    for (const match of text.matchAll(MANUSCRIPT_WORD_PATTERN)) {
      totalWords += 1;
      const start = match.index ?? 0;
      const end = start + match[0].length;
      while (index < passages.length && passages[index].end <= start) index += 1;
      const passage = passages[index];
      if (passage && passage.start < end) {
        passage.words += 1;
        markedWords += 1;
      }
    }
    report.totalWords += totalWords;

    const counted = passages.filter((passage) => passage.words > 0);
    if (counted.length === 0) continue;
    const groups: AITextReportGroup[] = [];
    counted.forEach((passage) => addToGroups(groups, passage));
    groups.sort(byWordsDescending);
    report.scenes.push({
      sceneId: scene.id,
      title: scene.title.trim() || 'Untitled scene',
      totalWords,
      markedWords,
      passages: counted.length,
      groups
    });
    report.markedWords += markedWords;
    report.passages += counted.length;
    mergeGroups(report.groups, groups);
  }
  report.groups.sort(byWordsDescending);
  return report;
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

export function describeAITextGroup(group: AITextReportGroup): string {
  const models = group.models.length > 0 ? ` · ${group.models.join(', ')}` : '';
  return `${AI_TEXT_ORIGIN_LABELS[group.origin]} · ${aiTextProviderLabel(group.provider)}${models}`;
}

export function summarizeAITextCounts(words: number, passages: number): string {
  return `${plural(words, 'word', 'words')} in ${plural(passages, 'passage', 'passages')}`;
}

export const AI_TEXT_REPORT_NOTES = [
  'This report counts text that the app inserted from an AI model and marked as AI text. Edits you made inside marked text keep the mark and are counted.',
  'Text you marked as your writing, and text you typed or pasted yourself, is not marked and not counted. The app does not detect AI text from other sources.',
  'Some publishing platforms ask whether a book contains AI-generated text. This record can help you answer; the judgment is yours. It is not legal advice.'
];

/** Plain-text copy of the report for the author's own records. */
export function formatAITextReport(report: AITextReport, projectName: string, now: Date = new Date()): string {
  const lines = [
    `AI text report — ${projectName}`,
    `Created ${now.toLocaleString()}`,
    '',
    report.markedWords === 0
      ? `No marked AI text in ${plural(report.sceneCount, 'scene', 'scenes')} (${plural(report.totalWords, 'word', 'words')}).`
      : `${summarizeAITextCounts(report.markedWords, report.passages)}, across ${plural(report.scenes.length, 'scene', 'scenes')} of ${report.sceneCount}. ` +
        `The manuscript has ${plural(report.totalWords, 'word', 'words')} in all.`
  ];
  if (report.groups.length > 0) {
    lines.push('', 'By feature and provider:');
    report.groups.forEach((group) =>
      lines.push(`- ${describeAITextGroup(group)}: ${summarizeAITextCounts(group.words, group.passages)}`)
    );
    lines.push('', 'By scene:');
    report.scenes.forEach((scene) => {
      lines.push(`- ${scene.title}: ${summarizeAITextCounts(scene.markedWords, scene.passages)} of ${plural(scene.totalWords, 'word', 'words')}`);
      scene.groups.forEach((group) =>
        lines.push(`    ${describeAITextGroup(group)}: ${summarizeAITextCounts(group.words, group.passages)}`)
      );
    });
  }
  lines.push('', ...AI_TEXT_REPORT_NOTES);
  return lines.join('\n');
}
