import type { Editor } from '@tiptap/react';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useRef } from 'react';

import '../assets/TipTapEditor.css';
import {
  defaultEditorConfig,
  getWordCount,
  type EditorConfig
} from '../config/editorConfig';

type ToolbarButton = {
  id: string;
  label: string;
  markName: string;
};

interface MenuBarProps {
  editor: Editor;
  customButtons: ToolbarButton[];
}

function MenuBar({ editor, customButtons }: MenuBarProps) {
  if (!editor) return null;

  return (
    <div className="control-group">
      <div className="button-group">
        {/* Core formatting */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''}
        >
          Bold
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''}
        >
          Italic
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'is-active' : ''}
        >
          Strike
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          className={editor.isActive('code') ? 'is-active' : ''}
        >
          Code
        </button>

        {/* Paragraph / headings */}
        <button
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={editor.isActive('paragraph') ? 'is-active' : ''}
        >
          P
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
        >
          H3
        </button>

        {/* Lists */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'is-active' : ''}
          disabled={!editor.can().chain().focus().toggleBulletList().run()}
        >
          • List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'is-active' : ''}
          disabled={!editor.can().chain().focus().toggleOrderedList().run()}
        >
          1. List
        </button>

        {/* Blocks */}
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive('codeBlock') ? 'is-active' : ''}
        >
          Code block
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? 'is-active' : ''}
        >
          Quote
        </button>

        {/* History */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
        >
          Undo
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
        >
          Redo
        </button>

        {/* Separator for custom buttons */}
        {customButtons.length > 0 && (
          <div
            style={{
              width: '2px',
              height: '24px',
              backgroundColor: '#ccc',
              margin: '0 0.5rem'
            }}
          />
        )}

        {/* Character style buttons */}
        {customButtons.map((btn) => (
          <button
            key={btn.id}
            onClick={() =>
              editor.chain().focus().toggleMark(btn.markName).run()
            }
            className={editor.isActive(btn.markName) ? 'is-active' : ''}
            title={btn.label}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TipTapEditorProps {
  content?: string;
  onChange?: (html: string) => void;
  onWordCountChange?: (count: number) => void;
  config?: EditorConfig;
  toolbarButtons?: ToolbarButton[];
}

function TipTapEditor({
  content = '',
  onChange,
  onWordCountChange,
  config = defaultEditorConfig,
  toolbarButtons = []
}: TipTapEditorProps) {
  const isInternalUpdate = useRef(false);

  const editor = useEditor({
    extensions: config.extensions,
    content: content || '<p></p>',
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,

    onUpdate({ editor }) {
      isInternalUpdate.current = true;

      if (onChange) {
        onChange(editor.getHTML());
      }

      if (onWordCountChange) {
        onWordCountChange(getWordCount(editor));
      }

      setTimeout(() => {
        isInternalUpdate.current = false;
      }, 0);
    },

    editorProps: {
      attributes: {
        class: 'tiptap-editor'
      }
    }
  });

  // keep external content in sync
  useEffect(() => {
    if (!editor || isInternalUpdate.current) return;

    const current = editor.getHTML();
    const next = content || '<p></p>';

    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [content, editor]);

  // initial word count
  useEffect(() => {
    if (editor && onWordCountChange) {
      onWordCountChange(getWordCount(editor));
    }
  }, [editor, onWordCountChange]);

  if (!editor) return null;

  return (
    <div className="tiptap-wrapper">
      <MenuBar editor={editor} customButtons={toolbarButtons} />
      <EditorContent editor={editor} />
    </div>
  );
}

export default TipTapEditor;
