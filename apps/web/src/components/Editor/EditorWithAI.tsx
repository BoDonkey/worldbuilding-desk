import React, {useState, useEffect, useRef} from 'react';
import type {Editor as TipTapEditorInstance} from '@tiptap/react';
import TipTapEditor from '../TipTapEditor';
import {AIAssistant} from '../AIAssistant/AIAssistant';
import {AIExpandMenu} from './extensions/AIExpandMenu';
import type {EditorConfig} from '../../config/editorConfig';
import type {ProjectAISettings, ProjectMode} from '../../entityTypes';
import styles from '../../assets/components/AISettings.module.css';

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
  config?: EditorConfig;
  toolbarButtons?: Array<{id: string; label: string; markName: string}>;
  aiSettings?: ProjectAISettings | null;
  projectMode?: ProjectMode;
}

export const EditorWithAI: React.FC<EditorWithAIProps> = ({
  projectId,
  documentId,
  content,
  onChange,
  config,
  toolbarButtons = [],
  aiSettings,
  projectMode = 'litrpg'
}) => {
  const [showAI, setShowAI] = useState(false);
  const [aiContext, setAIContext] = useState<AIContextType | null>(null);
  const [textToInsert, setTextToInsert] = useState<string | null>(null);
  const editorRef = useRef<TipTapEditorInstance | null>(null);

  // Merge AIExpandMenu with config extensions
  const mergedConfig = config
    ? {
        ...config,
        extensions: [...config.extensions, AIExpandMenu]
      }
    : undefined;

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

  useEffect(() => {
    return () => {
      editorRef.current = null;
    };
  }, []);

  const handleInsert = (text: string) => {
    console.log('handleInsert called with:', text);
    const editor = editorRef.current;

    if (!editor) {
      console.error('No editor instance');
      return;
    }

    console.log('Editor state:', {
      isDestroyed: editor.isDestroyed,
      hasView: !!editor.view,
      canInsert: editor.can().insertContent(text),
      currentPos: editor.state.selection.$from.pos
    });

    if (aiContext) {
      console.log('Inserting at selection:', aiContext.from, aiContext.to);
      const result = editor.commands.setTextSelection({
        from: aiContext.from,
        to: aiContext.to
      });
      console.log('Selection set?', result);
      const insertResult = editor.commands.insertContent(text);
      console.log('Insert result?', insertResult);
    } else {
      console.log('Inserting at cursor');
      setTextToInsert(text);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.editor}>
        <TipTapEditor
          content={content}
          onChange={onChange}
          onEditorReady={(editorInstance) => {
            editorRef.current = editorInstance;
          }}
          config={mergedConfig}
          toolbarButtons={toolbarButtons}
          textToInsert={textToInsert}
          onTextInserted={() => setTextToInsert(null)}
          insertContext={aiContext}
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
            aiConfig={aiSettings ?? undefined}
            projectMode={projectMode}
            context={aiContext ?? undefined}
            onInsert={handleInsert}
          />
        </div>
      )}

      {!showAI && (
        <button className={styles.aiToggle} onClick={() => setShowAI(true)}>
          AI Assistant
        </button>
      )}
    </div>
  );
};
