import type {WorldEntity} from '../../entityTypes';
import {getEntitiesByProject, getAliasesByProject, type ConsistencyAlias} from '../storage';
import {findTextMatches, type TextMatchPattern} from '../consistency/textMatcher';
import {isContinuationRequest} from './factualQuestionBoundary';

/*
 * Deterministic subject carry-over for factual follow-ups (1.4b). When a gated
 * question refers back ("What about her brother?", "And his rank?") and names
 * no World Bible record, the subject comes from the records named in the
 * immediately preceding author question and its answer. No model call
 * performs this resolution, and carry-over is exactly one turn deep.
 */

export interface SubjectRecord {
  id: string;
  name: string;
  /** Alternate surfaces, such as saved aliases. */
  aliases: string[];
}

export interface PreviousTurn {
  question: string;
  answer: string;
}

export type FollowUpSubjectResolution =
  | {kind: 'unchanged'}
  | {kind: 'resolved'; record: SubjectRecord; prompt: string}
  | {kind: 'clarify'; candidates: SubjectRecord[]};

const REFERRING_PRONOUN = /\b(?:he|she|they|him|her|hers|his|them|their|theirs|it|its)\b/i;
const POSSESSIVE_PRONOUN = /\b(his|their|its)\b/gi;
const SUBJECT_PRONOUN = /\b(he|she|they|him|them|hers|theirs|it)\b/gi;
// "her brother" is possessive; "ask her about" or a final "her" is not.
const HER_PRONOUN = /\bher\b(\s+)?([\p{L}'’-]+)?/giu;
const NOT_POSSESSED = new Set([
  'a', 'about', 'after', 'an', 'and', 'at', 'before', 'by', 'for', 'from', 'if',
  'in', 'into', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'when', 'where',
  'while', 'with'
]);

export const buildSubjectRecords = (
  entities: WorldEntity[],
  aliases: ConsistencyAlias[]
): SubjectRecord[] => {
  const aliasesByEntity = new Map<string, string[]>();
  for (const alias of aliases) {
    const entityId = alias.targetType === 'entity' ? alias.targetId : alias.entityId;
    if (!entityId || !alias.alias.trim()) continue;
    aliasesByEntity.set(entityId, [...(aliasesByEntity.get(entityId) ?? []), alias.alias.trim()]);
  }
  return entities
    .filter((entity) => entity.name.trim())
    .map((entity) => ({
      id: entity.id,
      name: entity.name.trim(),
      aliases: aliasesByEntity.get(entity.id) ?? []
    }));
};

/** World Bible records and aliases for one project, read through the existing repositories. */
export const loadSubjectRecords = async (projectId: string): Promise<SubjectRecord[]> => {
  const [entities, aliases] = await Promise.all([
    getEntitiesByProject(projectId),
    getAliasesByProject(projectId)
  ]);
  return buildSubjectRecords(entities, aliases);
};

/** Records named in the text, in order of first mention, using the shared entity/alias matcher. */
export const findNamedRecords = (text: string, records: SubjectRecord[]): SubjectRecord[] => {
  const recordById = new Map(records.map((record) => [record.id, record]));
  const patterns: TextMatchPattern[] = records.flatMap((record) =>
    [record.name, ...record.aliases].map((surface) => ({id: record.id, surface, kind: 'known' as const}))
  );
  const named: SubjectRecord[] = [];
  for (const match of findTextMatches(text, patterns)) {
    const record = recordById.get(match.pattern.id);
    if (record && !named.includes(record)) named.push(record);
  }
  return named;
};

/** True when the message points back at an earlier subject instead of naming one. */
export const refersToEarlierSubject = (promptText: string): boolean =>
  REFERRING_PRONOUN.test(promptText) || isContinuationRequest(promptText);

/** Replaces third-person references with the resolved name ("her brother" → "Sera's brother"). */
export const rewriteWithSubject = (promptText: string, name: string): string => {
  const possessive = `${name}'s`;
  let rewritten = promptText
    .replace(HER_PRONOUN, (_match, space: string | undefined, next: string | undefined) => {
      if (!next) return `${name}${space ?? ''}`;
      return NOT_POSSESSED.has(next.toLowerCase())
        ? `${name}${space ?? ''}${next}`
        : `${possessive}${space ?? ''}${next}`;
    })
    .replace(POSSESSIVE_PRONOUN, possessive)
    .replace(SUBJECT_PRONOUN, name);
  if (!findNamedRecords(rewritten, [{id: 'subject', name, aliases: []}]).length) {
    rewritten = `${rewritten.replace(/[?.!\s]+$/, '')} (about ${name})?`;
  }
  return rewritten;
};

export const resolveFollowUpSubject = (params: {
  prompt: string;
  previousTurn: PreviousTurn | null;
  records: SubjectRecord[];
}): FollowUpSubjectResolution => {
  const {prompt, previousTurn, records} = params;
  if (!previousTurn || !refersToEarlierSubject(prompt)) return {kind: 'unchanged'};
  if (findNamedRecords(prompt, records).length > 0) return {kind: 'unchanged'};
  const candidates = findNamedRecords(`${previousTurn.question}\n${previousTurn.answer}`, records);
  if (candidates.length !== 1) return {kind: 'clarify', candidates};
  const [record] = candidates;
  return {kind: 'resolved', record, prompt: rewriteWithSubject(prompt, record.name)};
};

/**
 * The immediately preceding author question in this conversation and the
 * assistant reply that followed it. Earlier turns are never consulted.
 */
export const getPreviousTurn = (
  messages: Array<{role: string; content: string}>
): PreviousTurn | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role !== 'user') continue;
    const answer = messages
      .slice(index + 1)
      .filter((message) => message.role === 'assistant')
      .map((message) => message.content)
      .join('\n');
    return {question: messages[index].content, answer};
  }
  return null;
};

export const describeResolvedSubject = (record: SubjectRecord): string =>
  `Answering about ${record.name}, from your previous question.`;

export const buildSubjectClarification = (candidates: SubjectRecord[]): string => {
  if (candidates.length === 0) {
    return "I couldn't tell which World Bible record this follow-up is about, so I haven't answered it. Ask again with the name you mean.";
  }
  const names = candidates.map((record) => record.name);
  const list =
    names.length === 2
      ? `${names[0]} or ${names[1]}`
      : `${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`;
  return `This follow-up could be about ${list}, so I haven't answered it. Ask again with the name you mean.`;
};

/**
 * Loads World Bible records only when the message actually refers back to an
 * earlier turn. If the records cannot be read, the follow-up fails closed to a
 * clarification instead of guessing a subject.
 */
export const planFollowUpSubject = async (params: {
  projectId: string;
  prompt: string;
  previousTurn: PreviousTurn | null;
}): Promise<FollowUpSubjectResolution> => {
  const {projectId, prompt, previousTurn} = params;
  if (!previousTurn || !refersToEarlierSubject(prompt)) return {kind: 'unchanged'};
  let records: SubjectRecord[];
  try {
    records = await loadSubjectRecords(projectId);
  } catch (error) {
    console.warn('Unable to load World Bible records for a follow-up question.', error);
    return {kind: 'clarify', candidates: []};
  }
  return resolveFollowUpSubject({prompt, previousTurn, records});
};
