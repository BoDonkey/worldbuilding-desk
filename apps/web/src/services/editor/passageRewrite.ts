import {Fragment, Slice, type Node as PMNode} from 'prosemirror-model';
import type {EditorState, Transaction} from 'prosemirror-state';
import type {SceneSnapshot} from '../../entityTypes';
import {saveSceneSnapshot} from '../storage';
import {countWords} from '../../utils/textHelpers';

/*
 * Rewrite beside the original (slice 4.97): an editable copy of a passage
 * beside the passage itself. Use rewrite replaces the passage in one undoable
 * transaction, and only if the passage still reads as it did when the
 * rewrite was opened; edits elsewhere in the scene are fine, because the
 * range is mapped through every change. Keep both saves the rewrite as an
 * `alternative` snapshot of the scene, found again later by the passage's
 * text. No model is involved.
 */

export interface PassageRange {
  from: number;
  to: number;
}

const BLOCK_SEPARATOR = '\n\n';
const LEAF_TEXT = '￼';

/** The passage's text, paragraphs separated by a blank line. */
export const passageText = (doc: PMNode, range: PassageRange): string =>
  doc.textBetween(range.from, range.to, BLOCK_SEPARATOR, LEAF_TEXT);

/**
 * Where `text` (as `passageText` gives it) is in `doc`, or null when it is
 * not there or is there more than once, so an alternative never replaces
 * the wrong copy of a repeated passage.
 */
export function findPassage(doc: PMNode, text: string): PassageRange | null {
  if (!text) return null;
  // Mirror textBetween over the whole document, recording each character's position.
  let whole = '';
  const positions: number[] = [];
  let first = true;
  doc.descendants((node, pos) => {
    const nodeText = node.isText ? node.text ?? '' : node.isLeaf ? LEAF_TEXT : '';
    if (node.isBlock && ((node.isLeaf && nodeText) || node.isTextblock)) {
      if (first) first = false;
      else {
        whole += BLOCK_SEPARATOR;
        for (let index = 0; index < BLOCK_SEPARATOR.length; index += 1) positions.push(pos + 1);
      }
    }
    for (let index = 0; index < nodeText.length; index += 1) positions.push(node.isText ? pos + index : pos);
    whole += nodeText;
    return true;
  });
  const start = whole.indexOf(text);
  if (start < 0 || whole.indexOf(text, start + 1) >= 0) return null;
  const range = {from: positions[start], to: positions[start + text.length - 1] + 1};
  return passageText(doc, range) === text ? range : null;
}

/** The passage's range after `transaction`, or null once it has been deleted. */
export function mapPassageRange(range: PassageRange, transaction: Pick<Transaction, 'mapping'>): PassageRange | null {
  const from = transaction.mapping.map(range.from, 1);
  const to = transaction.mapping.map(range.to, -1);
  return from < to ? {from, to} : null;
}

/** True when the passage at `range` still reads `originalText`. */
export function isPassageUnchanged(doc: PMNode, range: PassageRange | null, originalText: string): boolean {
  if (!range || range.from < 0 || range.to > doc.content.size || range.from >= range.to) return false;
  return passageText(doc, range) === originalText;
}

/** How deep `fragment` can be opened at its start or end. */
function openableDepth(fragment: Fragment, side: 'start' | 'end'): number {
  let depth = 0;
  let node = side === 'start' ? fragment.firstChild : fragment.lastChild;
  while (node && !node.isLeaf && !node.isText) {
    depth += 1;
    node = side === 'start' ? node.firstChild : node.lastChild;
  }
  return depth;
}

/**
 * The passage with its enclosing blocks from the top of the document, so
 * its content is whole blocks (the editable copy starts from it) and its
 * open depth says how far it starts and ends inside them.
 */
export const passageSlice = (doc: PMNode, range: PassageRange): Slice => doc.slice(range.from, range.to, true);

export type PassageRewriteResult =
  | {ok: true; transaction: Transaction}
  | {ok: false; reason: 'changed' | 'empty'};

/**
 * The transaction that puts `rewrite` (block content in the editor's schema)
 * in place of the passage. A passage that starts or ends inside a paragraph
 * is joined to the text around it, as the original was.
 */
export function buildPassageRewrite(
  state: EditorState,
  range: PassageRange | null,
  originalText: string,
  rewrite: Fragment
): PassageRewriteResult {
  if (!isPassageUnchanged(state.doc, range, originalText) || !range) return {ok: false, reason: 'changed'};
  if (!rewrite.textBetween(0, rewrite.size, BLOCK_SEPARATOR, LEAF_TEXT).trim()) return {ok: false, reason: 'empty'};
  const original = passageSlice(state.doc, range);
  const slice = new Slice(
    rewrite,
    Math.min(original.openStart, openableDepth(rewrite, 'start')),
    Math.min(original.openEnd, openableDepth(rewrite, 'end'))
  );
  const transaction = state.tr.replace(range.from, range.to, slice);
  return transaction.docChanged ? {ok: true, transaction} : {ok: false, reason: 'changed'};
}

/** The default name of an alternative: the passage's first words. */
export function defaultAlternativeName(originalText: string): string {
  const words = originalText.split(/\s+/).filter(Boolean);
  const excerpt = words.slice(0, 6).join(' ');
  return `Alternative: “${excerpt}${words.length > 6 ? '…' : ''}”`;
}

/** Saves a rewrite as an alternative for later (Keep both). Never pruned. */
export async function savePassageAlternative(params: {
  projectId: string;
  sceneId: string;
  sceneTitle?: string;
  originalHtml: string;
  originalText: string;
  rewriteHtml: string;
  name?: string;
  now?: number;
}): Promise<SceneSnapshot> {
  const sceneTitle = params.sceneTitle?.trim();
  const snapshot: SceneSnapshot = {
    id: crypto.randomUUID(),
    projectId: params.projectId,
    sceneId: params.sceneId,
    ...(sceneTitle ? {sceneTitle} : {}),
    content: params.rewriteHtml,
    name: params.name?.trim() || defaultAlternativeName(params.originalText),
    kind: 'alternative',
    passage: {original: params.originalHtml, originalText: params.originalText},
    wordCount: countWords(params.rewriteHtml),
    createdAt: params.now ?? Date.now()
  };
  await saveSceneSnapshot(snapshot, []);
  return snapshot;
}
