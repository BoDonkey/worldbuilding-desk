import StarterKit from '@tiptap/starter-kit';
import {TableKit} from '@tiptap/extension-table';

/**
 * Only what the Source Note Markdown dialect can store: no code blocks,
 * strikethrough, or underline, and no trailing empty paragraph that would
 * register as an edit.
 */
export const sourceNoteEditorExtensions = [
  StarterKit.configure({
    codeBlock: false,
    strike: false,
    underline: false,
    trailingNode: false,
    link: {openOnClick: false, protocols: ['mailto'], HTMLAttributes: {rel: 'noopener noreferrer'}}
  }),
  TableKit.configure({table: {resizable: false}})
];
