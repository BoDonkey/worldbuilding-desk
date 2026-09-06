import {useEffect, useRef} from 'react';
import {AIProposalPreview} from '../common/AIProposalPreview';
import {saveDraftSourceNoteFromAssistantOutput} from '../../services/lore/sourceNoteCapture';
import type {RAGProvider} from '../../services/rag/RAGService';

export function SourceNoteCapturePreview({projectId, sessionId, text, ragService, onClose, onCaptured}: {
  projectId: string;
  sessionId: string;
  text: string;
  ragService: RAGProvider | null;
  onClose: () => void;
  onCaptured: (title: string) => void;
}) {
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => { region.current?.focus(); region.current?.scrollIntoView({block: 'nearest'}); }, []);
  return <div ref={region} tabIndex={-1}>
    <AIProposalPreview
      title='Save as draft Source Note'
      text={text}
      onDismiss={onClose}
      onConfirm={async () => {
        const document = await saveDraftSourceNoteFromAssistantOutput({
          projectId,
          sessionId,
          content: text,
          ragService
        });
        onCaptured(document.title);
        onClose();
      }}
    />
  </div>;
}
