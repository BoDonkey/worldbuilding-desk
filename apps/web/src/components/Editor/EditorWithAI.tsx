import React, {useState, useEffect} from 'react';
import type {Editor as TipTapEditorInstance} from '@tiptap/react';
import TipTapEditor from '../TipTapEditor';
import {AIAssistant} from '../AIAssistant/AIAssistant';
import {AIExpandMenu} from './extensions/AIExpandMenu';
import styles from './EditorWithAI.module.css';

interface AIContextType {
  type: 'document';
  id: string;
  selectedText: string;
  from: number;
  to: number;
}

interface EditorWithAIProps {
  projectId: string;
  documentId: string;
  content: string;
  onChange: (content: string) => void;
}

export const EditorWithAI: React.FC<EditorWithAIProps> = ({
  projectId,
  documentId,
  content,
  onChange
}) => {
  const [showAI, setShowAI] = useState(false);
  const [aiContext, setAIContext] = useState<AIContextType | null>(null);
  const [editor, setEditor] = useState<TipTapEditorInstance | null>(null);

  useEffect(() => {
    const handleAIRequest = (event: Event) => {
      const customEvent = event as CustomEvent<{
        selectedText: string;
        from: number;
        to: number;
      }>;

      setAIContext({
        type: 'document',
        id: documentId,
        selectedText: customEvent.detail.selectedText,
        from: customEvent.detail.from,
        to: customEvent.detail.to
      });
      setShowAI(true);
    };

    window.addEventListener('ai-expand-request', handleAIRequest);
    return () => {
      window.removeEventListener('ai-expand-request', handleAIRequest);
    };
  }, [documentId]);

  const handleInsert = (text: string) => {
    if (editor && aiContext) {
      editor
        .chain()
        .focus()
        .setTextSelection({from: aiContext.from, to: aiContext.to})
        .insertContent(text)
        .run();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.editor}>
        <TipTapEditor
          content={content}
          onChange={onChange}
          onEditorReady={setEditor}
          extensions={[AIExpandMenu]}
        />
      </div>

      {showAI && (
        <div className={styles.aiPanel}>
          <button
            className={styles.closeButton}
            onClick={() => setShowAI(false)}
          >
            ×
          </button>
          <AIAssistant
            projectId={projectId}
            context={aiContext}
            onInsert={handleInsert}
          />
        </div>
      )}

      <button className={styles.aiToggle} onClick={() => setShowAI(!showAI)}>
        AI Assistant
      </button>
    </div>
  );
};
