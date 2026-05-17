import type {Editor, Extension} from '@tiptap/core';
import {EditorContent, useEditor} from '@tiptap/react';
import {useEffect, useRef} from 'react';
import type {InlineHighlightsMode} from '../entityTypes';

import '../assets/TipTapEditor.css';
import {
  defaultEditorConfig,
  getWordCount,
  type EditorConfig
} from '../config/editorConfig';
import {
  getDefaultStatBlockTokenPresentation,
  serializeStatBlockTokensAsChipHtml,
  type StatBlockTokenPresentation
} from '../utils/statBlockTemplates';

type ToolbarButton = {
  id: string;
  label: string;
  markName: string;
};

type ToolbarAction = {
  id: string;
  label: string;
  onClick: () => void;
};

interface MenuBarProps {
  editor: Editor;
  customButtons: ToolbarButton[];
  actionButtons: ToolbarAction[];
}

interface TipTapEditorProps {
  content: string;
  onChange: (content: string) => void;
  onWordCountChange?: (count: number) => void;
  onConsistencyHighlightClick?: (
    issueId: string,
    anchorRect: {left: number; top: number; bottom: number}
  ) => void;
  onLoreHighlightClick?: (
    loreId: string,
    anchorRect: {left: number; top: number; bottom: number}
  ) => void;
  onLoreHighlightHover?: (
    loreId: string,
    anchorRect: {left: number; top: number; bottom: number}
  ) => void;
  onLoreHighlightLeave?: () => void;
  onStatBlockTokenClick?: (
    rawToken: string,
    anchorRect: {left: number; top: number; bottom: number}
  ) => void;
  config?: EditorConfig;
  toolbarButtons?: ToolbarButton[];
  toolbarActions?: ToolbarAction[];
  extensions?: Extension[];
  textToInsert?: string | null;
  onTextInserted?: () => void;
  insertContext?: {from: number; to: number} | null;
  presentStatBlockToken?: (rawToken: string) => StatBlockTokenPresentation;
  onTypingActivity?: () => void;
  inlineHighlightsMode?: InlineHighlightsMode | 'hidden';
}

