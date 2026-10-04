import type {Editor} from '@tiptap/core';
import {insertAIText} from '../../extensions/AITextMark';
import {normalizeAIText, type AITextProvenance} from '../editor/aiTextProvenance';

export interface SceneRevision {
  projectId: string;
  documentId: string;
  sourceContent: string;
  selectedText: string;
  range: {from: number; to: number} | null;
  text: string;
  /** Present when a model wrote `text`; the applied text is then marked as AI text. */
  provenance?: AITextProvenance;
}

/** Validate the live editor immediately before its single undoable transaction. */
export function applySceneRevision(
  editor: Editor,
  proposal: SceneRevision,
  projectId: string,
  documentId: string
): boolean {
  if (proposal.projectId !== projectId || proposal.documentId !== documentId ||
      editor.getHTML() !== proposal.sourceContent || !proposal.text.trim()) return false;
  const range = proposal.range ?? {from: editor.state.doc.content.size, to: editor.state.doc.content.size};
  if (!Number.isInteger(range.from) || !Number.isInteger(range.to) ||
      range.from < 0 || range.to < range.from || range.to > editor.state.doc.content.size) return false;
  if (proposal.range && editor.state.doc.textBetween(range.from, range.to).trim() !== proposal.selectedText.trim()) return false;
  const text = proposal.provenance ? normalizeAIText(proposal.text) : proposal.text;
  const paragraphs = text.split(/\r?\n/).map((line) => ({
    type: 'paragraph',
    content: line ? [{type: 'text', text: line}] : []
  }));
  const inline = text.split(/\r?\n/).flatMap((line, index) => [
    ...(index ? [{type: 'hardBreak'}] : []),
    ...(line ? [{type: 'text', text: line}] : [])
  ]);
  const content = proposal.range ? inline : paragraphs;
  // One undoable transaction: the text and, for model-written text, its AI-text mark.
  if (proposal.provenance) return insertAIText(editor, content, proposal.provenance, range);
  return editor.chain().focus().insertContentAt(range, content).run();
}
