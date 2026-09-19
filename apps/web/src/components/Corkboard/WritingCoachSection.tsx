import {useState} from 'react';
import type {StoryDashboard as StoryDashboardData} from '../../services/dashboard/storyDashboard';
import {
  buildCraftContextChunks,
  buildWritingCoachPrompt,
  dedupeCraftCitations,
  summarizeStoryDashboardForCoach
} from '../../services/coach/writingCoachConsultation';
import {LLMService} from '../../services/llm/LLMService';
import type {ProjectAISettings} from '../../entityTypes';
import {useConsultationBudget} from '../../hooks/useConsultationBudget';
import {ConsultationBudgetNotice} from '../common/ConsultationBudgetNotice';
import {getCraftLibraryService} from '../../services/craft/getCraftLibraryService';
import {getRAGService} from '../../services/rag/getRAGService';
import type {CraftCitation} from '../../services/craft/types';
import {CraftCitationList} from '../CraftCitationList';
import {AIProposalPreview} from '../common/AIProposalPreview';
import {saveDraftSourceNoteFromAssistantOutput} from '../../services/lore/sourceNoteCapture';
import styles from '../../styles/CorkboardRoute.module.css';
import {describeError} from '../../services/errors';

/** Base retrieval query for the manuscript-wide coach: the dashboard's evidence is aggregate
 * numbers, not prose, so a fixed structural query finds relevant patterns better than searching
 * on the numbers themselves. */
const BASE_SEARCH_QUERY = 'story structure pacing chapter rhythm scene rhythm continuity distribution';
const MECHANICS_SEARCH_QUERY = 'progression advancement rate mechanics pacing';

interface WritingCoachSectionProps {
  dashboard: StoryDashboardData;
  projectId: string;
  aiConfig?: ProjectAISettings;
}

export function WritingCoachSection({dashboard, projectId, aiConfig}: WritingCoachSectionProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [response, setResponse] = useState<{content: string; craftCitations: CraftCitation[]} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedNoteTitle, setSavedNoteTitle] = useState<string | null>(null);
  const [noteDismissed, setNoteDismissed] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());

  const inspector = aiConfig?.inspectorSettings;
  const consultationEnabled = inspector?.enableAIConsultation !== false;
  const budget = useConsultationBudget(projectId, inspector, aiConfig?.provider);
  const hasEvidence = dashboard.scenes.length > 0;

  const askCoach = async () => {
    if (!aiConfig) {
      setStatus('error');
      setError('Configure an AI provider in Settings first.');
      return;
    }
    if (!consultationEnabled) {
      setStatus('error');
      setError('AI consultation is disabled in Settings.');
      return;
    }
    if (budget.blocked) {
      setStatus('error');
      setError(budget.blockedMessage ?? 'AI consultation budget reached for today.');
      return;
    }

    setStatus('loading');
    setError(null);
    setSavedNoteTitle(null);
    setNoteDismissed(false);

    try {
      const evidence = summarizeStoryDashboardForCoach(dashboard);
      const searchQuery = dashboard.mechanics
        ? `${BASE_SEARCH_QUERY} ${MECHANICS_SEARCH_QUERY}`
        : BASE_SEARCH_QUERY;
      const craftLibrary = await getCraftLibraryService();
      const craftResults = await craftLibrary.search(searchQuery, 4);
      const craftContext = buildCraftContextChunks(craftResults);
      const craftCitations = dedupeCraftCitations(craftResults);
      const {systemPrompt, userPrompt} = buildWritingCoachPrompt({
        scope: 'manuscript',
        evidenceLabel: 'Deterministic manuscript measurements (not full prose)',
        evidenceText: evidence
      });

      const service = new LLMService(aiConfig);
      budget.spend('writing-coach');

      let content = '';
      setResponse({content: '', craftCitations});
      setStatus('ready');
      for await (const chunk of service.stream({
        messages: [{role: 'user', content: userPrompt}],
        context: craftContext,
        systemPrompt,
        model: inspector?.lowCostModel?.trim() || undefined,
        maxTokens: inspector?.maxResponseTokens
      })) {
        content += chunk;
        setResponse({content, craftCitations});
      }
    } catch (askError) {
      setStatus('error');
      setError(describeError(askError, 'The writing coach could not be reached.'));
    }
  };

  return (
    <section className={styles.dashboardSection} aria-labelledby='dashboard-coach'>
      <div className={styles.dashboardSectionHeader}>
        <div>
          <span className={styles.derivedEyebrow}>Author-triggered, model-assisted</span>
          <h2 id='dashboard-coach'>Writing coach</h2>
        </div>
      </div>

      <div className={styles.coachPanel} aria-busy={status === 'loading'}>
        <div className={styles.coachPanelHeader}>
          <strong className={styles.coachPanelTitle}>Ask about this manuscript&apos;s shape</strong>
          <span className={styles.coachPanelMeta}>
            {budget.isLocal ? 'Local model' : `${budget.status.used}/${budget.status.limit} today`}
          </span>
        </div>

        {!hasEvidence ? (
          <p className={styles.coachHint}>Add a scene in Workspace before asking the coach.</p>
        ) : status === 'error' && error ? (
          <p className={styles.coachError} role='alert'>{error}</p>
        ) : response ? (
          <>
            <div className={styles.coachResponse}>{response.content}</div>
            {response.craftCitations.length > 0 && (
              <details>
                <summary>Craft reference material (not your canon)</summary>
                <CraftCitationList citations={response.craftCitations} />
              </details>
            )}
          </>
        ) : (
          <p className={styles.coachHint}>
            Pairs cited craft patterns with this dashboard&apos;s own measurements - word/dialogue
            counts, chapter rollups, continuity distribution, and mechanics rates. It never reads
            raw scene prose for this manuscript-wide question.
          </p>
        )}

        <ConsultationBudgetNotice
          status={budget.status}
          isLocal={budget.isLocal}
          onGrantMore={budget.grantMore}
          hidden={!consultationEnabled || !hasEvidence}
        />

        <div className={styles.actionRow}>
          <button
            type='button'
            onClick={() => void askCoach()}
            disabled={status === 'loading' || !hasEvidence || !consultationEnabled}
          >
            {status === 'loading' ? 'Asking the coach...' : 'Ask the coach'}
          </button>
        </div>

        {response && response.content && status !== 'loading' && !noteDismissed && (
          savedNoteTitle ? (
            <p className={styles.coachHint}>Saved as Source Note &quot;{savedNoteTitle}&quot;.</p>
          ) : (
            <AIProposalPreview
              title='Save this note as a draft Source Note'
              text={response.content}
              onDismiss={() => setNoteDismissed(true)}
              onConfirm={async () => {
                const ragService = await getRAGService(projectId).catch(() => null);
                const document = await saveDraftSourceNoteFromAssistantOutput({
                  projectId,
                  sessionId,
                  content: response.content,
                  ragService
                });
                setSavedNoteTitle(document.title);
              }}
            />
          )
        )}
      </div>
    </section>
  );
}
