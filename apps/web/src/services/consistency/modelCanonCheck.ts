import type {AIProviderId, CanonicalFact} from '../../entityTypes';
import type {LLMMessage} from '../llm/types';
import {AI_PROVIDER_LABELS} from '../llm/providerLabels';
import type {ConsistencyReviewItem} from './reviewReadiness';

/**
 * Model-assisted canon check (roadmap 4.38). The structural comparator
 * (4.24) cannot read paraphrase or implication; this author-triggered check
 * asks a model. Models propose, code validates: every candidate must quote
 * text that exists verbatim in the scene and cite a fact that was sent, or it
 * is discarded. Survivors become dismissible review items; nothing is
 * applied.
 */

/** About 2,000 words: enough for most scenes without sending a chapter. */
export const CANON_CHECK_SCENE_CHAR_LIMIT = 12_000;
const MIN_EVIDENCE_CHARS = 3;

export interface CanonCheckEntity {
  id: string;
  name: string;
  aliases: string[];
}

export interface CanonCheckFact {
  /** Short id used in the prompt, e.g. F1. */
  ref: string;
  fact: CanonicalFact;
  entityName: string;
  value: string;
}

export interface CanonCheckCandidate {
  factId: string;
  evidence: {start?: number; end?: number; text: string};
  summary: string;
}

export interface ValidatedCanonConflict {
  fact: CanonCheckFact;
  evidence: {start: number; end: number; text: string};
  summary: string;
}

export type CanonCheckRejection = 'unknown-fact' | 'evidence-not-in-scene' | 'missing-summary' | 'duplicate';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const factValueText = (fact: CanonicalFact): string =>
  typeof fact.value === 'string' ? fact.value : `${fact.value.label}: ${fact.value.value}`.trim();

