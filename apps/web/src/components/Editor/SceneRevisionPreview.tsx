import {useEffect, useRef, useState} from 'react';
import type {Editor} from '@tiptap/core';
import {AIProposalPreview} from '../common/AIProposalPreview';
import {applySceneRevision, type SceneRevision} from '../../services/assistant/sceneRevision';

export function SceneRevisionPreview({editor, proposal, projectId, documentId, onClose}: {
  editor: Editor;
  proposal: SceneRevision;
  projectId: string;
  documentId: string;
  onClose: () => void;
}) {
  const region = useRef<HTMLDivElement>(null);
  const [stale, setStale] = useState(false);
  useEffect(() => { region.current?.focus(); region.current?.scrollIntoView({block: 'nearest'}); }, []);
  return <div ref={region} tabIndex={-1}>
    {stale && <p role='alert'>The scene or selected text changed. Dismiss this preview and select the text again before preparing another revision.</p>}
    <AIProposalPreview
      title={proposal.range ? 'Replace selected scene text' : 'Append to the current scene'}
      text={proposal.text}
      beforeText={proposal.range ? proposal.selectedText : undefined}
      onDismiss={onClose}
      onConfirm={() => {
        if (!applySceneRevision(editor, proposal, projectId, documentId)) {
          setStale(true);
          return;
        }
        onClose();
      }}
    />
  </div>;
}
