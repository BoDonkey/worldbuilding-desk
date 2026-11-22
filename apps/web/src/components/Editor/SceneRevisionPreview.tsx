import {useEffect, useRef, useState} from 'react';
import type {Editor} from '@tiptap/core';
import {AIProposalPreview} from '../common/AIProposalPreview';
import {applySceneRevision, type SceneRevision} from '../../services/assistant/sceneRevision';
import {takeSceneSnapshot} from '../../services/editor/sceneSnapshots';
import {pushAppToast} from '../../store/notificationStore';

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
  const staleAlert = useRef<HTMLParagraphElement>(null);
  // The alert sits above the preview, which can be scrolled out of a short editor pane.
  useEffect(() => { if (stale) staleAlert.current?.scrollIntoView({block: 'nearest'}); }, [stale]);
  return <div ref={region} tabIndex={-1}>
    {stale && <p ref={staleAlert} role='alert'>The scene or selected text changed. Dismiss this preview and select the text again before preparing another revision.</p>}
    <AIProposalPreview
      title={proposal.range ? 'Replace selected scene text' : 'Append to the current scene'}
      text={proposal.text}
      beforeText={proposal.range ? proposal.selectedText : undefined}
      onDismiss={onClose}
      onConfirm={() => {
        const before = editor.getHTML();
        if (!applySceneRevision(editor, proposal, projectId, documentId)) {
          setStale(true);
          return;
        }
        // Slice 4.95: the scene as it was before the AI text, as an automatic snapshot.
        takeSceneSnapshot({projectId, sceneId: documentId, content: before, kind: 'before-ai'})
          .catch(() => pushAppToast({tone: 'error', message: 'The revision was applied, but the snapshot before it could not be saved.'}));
        onClose();
      }}
    />
  </div>;
}