function MenuBar({editor, customButtons, actionButtons}: MenuBarProps) {
  if (!editor) return null;

  const activeHeadingLevel = [1, 2, 3].find((level) =>
    editor.isActive('heading', {level})
  );
  const activeBlockStyle = editor.isActive('bulletList')
    ? 'bullet-list'
    : editor.isActive('orderedList')
      ? 'ordered-list'
      : editor.isActive('blockquote')
        ? 'blockquote'
        : editor.isActive('codeBlock')
          ? 'code-block'
          : activeHeadingLevel
            ? `heading-${activeHeadingLevel}`
            : 'paragraph';
  const activeInlineStyle = editor.isActive('bold')
    ? 'bold'
    : editor.isActive('italic')
      ? 'italic'
      : editor.isActive('strike')
        ? 'strike'
        : editor.isActive('code')
          ? 'inline-code'
          : 'plain';
  const activeCustomStyle =
    customButtons.find((btn) => editor.isActive(btn.markName))?.id ?? '';

  return (
    <div className='control-group'>
      <div className='button-group'>
        <select
          className='toolbar-select'
          value={activeBlockStyle}
          onChange={(event) => {
            const value = event.target.value;
            const chain = editor.chain().focus();
            if (value === 'paragraph') {
              chain.setParagraph().run();
              return;
            }
            if (value === 'bullet-list') {
              chain.toggleBulletList().run();
              return;
            }
            if (value === 'ordered-list') {
              chain.toggleOrderedList().run();
              return;
            }
            if (value === 'blockquote') {
              chain.toggleBlockquote().run();
              return;
            }
            if (value === 'code-block') {
              chain.toggleCodeBlock().run();
              return;
            }
            if (value.startsWith('heading-')) {
              const level = Number(value.replace('heading-', ''));
              if ([1, 2, 3].includes(level)) {
                chain.setHeading({level: level as 1 | 2 | 3}).run();
              }
            }
          }}
        >
          <option value='paragraph'>Paragraph</option>
          <option value='heading-1'>Heading 1</option>
          <option value='heading-2'>Heading 2</option>
          <option value='heading-3'>Heading 3</option>
          <option value='bullet-list'>Bullet List</option>
          <option value='ordered-list'>Numbered List</option>
          <option value='blockquote'>Quote</option>
          <option value='code-block'>System Block</option>
        </select>

        <select
          className='toolbar-select'
          value={activeInlineStyle}
          onChange={(event) => {
            const value = event.target.value;
            const chain = editor.chain().focus();
            chain.unsetBold().unsetItalic().unsetStrike().unsetCode();
            if (value === 'plain') {
              chain.run();
              return;
            }
            if (value === 'bold') {
              chain.setBold().run();
              return;
            }
            if (value === 'italic') {
              chain.setItalic().run();
              return;
            }
            if (value === 'strike') {
              chain.setStrike().run();
              return;
            }
            if (value === 'inline-code') {
              chain.setCode().run();
            }
          }}
        >
          <option value='plain'>Text Style</option>
          <option value='bold'>Bold</option>
          <option value='italic'>Italic</option>
          <option value='strike'>Strike</option>
          <option value='inline-code'>Monospace</option>
        </select>

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
        {(customButtons.length > 0 || actionButtons.length > 0) && (
          <div
            style={{
              width: '2px',
              height: '24px',
              backgroundColor: 'var(--color-border)',
              margin: '0 0.5rem'
            }}
          />
        )}

        {/* Character style dropdown */}
        {customButtons.length > 0 && (
          <select
            className='toolbar-select'
            value={activeCustomStyle}
            onChange={(event) => {
              const value = event.target.value;
              const chain = editor.chain().focus();
              customButtons.forEach((btn) => chain.unsetMark(btn.markName));
              if (value) {
                const selected = customButtons.find((btn) => btn.id === value);
                if (selected) {
                  chain.toggleMark(selected.markName).run();
                  return;
                }
              }
              chain.run();
            }}
          >
            <option value=''>Style</option>
            {customButtons.map((btn) => (
              <option key={btn.id} value={btn.id}>
                {btn.label}
              </option>
            ))}
          </select>
        )}

        {actionButtons.map((btn) => (
          <button key={btn.id} type='button' onClick={btn.onClick}>
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TipTapEditorProps {
  content: string;
  onChange: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
  onWordCountChange?: (count: number) => void;
  onConsistencyHighlightClick?: (
    issueId: string,
    anchorRect: {left: number; top: number; bottom: number}
  ) => void;
  onLoreHighlightClick?: (
    loreId: string,
    anchorRect: {left: number; top: number; bottom: number}
  ) => void;
  onLoreHighlightHover?: (
    loreId: string,
    anchorRect: {left: number; top: number; bottom: number}
  ) => void;
  onLoreHighlightLeave?: () => void;
  onStatBlockTokenClick?: (
    rawToken: string,
    anchorRect: {left: number; top: number; bottom: number}
  ) => void;
  config?: EditorConfig;
  toolbarButtons?: ToolbarButton[];
  toolbarActions?: ToolbarAction[];
  extensions?: Extension[];
}

function TipTapEditor({
  content = '',
  onChange,
  onEditorReady,
  onWordCountChange,
  onConsistencyHighlightClick,
  onLoreHighlightClick,
  onLoreHighlightHover,
  onLoreHighlightLeave,
  onStatBlockTokenClick,
  config = defaultEditorConfig,
  toolbarButtons = [],
  toolbarActions = [],
  textToInsert,
  onTextInserted,
  insertContext,
  presentStatBlockToken = getDefaultStatBlockTokenPresentation,
  onTypingActivity,
  inlineHighlightsMode = 'visible'
}: TipTapEditorProps) {
  const isInternalUpdate = useRef(false);
  const onEditorReadyRef = useRef(onEditorReady);
  const normalizedContent = serializeStatBlockTokensAsChipHtml(
    content || '<p></p>',
    presentStatBlockToken
  );

  useEffect(() => {
    onEditorReadyRef.current = onEditorReady;
  }, [onEditorReady]);

  const editor = useEditor({
    extensions: config.extensions,
    content: normalizedContent,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,

    onUpdate({editor}) {
      isInternalUpdate.current = true;
      onTypingActivity?.();

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
        const statBlockTarget = event.target.closest<HTMLElement>('[data-stat-block-token]');
        if (statBlockTarget) {
          const rawToken = statBlockTarget.dataset.statBlockToken;
          if (rawToken) {
            const rect = statBlockTarget.getBoundingClientRect();
            onStatBlockTokenClick?.(rawToken, {
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
      handleDOMEvents: {
        mouseover(_view, event) {
          if (!(event.target instanceof HTMLElement)) {
            return false;
          }
          const loreTarget = event.target.closest<HTMLElement>('[data-lore-id]');
          if (!loreTarget) {
            return false;
          }
          const loreId = loreTarget.dataset.loreId;
          if (!loreId) {
            return false;
          }
          const rect = loreTarget.getBoundingClientRect();
          onLoreHighlightHover?.(loreId, {
            left: rect.left,
            top: rect.top,
            bottom: rect.bottom
          });
          return false;
        },
        mouseout(_view, event) {
          if (!(event.target instanceof HTMLElement)) {
            return false;
          }
          const loreTarget = event.target.closest<HTMLElement>('[data-lore-id]');
          if (!loreTarget) {
            return false;
          }
          const relatedTarget = event.relatedTarget;
          if (
            relatedTarget instanceof Node &&
            loreTarget.contains(relatedTarget)
          ) {
            return false;
          }
          onLoreHighlightLeave?.();
          return false;
        }
      }
    }
  });

  useEffect(() => {
    if (editor) {
      onEditorReadyRef.current?.(editor);
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dom.setAttribute('spellcheck', 'false');
  }, [editor]);

  // keep external content in sync
  useEffect(() => {
    if (!editor || isInternalUpdate.current) return;

    const current = editor.getHTML();
    const next = content || '<p></p>';
    const normalizedNext = serializeStatBlockTokensAsChipHtml(
      next,
      presentStatBlockToken
    );

    if (current !== next && current !== normalizedNext) {
      editor.commands.setContent(next, {emitUpdate: false});
      onWordCountChange?.(getWordCount(editor));
    }
  }, [content, editor, onWordCountChange, presentStatBlockToken]);

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
      <MenuBar
        editor={editor}
        customButtons={toolbarButtons}
        actionButtons={toolbarActions}
      />
      <EditorContent
        editor={editor}
        className={`inline-highlights-mode-${inlineHighlightsMode}`}
      />
    </div>
  );
}

export default TipTapEditor;
