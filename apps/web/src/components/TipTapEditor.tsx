// apps/web/src/components/TipTapEditor.tsx - UPDATE MenuBar to accept custom buttons
import type { Editor } from '@tiptap/react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { useEffect, useRef } from 'react';
import '../assets/TipTapEditor.css';
import { defaultEditorConfig, getWordCount, type EditorConfig } from '../config/editorConfig';

interface ToolbarButton {
  id: string;
  label: string;
  markName: string;
}

interface MenuBarProps {
  editor: Editor;
  customButtons?: ToolbarButton[];
}

function MenuBar({ editor, customButtons = [] }: MenuBarProps) {
  const editorState = useEditorState({
    editor,
    selector: (ctx): Record<string, boolean> => {
      // Build dynamic state for custom buttons
      const customState: Record<string, boolean> = {};
      customButtons.forEach(btn => {
        customState[`is_${btn.markName}`] = ctx.editor.isActive(btn.markName) ?? false;
      });

      return {
        isBold: ctx.editor.isActive('bold') ?? false,
        canBold: ctx.editor.can().chain().toggleBold().run() ?? false,
        isItalic: ctx.editor.isActive('italic') ?? false,
        canItalic: ctx.editor.can().chain().toggleItalic().run() ?? false,
        isStrike: ctx.editor.isActive('strike') ?? false,
        canStrike: ctx.editor.can().chain().toggleStrike().run() ?? false,
        isCode: ctx.editor.isActive('code') ?? false,
        canCode: ctx.editor.can().chain().toggleCode().run() ?? false,
        canClearMarks: ctx.editor.can().chain().unsetAllMarks().run() ?? false,
        isParagraph: ctx.editor.isActive('paragraph') ?? false,
        isHeading1: ctx.editor.isActive('heading', { level: 1 }) ?? false,
        isHeading2: ctx.editor.isActive('heading', { level: 2 }) ?? false,
        isHeading3: ctx.editor.isActive('heading', { level: 3 }) ?? false,
        isHeading4: ctx.editor.isActive('heading', { level: 4 }) ?? false,
        isHeading5: ctx.editor.isActive('heading', { level: 5 }) ?? false,
        isHeading6: ctx.editor.isActive('heading', { level: 6 }) ?? false,
        isBulletList: ctx.editor.isActive('bulletList') ?? false,
        isOrderedList: ctx.editor.isActive('orderedList') ?? false,
        isCodeBlock: ctx.editor.isActive('codeBlock') ?? false,
        isBlockquote: ctx.editor.isActive('blockquote') ?? false,
        canUndo: ctx.editor.can().chain().undo().run() ?? false,
        canRedo: ctx.editor.can().chain().redo().run() ?? false,
        ...customState
      };
    },
    equalityFn: (prev, next) => {
      if (!next || !prev) return false;

      // Check custom buttons
      for (const btn of customButtons) {
        const key = `is_${btn.markName}`;
        if ((prev as Record<string, unknown>)[key] !== (next as Record<string, unknown>)[key]) return false;
      }

      return (
        prev.isBold === next.isBold &&
        prev.canBold === next.canBold &&
        prev.isItalic === next.isItalic &&
        prev.canItalic === next.canItalic &&
        prev.isStrike === next.isStrike &&
        prev.canStrike === next.canStrike &&
        prev.isCode === next.isCode &&
        prev.canCode === next.canCode &&
        prev.canClearMarks === next.canClearMarks &&
        prev.isParagraph === next.isParagraph &&
        prev.isHeading1 === next.isHeading1 &&
        prev.isHeading2 === next.isHeading2 &&
        prev.isHeading3 === next.isHeading3 &&
        prev.isHeading4 === next.isHeading4 &&
        prev.isHeading5 === next.isHeading5 &&
        prev.isHeading6 === next.isHeading6 &&
        prev.isBulletList === next.isBulletList &&
        prev.isOrderedList === next.isOrderedList &&
        prev.isCodeBlock === next.isCodeBlock &&
        prev.isBlockquote === next.isBlockquote &&
        prev.canUndo === next.canUndo &&
        prev.canRedo === next.canRedo
      );
    }
  });

  return (
    <div className='control-group'>
      <div className='button-group'>
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editorState.canBold}
          className={editorState.isBold ? 'is-active' : ''}
        >
          Bold
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editorState.canItalic}
          className={editorState.isItalic ? 'is-active' : ''}
        >
          Italic
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editorState.canStrike}
          className={editorState.isStrike ? 'is-active' : ''}
        >
          Strike
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editorState.canCode}
          className={editorState.isCode ? 'is-active' : ''}
        >
          Code
        </button>
        <button
          onClick={() => editor.chain().focus().unsetAllMarks().run()}
          disabled={!editorState.canClearMarks}
        >
          Clear marks
        </button>
        <button onClick={() => editor.chain().focus().clearNodes().run()}>
          Clear nodes
        </button>
        <button
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={editorState.isParagraph ? 'is-active' : ''}
        >
          Paragraph
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editorState.isHeading1 ? 'is-active' : ''}
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editorState.isHeading2 ? 'is-active' : ''}
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editorState.isHeading3 ? 'is-active' : ''}
        >
          H3
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          className={editorState.isHeading4 ? 'is-active' : ''}
        >
          H4
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
          className={editorState.isHeading5 ? 'is-active' : ''}
        >
          H5
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
          className={editorState.isHeading6 ? 'is-active' : ''}
        >
          H6
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editorState.isBulletList ? 'is-active' : ''}
        >
          Bullet list
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editorState.isOrderedList ? 'is-active' : ''}
        >
          Ordered list
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editorState.isCodeBlock ? 'is-active' : ''}
        >
          Code block
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editorState.isBlockquote ? 'is-active' : ''}
        >
          Blockquote
        </button>
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          Horizontal rule
        </button>
        <button onClick={() => editor.chain().focus().setHardBreak().run()}>
          Hard break
        </button>
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editorState.canUndo}
        >
          Undo
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editorState.canRedo}
        >
          Redo
        </button>

        {/* Separator for custom buttons */}
        {customButtons.length > 0 && (
          <div style={{ 
            width: '2px', 
            height: '24px', 
            backgroundColor: '#ccc', 
            margin: '0 0.5rem' 
          }} />
        )}

        {/* Dynamic custom buttons */}
        {customButtons.map((btn) => {
          const isActive = editorState[`is_${btn.markName}`] as boolean;
          return (
            <button
              key={btn.id}
              onClick={() => editor.chain().focus().toggleMark(btn.markName).run()}
              className={isActive ? 'is-active' : ''}
              title={`Toggle ${btn.label}`}
            >
              {btn.label}
            </button>
          );
        })}
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
  immediatelyRender: true,
  shouldRerenderOnTransaction: false,
  extensions: config.extensions,
  content: content || '<p></p>',

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

  onSelectionUpdate({ editor }) {
    const { from, to } = editor.state.selection;
    if (from === to) {
      const tr = editor.state.tr;
      tr.setStoredMarks([]);
      editor.view.dispatch(tr);
    }
  },

  onCreate({ editor }) {
    const tr = editor.state.tr;
    tr.setStoredMarks([]);
    editor.view.dispatch(tr);
  },

  editorProps: {
    attributes: {
      class: 'tiptap-editor',
    },
  },
});

  useEffect(() => {
    if (!editor || isInternalUpdate.current) {
      return;
    }

    const currentContent = editor.getHTML();
    const newContent = content || '<p></p>';

    if (currentContent !== newContent) {
      editor.commands.setContent(newContent, { emitUpdate: false });

      setTimeout(() => {
        if (editor && !editor.isDestroyed) {
          const tr = editor.state.tr;
          tr.setStoredMarks([]);
          editor.view.dispatch(tr);
        }
      }, 0);
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor && onWordCountChange) {
      onWordCountChange(getWordCount(editor));
    }
  }, [editor, onWordCountChange]);

  if (!editor) {
    return null;
  }

  return (
    <div className='tiptap-wrapper'>
      <MenuBar editor={editor} customButtons={toolbarButtons} />
      <EditorContent editor={editor} />
    </div>
  );
}

export default TipTapEditor;