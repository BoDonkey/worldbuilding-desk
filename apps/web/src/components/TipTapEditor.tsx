import {TextStyleKit} from '@tiptap/extension-text-style';
import type {Editor} from '@tiptap/react';
import {EditorContent, useEditor, useEditorState} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {useEffect, useRef} from 'react';
import '../assets/TipTapEditor.css';

// Simple word count extension
import { Extension } from '@tiptap/core';

const WordCountExtension = Extension.create({
  name: 'wordCount',

  addStorage() {
    return {
      characters: 0,
      words: 0
    };
  },

  onUpdate() {
    const text = this.editor.getText();
    this.storage.characters = text.length;
    this.storage.words = text.split(/\s+/).filter(Boolean).length;
  }
});

const extensions = [TextStyleKit, StarterKit, WordCountExtension];

function MenuBar({editor}: {editor: Editor}) {
  // Use useEditorState with selector to optimize re-renders
  // This hook only causes re-renders when the selected state actually changes
  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
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
        isHeading1: ctx.editor.isActive('heading', {level: 1}) ?? false,
        isHeading2: ctx.editor.isActive('heading', {level: 2}) ?? false,
        isHeading3: ctx.editor.isActive('heading', {level: 3}) ?? false,
        isHeading4: ctx.editor.isActive('heading', {level: 4}) ?? false,
        isHeading5: ctx.editor.isActive('heading', {level: 5}) ?? false,
        isHeading6: ctx.editor.isActive('heading', {level: 6}) ?? false,
        isBulletList: ctx.editor.isActive('bulletList') ?? false,
        isOrderedList: ctx.editor.isActive('orderedList') ?? false,
        isCodeBlock: ctx.editor.isActive('codeBlock') ?? false,
        isBlockquote: ctx.editor.isActive('blockquote') ?? false,
        canUndo: ctx.editor.can().chain().undo().run() ?? false,
        canRedo: ctx.editor.can().chain().redo().run() ?? false
      };
    },
    // Custom equality function to prevent unnecessary re-renders
    equalityFn: (prev, next) => {
      if (!next || !prev) return false;
      
      // Compare all the boolean states
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
          onClick={() => editor.chain().focus().toggleHeading({level: 1}).run()}
          className={editorState.isHeading1 ? 'is-active' : ''}
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}
          className={editorState.isHeading2 ? 'is-active' : ''}
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({level: 3}).run()}
          className={editorState.isHeading3 ? 'is-active' : ''}
        >
          H3
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({level: 4}).run()}
          className={editorState.isHeading4 ? 'is-active' : ''}
        >
          H4
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({level: 5}).run()}
          className={editorState.isHeading5 ? 'is-active' : ''}
        >
          H5
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({level: 6}).run()}
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
      </div>
    </div>
  );
}

interface TipTapEditorProps {
  content?: string;
  onChange?: (html: string) => void;
  onWordCountChange?: (count: number) => void;
}

function TipTapEditor({content = '', onChange, onWordCountChange}: TipTapEditorProps) {
  const isInternalUpdate = useRef(false);

  const editor = useEditor({
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    extensions,
    content: content || '<p></p>',


    onUpdate({editor}) {
      isInternalUpdate.current = true;
      
      if (onChange) {
        onChange(editor.getHTML());
      }

      // Update word count - this now happens without causing React re-renders
      if (onWordCountChange) {
        const storage = (editor.storage as any).wordCount;
        if (storage) {
          onWordCountChange(storage.words ?? 0);
        }
      }
      
      setTimeout(() => {
        isInternalUpdate.current = false;
      }, 0);
    },
    
    onSelectionUpdate({editor}) {
      // Clear stored marks on selection change to prevent formatting weirdness
      const {from, to} = editor.state.selection;
      if (from === to) {
        const tr = editor.state.tr;
        tr.setStoredMarks([]);
        editor.view.dispatch(tr);
      }
    },
    
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
  });

  // Handle external content changes (when switching documents)
  useEffect(() => {
    if (!editor || isInternalUpdate.current) {
      return;
    }

    const currentContent = editor.getHTML();
    const newContent = content || '<p></p>';

    if (currentContent !== newContent) {
      editor.commands.setContent(newContent, false);
      
      // Clear stored marks after content change
      setTimeout(() => {
        if (editor && !editor.isDestroyed) {
          const tr = editor.state.tr;
          tr.setStoredMarks([]);
          editor.view.dispatch(tr);
        }
      }, 0);
    }
  }, [content, editor]);

  // Update word count on mount
  useEffect(() => {
    if (editor && onWordCountChange) {
      const storage = (editor.storage as any).wordCount;
      if (storage) {
        onWordCountChange(storage.words ?? 0);
      }
    }
  }, [editor, onWordCountChange]);

  if (!editor) {
    return null;
  }

  return (
    <div className='tiptap-wrapper'>
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

export default TipTapEditor;