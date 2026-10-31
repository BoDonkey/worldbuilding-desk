import {useEffect, useId, useRef, useState} from 'react';
import {AIProposalPreview} from '../common/AIProposalPreview';
import {saveDraftSourceNoteFromAssistantOutput} from '../../services/lore/sourceNoteCapture';
import type {RAGProvider} from '../../services/rag/RAGService';
import styles from '../../assets/components/common/AIProposalPreview.module.css';

/**
 * The author reviews and edits what will be saved (Slice 5.17): the question
 * and the reply shown arrive as a transcript, and only the edited text is
 * saved, as a draft Source Note, never canon.
 */
export function SourceNoteCapturePreview({projectId, sessionId, text, ragService, onClose, onCaptured}: {
  projectId: string;
  sessionId: string;
  text: string;
  ragService: RAGProvider | null;
  onClose: () => void;
  onCaptured: (title: string) => void;
}) {
  const region = useRef<HTMLDivElement>(null);
  const fieldId = useId();
  const [draft, setDraft] = useState(text);
  const [emptyError, setEmptyError] = useState(false);
  useEffect(() => { region.current?.focus(); region.current?.scrollIntoView({block: 'nearest'}); }, []);
  // A newer capture replaces the draft under review.
  useEffect(() => { setDraft(text); setEmptyError(false); }, [text]);
  return <div ref={region} tabIndex={-1}>
    <AIProposalPreview
      title='Save as draft Source Note'
      onDismiss={onClose}
      onConfirm={async () => {
        if (!draft.trim()) {
          setEmptyError(true);
          return;
        }
        const document = await saveDraftSourceNoteFromAssistantOutput({
          projectId,
          sessionId,
          content: draft,
          ragService
        });
        onCaptured(document.title);
        onClose();
      }}
    >
      <label htmlFor={fieldId}>Source Note text (edit before saving)</label>
      <textarea
        id={fieldId}
        className={styles.aiHelperProposalField}
        value={draft}
        rows={8}
        onChange={(event) => { setDraft(event.target.value); setEmptyError(false); }}
      />
      {emptyError && <p role='alert'>Add some text to save as a Source Note.</p>}
    </AIProposalPreview>
  </div>;
}
