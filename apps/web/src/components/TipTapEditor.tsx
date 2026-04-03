import type {Editor, Extension} from '@tiptap/core';
import {EditorContent, useEditor} from '@tiptap/react';
import {useEffect, useRef} from 'react';

import '../assets/TipTapEditor.css';
import {
  defaultEditorConfig,
  getWordCount,
  type EditorConfig
} from '../config/editorConfig';
import {looksLikeMarkdown, markdownToHtml} from '../utils/markdown';

type ToolbarButton = {
  id: string;
  label: string;
  markName: string;
};

interface MenuBarProps {
  editor: Editor;
  customButtons: ToolbarButton[];
}

interface TipTapEditorProps {
  content: string;
  onChange: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
  onEditorKeyDown?: (event: KeyboardEvent) => boolean;
  onEditorTextInput?: (text: string) => void;
  onWordCountChange?: (count: number) => void;
  onConsistencyHighlightClick?: (
    issueId: string,
    anchorRect: {left: number; top: number; bottom: number}
  ) => void;
  onLoreHighlightClick?: (
    loreId: string,
    anchorRect: {left: number; top: number; bottom: number}
  ) => void;
  config?: EditorConfig;
  toolbarButtons?: ToolbarButton[];
  toolbarMode?: 'full' | 'basic';
  extensions?: Extension[];
  textToInsert?: string | null;
  onTextInserted?: () => void;
  insertContext?: {from: number; to: number} | null;
}

function MenuBar({
  editor,
  customButtons,
  toolbarMode
}: MenuBarProps & {toolbarMode: 'full' | 'basic'}) {
  if (!editor) return null;

  return (
    <div className='control-group'>
      <div className='button-group'>
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
        {toolbarMode === 'full' && (
          <>
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
          </>
        )}

        {/* Paragraph / headings */}
        <button
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={editor.isActive('paragraph') ? 'is-active' : ''}
        >
          P
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({level: 1}).run()}
          className={editor.isActive('heading', {level: 1}) ? 'is-active' : ''}
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}
          className={editor.isActive('heading', {level: 2}) ? 'is-active' : ''}
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({level: 3}).run()}
          className={editor.isActive('heading', {level: 3}) ? 'is-active' : ''}
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
        {toolbarMode === 'full' && (
          <>
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
          </>
        )}

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

function TipTapEditor({
  content = '',
  onChange,
  onEditorReady,
  onEditorKeyDown,
  onEditorTextInput,
  onWordCountChange,
  onConsistencyHighlightClick,
  onLoreHighlightClick,
  config = defaultEditorConfig,
  toolbarButtons = [],
  toolbarMode = 'full',
  textToInsert,
  onTextInserted,
  insertContext
}: TipTapEditorProps) {
  const isInternalUpdate = useRef(false);
  const onEditorReadyRef = useRef(onEditorReady);

  useEffect(() => {
    onEditorReadyRef.current = onEditorReady;
  }, [onEditorReady]);

  const editor = useEditor({
    extensions: config.extensions,
    content: content || '<p></p>',
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,

    onUpdate({editor}) {
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
      },
      handleKeyDown(_view, event) {
        if (!onEditorKeyDown) {
          return false;
        }
        return onEditorKeyDown(event);
      },
      handleTextInput(_view, _from, _to, text) {
        if (!onEditorTextInput) {
          return false;
        }
        window.requestAnimationFrame(() => {
          onEditorTextInput(text);
        });
        return false;
      },
      handleClick(_view, _pos, event) {
        if (!(event.target instanceof HTMLElement)) {
          return false;
        }
        const loreTarget = event.target.closest<HTMLElement>('[data-lore-id]');
        if (loreTarget) {
          const loreId = loreTarget.dataset.loreId;
          if (loreId) {
            const rect = loreTarget.getBoundingClientRect();
            onLoreHighlightClick?.(loreId, {
              left: rect.left,
              top: rect.top,
              bottom: rect.bottom
            });
          }
          return false;
        }
        const target = event.target.closest<HTMLElement>('[data-consistency-id]');
        if (!target) {
          return false;
        }
        const issueId = target.dataset.consistencyId;
        if (!issueId) {
          return false;
        }
        const rect = target.getBoundingClientRect();
        onConsistencyHighlightClick?.(issueId, {
          left: rect.left,
          top: rect.top,
          bottom: rect.bottom
        });
        return false;
      },
      handlePaste(_view, event) {
        const plainText = event.clipboardData?.getData('text/plain') ?? '';
        const html = event.clipboardData?.getData('text/html') ?? '';
        if (!plainText || html || !looksLikeMarkdown(plainText)) {
          return false;
        }
        event.preventDefault();
        editor?.chain().focus().insertContent(markdownToHtml(plainText)).run();
        return true;
      }
    }
  });

  useEffect(() => {
    if (editor) {
      onEditorReadyRef.current?.(editor);
    }
  }, [editor]);

  // keep external content in sync
  useEffect(() => {
    if (!editor || isInternalUpdate.current) return;

    const current = editor.getHTML();
    const next = content || '<p></p>';

    if (current !== next) {
      editor.commands.setContent(next, {emitUpdate: false});
      onWordCountChange?.(getWordCount(editor));
    }
  }, [content, editor, onWordCountChange]);

  // initial word count
  useEffect(() => {
    if (editor && onWordCountChange) {
      onWordCountChange(getWordCount(editor));
    }
  }, [editor, onWordCountChange]);

  useEffect(() => {
    if (!textToInsert || !editor) return;

    if (insertContext) {
      editor.commands.setTextSelection({
        from: insertContext.from,
        to: insertContext.to
      });
    }
    editor.commands.insertContent(textToInsert);
    onTextInserted?.();
  }, [textToInsert, editor, insertContext, onTextInserted]);

  if (!editor) return null;

  return (
    <div className='tiptap-wrapper'>
      <div className='tiptap-toolbar-shell'>
        <MenuBar
          editor={editor}
          customButtons={toolbarButtons}
          toolbarMode={toolbarMode}
        />
      </div>
      <div className='tiptap-content-shell'>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default TipTapEditor;
