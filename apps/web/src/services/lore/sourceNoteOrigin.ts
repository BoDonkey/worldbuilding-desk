import type {LoreDocument} from '../../entityTypes';

/*
 * Where a Source Note's text came from. A note saved from an AI session can
 * hold text a model wrote, so the app says so wherever the note is shown, sent
 * to a model, or read for candidates. The author still approves everything;
 * this keeps the evidence they approve from honest about who wrote it.
 */

/** True for a note saved from an assistant reply, a brainstorm item, or the character lab. */
export const isAiSessionSourceNote = (document: Pick<LoreDocument, 'source'>): boolean =>
  document.source.type === 'ai-session';

export const AI_SESSION_NOTE_BADGE = 'From an AI session';

export const AI_SESSION_NOTE_EXPLANATION =
  'This note was saved from an AI session. Parts of it may have been written by a model, not by you.';

export const AI_SESSION_EVIDENCE_WARNING =
  'This note was saved from an AI session, so the evidence quoted under a candidate may be model-written. ' +
  'Check each one against what you decided before accepting it.';

/** Added to the label a note carries in a prompt; see `getRagContextSource`. */
export const AI_SESSION_CONTEXT_QUALIFIER = 'saved from an AI session, may be model-written';

/** A note's title as a prompt names it, saying so when the note came from an AI session. */
export const describeSourceNoteForPrompt = (document: Pick<LoreDocument, 'title' | 'source'>): string =>
  isAiSessionSourceNote(document) ? `${document.title} (${AI_SESSION_CONTEXT_QUALIFIER})` : document.title;

/** Opens the block of model suggestions the author kept when creating a character from a description. */
export const SUGGESTED_DETAILS_HEADING = 'Suggested details from the character lab (not canon):';

export const SUGGESTED_DETAILS_SKIPPED_NOTICE =
  'Extraction skips everything from the “Suggested details from the character lab (not canon)” heading ' +
  'to the end of this note. To have a suggestion considered, move it above that heading.';

/**
 * Offset of the suggested-details heading, or -1. The block runs from the
 * heading to the end of the note: a suggestion can span several lines and the
 * note is rewritten as Markdown on its first edit, so no later line reliably
 * ends it.
 */
export function findSuggestedDetailsStart(content: string): number {
  let cursor = 0;
  for (const line of content.split('\n')) {
    if (line.replace(/\\/g, '').trim() === SUGGESTED_DETAILS_HEADING) return cursor;
    cursor += line.length + 1;
  }
  return -1;
}

export const hasSuggestedDetails = (content: string): boolean => findSuggestedDetailsStart(content) >= 0;

/**
 * The note with its suggested-details block blanked out. Line breaks and
 * length are kept, so evidence offsets found in the result still point into
 * the stored text.
 */
export function withoutSuggestedDetails<T extends Pick<LoreDocument, 'content'>>(document: T): T {
  const start = findSuggestedDetailsStart(document.content);
  if (start < 0) return document;
  return {
    ...document,
    content: document.content.slice(0, start) + document.content.slice(start).replace(/[^\n]/g, ' ')
  };
}
