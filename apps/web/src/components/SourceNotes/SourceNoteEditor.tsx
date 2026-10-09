import {EditorContent, useEditor, useEditorState} from '@tiptap/react';
import type {Editor, JSONContent} from '@tiptap/core';
import type {LoreDocumentFormat} from '../../entityTypes';
import {useEffect, useRef} from 'react';
import '../../assets/TipTapEditor.css';
import {sourceNoteContentToHtml} from '../../services/lore/sourceNoteFormat';
import {sourceNoteDocToMarkdown} from '../../services/lore/sourceNoteMarkdown';
import {sourceNoteEditorExtensions} from './sourceNoteEditorExtensions';
import styles from './SourceNoteContentField.module.css';

interface SourceNoteEditorProps {
  content: string;
  format: LoreDocumentFormat;
  labelId: string;
  /** Unedited text comes back in its own format; anything edited comes back as Markdown. */
  onChange: (content: string, format: LoreDocumentFormat) => void;
}

type BlockStyle = 'paragraph' | 'heading-1' | 'heading-2' | 'heading-3' | 'bullet' | 'ordered' | 'quote';

const readBlockStyle = (editor: Editor): BlockStyle => {
  if (editor.isActive('bulletList')) return 'bullet';
  if (editor.isActive('orderedList')) return 'ordered';
  if (editor.isActive('blockquote')) return 'quote';
  for (const level of [1, 2, 3] as const) {
    if (editor.isActive('heading', {level})) return `heading-${level}`;
  }
  return 'paragraph';
};

const applyBlockStyle = (editor: Editor, style: BlockStyle) => {
  const chain = editor.chain().focus();
  if (style === 'paragraph') chain.setParagraph().run();
  else if (style === 'bullet') chain.toggleBulletList().run();
  else if (style === 'ordered') chain.toggleOrderedList().run();
  else if (style === 'quote') chain.toggleBlockquote().run();
  else chain.toggleHeading({level: Number(style.slice(-1)) as 1 | 2 | 3}).run();
};

/**
 * Visual editor for a Source Note. The note is loaded through the same
 * renderer that displays it and serialized to Markdown only when its content
 * changes, so opening and saving without edits keeps the stored text
 * byte-for-byte. A plain-text note becomes Markdown on its first edit, with
 * its text escaped so it reads the same.
 */
export const SourceNoteEditor = ({content, format, labelId, onChange}: SourceNoteEditorProps) => {
  const original = useRef({content, format});
  const baseline = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const editor = useEditor({
    extensions: sourceNoteEditorExtensions,
    content: sourceNoteContentToHtml(content, format) || '<p></p>',
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: `${styles.editorSurface} ${styles.richContent}`,
        'aria-labelledby': labelId,
        'aria-multiline': 'true',
        role: 'textbox'
      }
    },
    onUpdate: ({editor: updated, transaction}) => {
      // The document as loaded, before the first change, is what "unchanged" means.
      baseline.current ??= sourceNoteDocToMarkdown(transaction.before.toJSON() as JSONContent);
      const next = sourceNoteDocToMarkdown(updated.getJSON());
      if (next === baseline.current) {
        onChangeRef.current(original.current.content, original.current.format);
      } else {
        onChangeRef.current(next, 'markdown');
      }
    }
  });
  const state = useEditorState({
    editor,
    selector: ({editor: current}) => ({
      blockStyle: readBlockStyle(current),
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      inTable: current.isActive('table')
    })
  });

  const tableAction = (label: string, run: (editor: Editor) => boolean) => (
    <button type='button' onClick={() => run(editor)}>
      {label}
    </button>
  );

  return (
    <div className={styles.editor}>
      <div className='control-group' role='toolbar' aria-label='Formatting'>
        <div className='button-group'>
          <select
            className='toolbar-select'
            aria-label='Block style'
            value={state.blockStyle}
            onChange={(event) => applyBlockStyle(editor, event.target.value as BlockStyle)}
          >
            <option value='paragraph'>Paragraph</option>
            <option value='heading-1'>Heading 1</option>
            <option value='heading-2'>Heading 2</option>
            <option value='heading-3'>Heading 3</option>
            <option value='bullet'>Bullet list</option>
            <option value='ordered'>Numbered list</option>
            <option value='quote'>Quote</option>
          </select>
          <button
            type='button'
            aria-pressed={state.bold}
            className={state.bold ? 'is-active' : undefined}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            Bold
          </button>
          <button
            type='button'
            aria-pressed={state.italic}
            className={state.italic ? 'is-active' : undefined}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            Italic
          </button>
          {state.inTable ? (
            <>
              {tableAction('Add row', (current) => current.chain().focus().addRowAfter().run())}
              {tableAction('Add column', (current) => current.chain().focus().addColumnAfter().run())}
              {tableAction('Delete row', (current) => current.chain().focus().deleteRow().run())}
              {tableAction('Delete column', (current) => current.chain().focus().deleteColumn().run())}
              {tableAction('Delete table', (current) => current.chain().focus().deleteTable().run())}
            </>
          ) : (
            tableAction('Insert table', (current) =>
              current.chain().focus().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run()
            )
          )}
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};