/** Scene HTML as plain text with one blank line between paragraphs, as the model reads it. */
export function sceneCheckText(html: string): string {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  const blocks = Array.from(body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre'))
    .filter((element) => !element.querySelector('p, li, blockquote, pre'))
    .map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return blocks.length > 0 ? blocks.join('\n\n') : (body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** The part of the scene the check reads, and whether it was cut short. */
export function canonCheckSceneText(sceneText: string): {text: string; truncated: boolean} {
  if (sceneText.length <= CANON_CHECK_SCENE_CHAR_LIMIT) return {text: sceneText, truncated: false};
  const cut = sceneText.lastIndexOf(' ', CANON_CHECK_SCENE_CHAR_LIMIT);
  return {text: sceneText.slice(0, cut > 0 ? cut : CANON_CHECK_SCENE_CHAR_LIMIT), truncated: true};
}

/**
 * Accepted facts about the entities the scene mentions by name or alias. Only
 * these are sent; facts about everyone else stay home.
 */
export function selectCanonCheckFacts(params: {
  sceneText: string;
  entities: CanonCheckEntity[];
  facts: CanonicalFact[];
}): CanonCheckFact[] {
  const mentioned = new Map<string, string>();
  params.entities.forEach((entity) => {
    const surfaces = [entity.name, ...entity.aliases].map((surface) => surface.trim()).filter((surface) => surface.length >= 2);
    const named = surfaces.some((surface) =>
      new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(surface)}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(params.sceneText)
    );
    if (named) mentioned.set(entity.id, entity.name);
  });
  return params.facts
    .filter((fact) => mentioned.has(fact.targetId) && factValueText(fact))
    .map((fact, index) => ({
      ref: `F${index + 1}`,
      fact,
      entityName: mentioned.get(fact.targetId) ?? fact.targetName ?? fact.targetId,
      value: factValueText(fact)
    }));
}

export const CANON_CHECK_REPLY_FORMAT =
  'Reply with JSON only, in this shape:\n' +
  '{"contradictions": [{"factId": the fact id such as "F1", "evidence": {"start": number, "end": ' +
  'number, "text": the exact words from the scene that contradict the fact}, "summary": one ' +
  'sentence saying how they conflict}]}\n' +
  'Copy evidence text exactly from the scene, character for character. If nothing in the scene ' +
  'contradicts the facts, reply {"contradictions": []}.';

export function buildCanonCheckPrompt(params: {
  sceneTitle: string;
  sceneText: string;
  facts: CanonCheckFact[];
}): {systemPrompt: string; messages: LLMMessage[]} {
  if (params.facts.length === 0) throw new Error('No accepted facts mention anyone in this scene.');
  const factLines = params.facts
    .map((entry) => `${entry.ref} — ${entry.entityName} — ${entry.fact.factType}: ${entry.value}`)
    .join('\n');
  return {
    systemPrompt: [
      'You check one scene of a novel against facts the author has accepted as canon. Find places ' +
        'where the scene contradicts a fact, including by paraphrase or clear implication.',
      'Rules:\n' +
        '- Report only real contradictions with the listed facts. A detail the facts do not cover is ' +
        'not a contradiction.\n' +
        '- Dialogue can be mistaken, a lie, or a joke; report it only when the scene presents it as true.\n' +
        '- A fact may have changed later in the story; you see only this scene and these facts, so ' +
        'report what conflicts and let the author judge.\n' +
        '- Do not suggest edits. The author reviews every item; nothing you say changes their story.',
      CANON_CHECK_REPLY_FORMAT
    ].join('\n\n'),
    messages: [
      {
        role: 'user',
        content: `Accepted facts:\n${factLines}\n\nScene "${params.sceneTitle || 'Untitled scene'}":\n${params.sceneText}`
      }
    ]
  };
}

/** Pulls the candidate list out of a model reply. Anything malformed is dropped, not repaired. */
export function parseCanonCheckReply(reply: string): CanonCheckCandidate[] {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The model did not return a list of contradictions.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.slice(start, end + 1));
  } catch {
    throw new Error('The model’s reply was not valid JSON.');
  }
  const list = (parsed as {contradictions?: unknown})?.contradictions;
  if (!Array.isArray(list)) throw new Error('The model did not return a list of contradictions.');
  return list.flatMap((entry): CanonCheckCandidate[] => {
    if (!entry || typeof entry !== 'object') return [];
    const {factId, evidence, summary} = entry as Record<string, unknown>;
    const evidenceRecord = evidence && typeof evidence === 'object' ? (evidence as Record<string, unknown>) : null;
    if (typeof factId !== 'string' || !evidenceRecord || typeof evidenceRecord.text !== 'string') return [];
    return [{
      factId: factId.trim(),
      evidence: {
        text: evidenceRecord.text,
        start: typeof evidenceRecord.start === 'number' ? evidenceRecord.start : undefined,
        end: typeof evidenceRecord.end === 'number' ? evidenceRecord.end : undefined
      },
      summary: typeof summary === 'string' ? summary.trim() : ''
    }];
  });
}

/**
 * The deterministic gate. A candidate survives only if its fact id names a
 * fact that was sent and its evidence is a verbatim span of the checked
 * scene text. Offsets from the model are trusted only when they point at
 * that exact text; otherwise the first verbatim occurrence is used.
 */
