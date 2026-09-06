import type {Editor} from '@tiptap/core';

export interface SceneRevision {
  projectId: string;
  documentId: string;
  sourceContent: string;
  selectedText: string;
  range: {from: number; to: number} | null;
  text: string;
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
  const paragraphs = proposal.text.split(/\r?\n/).map((text) => ({
    type: 'paragraph',
    content: text ? [{type: 'text', text}] : []
  }));
  const inline = proposal.text.split(/\r?\n/).flatMap((text, index) => [
    ...(index ? [{type: 'hardBreak'}] : []),
    ...(text ? [{type: 'text', text}] : [])
  ]);
  return editor.chain().focus().insertContentAt(range, proposal.range ? inline : paragraphs).run();
}
