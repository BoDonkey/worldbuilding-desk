import {useEffect, useState} from 'react';
import {Link} from 'react-router';
import {useAppStore} from '../store/appStore';
import {PageHeader} from '../components/PageHeader';
import {AIAssistant} from '../components/AIAssistant/AIAssistant';
import {SourceNoteCapturePreview} from '../components/Editor/SourceNoteCapturePreview';
import {RouteFeedback} from '../components/common';
import {usePendingProposals} from '../hooks/usePendingProposals';
import type {RAGProvider} from '../services/rag/RAGService';
import {getRAGService} from '../services/rag/getRAGService';
import styles from '../styles/AskProjectRoute.module.css';

/**
 * **Ask your project** (roadmap 1.4): the project assistant as its own
 * destination. Factual questions go through the same evidence gate and saved
 * fact answers as the Workspace drawer; discussion can include pending
 * proposals only when the author asks, and they stay labeled pending. Replies
 * leave only through the shared Source Note capture preview.
 */
function AskProjectRoute() {
  const activeProject = useAppStore((state) => state.activeProject);
  const projectSettings = useAppStore((state) => state.projectSettings);
  const [includePending, setIncludePending] = useState(false);
  const pendingProposals = usePendingProposals(activeProject?.id ?? null, includePending);
  const [captureText, setCaptureText] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [ragService, setRagService] = useState<RAGProvider | null>(null);
  const [feedback, setFeedback] = useState<{tone: 'success' | 'error'; message: string} | null>(null);

  useEffect(() => {
    if (!activeProject) return;
    let cancelled = false;
    void getRAGService({
      projectId: activeProject.id,
      parentProjectId: activeProject.parentProjectId,
      inheritFromParent: activeProject.inheritRag
    })
      .then((service) => {
        if (!cancelled) setRagService(service);
      })
      .catch(() => {
        if (!cancelled) setRagService(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProject]);

  if (!activeProject) {
    return (
      <section className={styles.page}>
        <PageHeader
          eyebrow='Assistance'
          title='Ask your project'
          description='Open or create a project first to ask questions about it.'
        />
      </section>
    );
  }

  const pendingCount = pendingProposals?.proposals.length ?? 0;
  const inspector = projectSettings?.aiSettings?.inspectorSettings;

  return (
    <section className={styles.page}>
      <PageHeader
        eyebrow='Assistance'
        title='Ask your project'
        description='Ask about your story, characters, and world. Factual questions are answered only from accepted canon and saved scenes; when the answer is not there, it says so instead of guessing.'
      />
      <RouteFeedback feedback={feedback} onClear={() => setFeedback(null)} />
      <div className={styles.controls}>
        <label className={styles.toggle}>
          <input
            type='checkbox'
            checked={includePending}
            onChange={(event) => setIncludePending(event.target.checked)}
          />
          Include pending proposals
        </label>
        <p className={styles.hint}>
          {includePending
            ? `${pendingCount} pending proposal${pendingCount === 1 ? '' : 's'} from Source Notes can come up in discussion, always labeled as not yet accepted. Factual answers still use accepted canon only. `
            : 'Off: only accepted canon, saved scenes, and Source Notes inform answers. Turn this on to talk through proposals you have not accepted yet. '}
          <Link to='/canon-decisions'>Review proposals in Canon Review</Link>
        </p>
      </div>
      <div className={styles.assistant}>
        <AIAssistant
          projectId={activeProject.id}
          parentProjectId={activeProject.parentProjectId}
          inheritRag={activeProject.inheritRag}
          inheritShodh={activeProject.inheritShodh}
          aiConfig={projectSettings?.aiSettings}
          projectMode={projectSettings?.projectMode}
          conversationScope='ask'
          pendingProposals={includePending ? pendingProposals : null}
          onCaptureSourceNote={setCaptureText}
          placeholder='Ask about your characters, places, and story so far…'
          showWritingCoach={false}
          consultationModel={inspector?.lowCostModel}
          consultationMaxTokens={inspector?.maxResponseTokens}
        />
      </div>
      {captureText !== null && (
        <SourceNoteCapturePreview
          projectId={activeProject.id}
          sessionId={sessionId}
          text={captureText}
          ragService={ragService}
          onClose={() => setCaptureText(null)}
          onCaptured={(title) =>
            setFeedback({
              tone: 'success',
              message: `Saved "${title}" as a draft Source Note. Review and extract it from Source Notes when ready.`
            })
          }
        />
      )}
    </section>
  );
}

export default AskProjectRoute;