export function validateCanonCheckCandidates(params: {
  candidates: CanonCheckCandidate[];
  sceneText: string;
  facts: CanonCheckFact[];
}): {accepted: ValidatedCanonConflict[]; rejected: Array<{candidate: CanonCheckCandidate; reason: CanonCheckRejection}>} {
  const factsByRef = new Map(params.facts.map((entry) => [entry.ref, entry]));
  const accepted: ValidatedCanonConflict[] = [];
  const rejected: Array<{candidate: CanonCheckCandidate; reason: CanonCheckRejection}> = [];
  const seen = new Set<string>();
  params.candidates.forEach((candidate) => {
    const fact = factsByRef.get(candidate.factId);
    if (!fact) {
      rejected.push({candidate, reason: 'unknown-fact'});
      return;
    }
    const text = candidate.evidence.text.trim();
    const {start, end} = candidate.evidence;
    const offsetsMatch =
      typeof start === 'number' && typeof end === 'number' && params.sceneText.slice(start, end).trim() === text;
    const index = offsetsMatch ? params.sceneText.indexOf(text, start) : params.sceneText.indexOf(text);
    if (text.length < MIN_EVIDENCE_CHARS || index < 0) {
      rejected.push({candidate, reason: 'evidence-not-in-scene'});
      return;
    }
    if (!candidate.summary) {
      rejected.push({candidate, reason: 'missing-summary'});
      return;
    }
    const key = `${fact.fact.id}:${index}:${text}`;
    if (seen.has(key)) {
      rejected.push({candidate, reason: 'duplicate'});
      return;
    }
    seen.add(key);
    accepted.push({fact, evidence: {start: index, end: index + text.length, text}, summary: candidate.summary});
  });
  return {accepted, rejected};
}

export const modelCheckEngineLabel = (provider: AIProviderId | undefined): string =>
  `Model-assisted check${provider ? ` · ${AI_PROVIDER_LABELS[provider]}` : ''}`;

/** Review items for the validated conflicts: dismissible, labeled model-assisted, never applied. */
export function buildModelCanonCheckItems(params: {
  sceneId: string;
  sceneTitle: string;
  conflicts: ValidatedCanonConflict[];
  provider: AIProviderId | undefined;
}): ConsistencyReviewItem[] {
  return params.conflicts.map(({fact, evidence, summary}) => ({
    id: `model-check:${params.sceneId}:${fact.fact.id}:${evidence.start}`,
    sceneId: params.sceneId,
    sceneTitle: params.sceneTitle || 'Untitled scene',
    issue: {
      code: 'STATE_CONFLICT',
      severity: 'warning',
      message:
        `Possible canon conflict for ${fact.entityName}: the scene says '${evidence.text}', ` +
        `but accepted canon says ${fact.fact.factType} is '${fact.value}'` +
        `${fact.fact.sourceLoreDocumentTitle ? ` (from "${fact.fact.sourceLoreDocumentTitle}")` : ''}.`,
      focusText: evidence.text,
      relatedEntities: [{id: fact.fact.targetId, name: fact.entityName, type: 'entity'}]
    },
    reviewAnnotation: {
      issueCode: 'STATE_CONFLICT',
      source: 'model-check',
      engineLabel: modelCheckEngineLabel(params.provider),
      summary,
      evidence
    }
  }));
}

/** A model-assisted item still applies while its quoted text is still in the scene. */
export const isModelCheckItemCurrent = (item: ConsistencyReviewItem, sceneText: string): boolean =>
  Boolean(item.issue.focusText && sceneText.includes(item.issue.focusText));

export const isModelCheckItem = (item: ConsistencyReviewItem): boolean =>
  item.reviewAnnotation?.source === 'model-check';

/**
 * Whether an item stays when `scene` is re-reviewed: items from other scenes
 * always do; the scene's own model-assisted items do while their quote is
 * still in it. Re-review rebuilds everything else for that scene.
 */
export const survivesSceneRereview = (item: ConsistencyReviewItem, scene: {id: string; content: string}): boolean =>
  item.sceneId !== scene.id ||
  (isModelCheckItem(item) && isModelCheckItemCurrent(item, sceneCheckText(scene.content)));

/** Drops model-assisted items whose scene is gone or no longer contains their quote. */
export function pruneModelCheckItems(
  items: ConsistencyReviewItem[],
  scenes: Array<{id: string; content: string}>
): ConsistencyReviewItem[] {
  const textById = new Map<string, string>();
  return items.filter((item) => {
    if (!isModelCheckItem(item)) return true;
    const scene = scenes.find((entry) => entry.id === item.sceneId);
    if (!scene) return false;
    if (!textById.has(scene.id)) textById.set(scene.id, sceneCheckText(scene.content));
    return isModelCheckItemCurrent(item, textById.get(scene.id) ?? '');
  });
}
