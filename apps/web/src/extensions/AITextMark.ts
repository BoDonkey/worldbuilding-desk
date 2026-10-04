import {Mark, createNodeFromContent, mergeAttributes, type Content, type Editor} from '@tiptap/core';
import {Fragment, type Mark as PMMark, type Node as PMNode} from 'prosemirror-model';
import type {AITextProvenance} from '../services/editor/aiTextProvenance';

export const AI_TEXT_MARK = 'aiText';

/**
 * Marks prose a model wrote and the app inserted, so the author has a record
 * of it. Not inclusive: typing next to marked text is the author's writing.
 * Edits inside marked text keep the mark. Only an explicit author action
 * (`clearAITextMark`) removes it. Exports render scenes as plain text, so the
 * mark never leaves the app except in project backups.
 */
export const AITextMark = Mark.create({
  name: AI_TEXT_MARK,
  inclusive: false,
  excludes: '',

  addAttributes() {
    const attr = (name: string, dataName: string) => ({
      default: null,
      parseHTML: (element: HTMLElement) => element.getAttribute(dataName),
      renderHTML: (attributes: Record<string, unknown>) =>
        attributes[name] === null || attributes[name] === undefined ? {} : {[dataName]: String(attributes[name])}
    });
    return {
      origin: attr('origin', 'data-ai-text'),
      provider: attr('provider', 'data-ai-provider'),
      model: attr('model', 'data-ai-model'),
      route: attr('route', 'data-ai-route'),
      at: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = Number(element.getAttribute('data-ai-at'));
          return Number.isFinite(value) && value > 0 ? value : null;
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.at === 'number' ? {'data-ai-at': String(attributes.at)} : {}
      }
    };
  },

  parseHTML() {
    return [{tag: 'span[data-ai-text]'}];
  },

  renderHTML({HTMLAttributes}) {
    return ['span', mergeAttributes({class: 'ai-text'}, HTMLAttributes), 0];
  }
});

/**
 * Inserts model-written content at `range` (replacing it) or at the current
 * selection, and marks exactly the inserted text, in one undoable
 * transaction. Returns false if the editor refused the insert.
 */
export function insertAIText(
  editor: Editor,
  content: Parameters<Editor['commands']['insertContentAt']>[1],
  provenance: AITextProvenance,
  range?: {from: number; to: number}
): boolean {
  const markType = editor.schema.marks[AI_TEXT_MARK];
  const target = range ?? {from: editor.state.selection.from, to: editor.state.selection.to};
  if (!markType) return editor.chain().focus().insertContentAt(target, content).run();
  // Mark the content itself before inserting it: block content inserted at the
  // edge of a paragraph lands after that paragraph, so position mapping cannot
  // reliably find the inserted range, but marked nodes carry their mark along.
  const mark = markType.create({...provenance});
  const parsed = createNodeFromContent(content as Content, editor.schema, {
    parseOptions: {preserveWhitespace: 'full'}
  });
  const fragment = parsed instanceof Fragment ? parsed : Fragment.from(parsed);
  const marked = markTextNodes(fragment, mark);
  return editor.chain().focus().insertContentAt(target, marked.toJSON()).run();
}

function markTextNodes(fragment: Fragment, mark: PMMark): Fragment {
  const nodes: PMNode[] = [];
  fragment.forEach((node) => {
    if (node.isText) nodes.push(node.mark(mark.addToSet(node.marks)));
    else nodes.push(node.copy(markTextNodes(node.content, mark)));
  });
  return Fragment.fromArray(nodes);
}

/**
 * "Mark as my writing": removes the AI-text mark from the selection, or from
 * the whole marked passage when the cursor sits inside one.
 */
export function clearAITextMark(editor: Editor): boolean {
  const {from, to, empty} = editor.state.selection;
  if (empty) {
    return editor.chain().focus().extendMarkRange(AI_TEXT_MARK).unsetMark(AI_TEXT_MARK).run();
  }
  return editor.chain().focus().setTextSelection({from, to}).unsetMark(AI_TEXT_MARK).run();
}

/** True when the selection (or the cursor position) touches AI-marked text. */
export function selectionHasAIText(editor: Editor): boolean {
  const {from, to, empty, $from} = editor.state.selection;
  const markType = editor.schema.marks[AI_TEXT_MARK];
  if (!markType) return false;
  if (empty) return Boolean(markType.isInSet($from.marks()) || markType.isInSet($from.nodeBefore?.marks ?? []));
  return editor.state.doc.rangeHasMark(from, to, markType);
}
