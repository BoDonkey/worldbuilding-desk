import {useEffect, useMemo, useState} from 'react';
import type {Editor} from '@tiptap/core';
import {AI_TEXT_MARK, clearAITextMark, selectionHasAIText} from '../extensions/AITextMark';
import {useWorkspaceUiStore} from '../store/workspaceUiStore';

interface AITextToolbarAction {
  id: string;
  label: string;
  onClick: () => void;
}

function documentHasAIText(editor: Editor): boolean {
  const markType = editor.schema.marks[AI_TEXT_MARK];
  if (!markType) return false;
  let found = false;
  editor.state.doc.descendants((node) => {
    if (found) return false;
    if (node.isText && markType.isInSet(node.marks)) found = true;
    return !found;
  });
  return found;
}

/**
 * Editor controls for AI-marked text: "Mark as my writing" when the
 * selection touches marked text, and a show/hide toggle for the highlight
 * when the scene contains any. Nothing appears in scenes without AI text.
 */
export function useAITextControls(editor: Editor | null): {
  actions: AITextToolbarAction[];
  highlight: boolean;
} {
  const showHighlight = useWorkspaceUiStore((state) => state.showAITextHighlight);
  const setShowHighlight = useWorkspaceUiStore((state) => state.setShowAITextHighlight);
  const [state, setState] = useState({hasAIText: false, selectionTouches: false});

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const next = {hasAIText: documentHasAIText(editor), selectionTouches: selectionHasAIText(editor)};
      setState((current) =>
        current.hasAIText === next.hasAIText && current.selectionTouches === next.selectionTouches ? current : next
      );
    };
    const onTransaction = ({transaction}: {transaction: {docChanged: boolean; selectionSet: boolean}}) => {
      if (transaction.docChanged || transaction.selectionSet) update();
    };
    update();
    editor.on('transaction', onTransaction);
    return () => {
      editor.off('transaction', onTransaction);
    };
  }, [editor]);

  const actions = useMemo<AITextToolbarAction[]>(() => {
    if (!editor || !state.hasAIText) return [];
    return [
      ...(state.selectionTouches
        ? [{id: 'ai-text-mark-mine', label: 'Mark as my writing', onClick: () => void clearAITextMark(editor)}]
        : []),
      {
        id: 'ai-text-highlight',
        label: showHighlight ? 'Hide AI text' : 'Show AI text',
        onClick: () => setShowHighlight(!showHighlight)
      }
    ];
  }, [editor, state, showHighlight, setShowHighlight]);

  return {actions, highlight: showHighlight};
}
