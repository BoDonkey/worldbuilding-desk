import type {RefObject} from 'react';
import type {Editor as TipTapEditorInstance} from '@tiptap/react';
import styles from '../../assets/components/Editor.module.css';
import {
  normalizeSelectionSurface,
  type SelectionMenuState,
  type SelectionQuickSnippetLookup
} from '../../hooks/useEditorSelectionMenu';
import type {EditorContextPopoverControls} from '../../hooks/useEditorContextPopovers';
import type {LoreInspectorRecord} from '../../services/workspace/workspaceConsultation';
import {SelectionMenuAIEntries, type EditorSelectionActions} from './SelectionMenuAIEntries';
import {requestPassageRewrite} from '../../hooks/usePassageRewrite';

/** A selected passage handed to the assistant as context. */
export interface EditorAIContext {
  type: 'document';
  id: string;
  selectedText: string;
  from: number;
  to: number;
}

/**
 * The menu over a text selection: AI entries, then record actions (stat
 * preview and snapshot for a character, lore snippet, quick and full lore),
 * Add to World, and Record item/state. `useEditorSelectionMenu` owns where it
 * sits and when it is open.
 */
export function EditorSelectionMenu({
  selection,
  menuRef,
  setSelection,
  closeMenu,
  editorRef,
  documentId,
  quickSnippets,
  selectionActions,
  popovers,
  onOpenAIContext,
  onOpenLoreInspector,
  onOpenWorldCapture,
  onAddSelectionToInventory
}: {
  selection: SelectionMenuState;
  menuRef: RefObject<HTMLDivElement | null>;
  setSelection: (selection: SelectionMenuState | null) => void;
  closeMenu: () => void;
  editorRef: RefObject<TipTapEditorInstance | null>;
  documentId: string;
  quickSnippets?: SelectionQuickSnippetLookup;
  selectionActions?: EditorSelectionActions;
  popovers: Pick<EditorContextPopoverControls, 'showLoreRecord' | 'setStatBlockPopover'>;
  onOpenAIContext?: (context: EditorAIContext, prompt?: string | null) => void;
  onOpenLoreInspector?: (record: LoreInspectorRecord) => void;
  onOpenWorldCapture?: (
    draftText: string,
    anchorRect: {left: number; top: number; bottom: number}
  ) => void;
  onAddSelectionToInventory?: (input: {itemName: string; from: number; to: number}) => void;
}) {
  /** Replaces the selection with the matched record's quick snippet. */
  const insertSelectionSnippet = (kind: 'characters' | 'entities') => {
    const editor = editorRef.current;
    const key = normalizeSelectionSurface(selection.selectedText);
    const snippet = key ? quickSnippets?.[kind][key]?.html : null;
    if (!snippet || !editor) return;
    editor.commands.setTextSelection({from: selection.from, to: selection.to});
    editor.commands.insertContent(snippet);
    setSelection(null);
  };

  return (
    <div
      ref={menuRef}
      data-escape-layer=''
      className={styles.selectionBubble}
      style={{
        left: `${selection.x}px`,
        top: `${selection.y}px`
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <button
        type='button'
        onClick={() => {
          requestPassageRewrite({documentId, range: {from: selection.from, to: selection.to}});
          closeMenu();
        }}
      >
        Rewrite beside original
      </button>
      <SelectionMenuAIEntries controls={selectionActions} selection={selection}
        onAskAI={onOpenAIContext && (() => onOpenAIContext({type: 'document', id: documentId,
          selectedText: selection.selectedText, from: selection.from, to: selection.to}))}
        getPassage={() => editorRef.current?.state.doc.textBetween(selection.from, selection.to, '\n\n') ?? ''}
        onDone={closeMenu} />
      {selection.matchType === 'character' && (
        <button
          type='button'
          onClick={() => {
            if (!selection.matchRecord) return;
            popovers.setStatBlockPopover({
              preview: {
                rawToken: selection.matchName ?? selection.selectedText,
                title: `${selection.matchRecord.name} · Quick Preview`,
                sourceType: 'character',
                style: 'compact',
                status: 'resolved',
                message: 'Quick character snapshot from the current workspace state.',
                html: selection.matchRecord.html,
                requiresRebind: false
              },
              left: selection.x,
              top: selection.y + 12
            });
          }}
        >
          Preview Stats
        </button>
      )}
      {selection.matchType === 'character' && (
        <button type='button' onClick={() => insertSelectionSnippet('characters')}>
          Insert Stat Snapshot
        </button>
      )}
      {selection.matchType === 'entity' && (
        <button type='button' onClick={() => insertSelectionSnippet('entities')}>
          Insert Lore Snippet
        </button>
      )}
      {selection.matchRecord && (
        <button
          type='button'
          onClick={() => {
            popovers.showLoreRecord(selection.matchRecord?.lore ?? null, {
              left: selection.x,
              top: selection.y + 12
            });
          }}
        >
          Quick Lore
        </button>
      )}
      {selection.matchRecord && (
        <button
          type='button'
          onClick={() => {
            if (!selection.matchRecord?.lore) return;
            onOpenLoreInspector?.(selection.matchRecord.lore);
          }}
        >
          Open Lore
        </button>
      )}
      {!selection.matchRecord && (
        <button
          type='button'
          onClick={() => {
            onOpenWorldCapture?.(selection.selectedText, {
              left: selection.x,
              top: selection.y,
              bottom: selection.y + 12
            });
            setSelection(null);
          }}
        >
          Add to World
        </button>
      )}
      {onAddSelectionToInventory && (
        <button
          type='button'
          onClick={() => {
            onAddSelectionToInventory({
              itemName: selection.selectedText,
              from: selection.from,
              to: selection.to
            });
            setSelection(null);
          }}
        >
          Record item/state
        </button>
      )}
      {selection.matchName && (
        <span className={styles.selectionHint}>{selection.matchName}</span>
      )}
    </div>
  );
}
