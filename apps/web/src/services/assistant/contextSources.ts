import type {ContextSourceRef, LLMContextChunk} from '../llm/types';
import {getEntitiesByProject, getLoreDocumentsByProject} from '../storage';

/*
 * The context a reply used, as the author sees it under "Sources used"
 * (Slice 5.17). A source links to its Source Note or World Bible record only
 * when that record still exists in this project; otherwise it is plain text.
 */

/** A labeled source and the record it came from. */
export type AssistantContextSourceRef = ContextSourceRef & {source: string};

const sourceKey = (source: string) => source.trim().toLowerCase();

/** Distinct source labels, first spelling kept. */
export const getContextSourceSummaries = (chunks: LLMContextChunk[]): string[] =>
  Array.from(
    new Map(
      chunks
        .map((chunk) => chunk.source.trim())
        .filter(Boolean)
        .map((source) => [sourceKey(source), source])
    ).values()
  );

/** The record behind each source label that has one; the first chunk with a record wins. */
export function getContextSourceRefs(chunks: LLMContextChunk[]): AssistantContextSourceRef[] {
  const refs = new Map<string, AssistantContextSourceRef>();
  for (const chunk of chunks) {
    const source = chunk.source.trim();
    if (!source || !chunk.sourceRef || refs.has(sourceKey(source))) continue;
    refs.set(sourceKey(source), {source, kind: chunk.sourceRef.kind, id: chunk.sourceRef.id});
  }
  return [...refs.values()];
}

export const isAssistantContextSourceRef = (value: unknown): value is AssistantContextSourceRef => {
  if (!value || typeof value !== 'object') return false;
  const ref = value as Partial<AssistantContextSourceRef>;
  return (
    typeof ref.source === 'string' &&
    typeof ref.id === 'string' &&
    (ref.kind === 'source-note' || ref.kind === 'world-bible')
  );
};

export const contextSourceRefKey = (ref: ContextSourceRef) => `${ref.kind}:${ref.id}`;

/** Keys of the refs whose record exists in this project now. */
export async function resolveContextSourceRefs(
  projectId: string,
  refs: ReadonlyArray<ContextSourceRef>
): Promise<Set<string>> {
  const wanted = (kind: ContextSourceRef['kind']) => refs.some((ref) => ref.kind === kind);
  const [notes, entities] = await Promise.all([
    wanted('source-note') ? getLoreDocumentsByProject(projectId) : [],
    wanted('world-bible') ? getEntitiesByProject(projectId) : []
  ]);
  const existing = new Set([
    ...notes.map((note) => contextSourceRefKey({kind: 'source-note', id: note.id})),
    ...entities.map((entity) => contextSourceRefKey({kind: 'world-bible', id: entity.id}))
  ]);
  return new Set(refs.map(contextSourceRefKey).filter((key) => existing.has(key)));
}
