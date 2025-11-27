import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { WordCountExtension } from '../extensions/WordCountExtension';

interface TipTapEditorProps {
  content: string;           // stored as HTML in your WritingDocument
  onChange: (html: string) => void;
  onWordCountChange?: (count: number) => void;
}

function TipTapEditor({ content, onChange, onWordCountChange }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, WordCountExtension],
    content: content || '<p></p>',
    onUpdate({ editor }) {
      onChange(editor.getHTML());

      const storage = (editor.storage as any).wordCount;
      if (storage && typeof onWordCountChange === 'function') {
        onWordCountChange(storage.words ?? 0);
      }
    }
  });

  useEffect(() => {
    if (!editor) return;

    const current = editor.getHTML();
    const next = content || '<p></p>';

    if (current !== next) {
      editor.commands.setContent(next);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const buttonStyle: React.CSSProperties = {
    padding: '0.25rem 0.5rem',
    marginRight: '0.25rem',
    borderRadius: '3px',
    border: '1px solid #555',
    background: '#333',
    color: '#f5f5f5',
    cursor: 'pointer',
    fontSize: '0.85rem'
  };

  const activeButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: '#555',
    fontWeight: 'bold'
  };

  const toolbarStyle: React.CSSProperties = {
    marginBottom: '0.5rem',
    borderBottom: '1px solid #444',
    paddingBottom: '0.25rem'
  };

  const editorWrapperStyle: React.CSSProperties = {
    border: '1px solid #444',
    borderRadius: '4px',
    padding: '0.5rem',
    minHeight: '300px',
    background: '#1e1e1e',
    color: '#f5f5f5'
  };

  return (
    <div>
      <div style={toolbarStyle}>
        <button
          type="button"
          style={editor.isActive('bold') ? activeButtonStyle : buttonStyle}
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
        >
          B
        </button>

        <button
          type="button"
          style={editor.isActive('italic') ? activeButtonStyle : buttonStyle}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
        >
          I
        </button>

        <button
          type="button"
          style={editor.isActive('heading', { level: 2 }) ? activeButtonStyle : buttonStyle}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>

        <button
          type="button"
          style={editor.isActive('bulletList') ? activeButtonStyle : buttonStyle}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={!editor.can().chain().focus().toggleBulletList().run()}
        >
          • List
        </button>

        <button
          type="button"
          style={editor.isActive('orderedList') ? activeButtonStyle : buttonStyle}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={!editor.can().chain().focus().toggleOrderedList().run()}
        >
          1. List
        </button>

        <button
          type="button"
          style={buttonStyle}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
        >
          Undo
        </button>

        <button
          type="button"
          style={buttonStyle}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
        >
          Redo
        </button>
      </div>

      <div style={editorWrapperStyle}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default TipTapEditor;
