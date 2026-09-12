import {useMemo, useState} from 'react';
import type {ProjectAISettings, WritingDocument} from '../../entityTypes';
import type {StoryDashboard as StoryDashboardData} from '../../services/dashboard/storyDashboard';
import type {ProgressionContinuityCandidate} from '../../services/progressionContinuity/progressionContinuityCandidates';
import {buildProgressionContinuityConsultationPrompt} from '../../services/progressionContinuity/progressionContinuityConsultation';
import {
  parseProgressionContinuityVerdict,
  type ParsedProgressionContinuityVerdict
} from '../../services/progressionContinuity/progressionContinuityVerdict';
import {
  dismissProgressionContinuityCandidate,
  getDismissedProgressionContinuityKeys,
  restoreAllDismissedProgressionContinuityCandidates
} from '../../services/progressionContinuity/progressionContinuityReviewPrefs';
import {LLMService} from '../../services/llm/LLMService';
import {getInspectorConsultationUsage, incrementInspectorConsultationUsage} from '../../services/editor';
import {SourceScenes} from './StoryDashboard';
import styles from '../../styles/CorkboardRoute.module.css';
import {describeError} from '../../services/errors';

const KIND_LABELS: Record<ProgressionContinuityCandidate['kind'], string> = {
  unused_solution: 'Possible unused solution',
  abandoned_progression_method: 'Possible abandoned progression method'
};

const MAX_EXCERPT_CHARS = 1200;

interface ConsultationState {
  status: 'loading' | 'ready' | 'error';
  content?: string;
  verdict?: ParsedProgressionContinuityVerdict;
  error?: string;
}

interface ProgressionContinuitySectionProps {
  candidates: ProgressionContinuityCandidate[];
  documents: WritingDocument[];
  scenes: StoryDashboardData['scenes'];
  projectId: string;
  aiConfig?: ProjectAISettings;
  onOpenScene: (sceneId: string) => void;
}

export function ProgressionContinuitySection({
  candidates,
  documents,
  scenes,
  projectId,
  aiConfig,
  onOpenScene
}: ProgressionContinuitySectionProps) {
  const [dismissedKeys, setDismissedKeys] = useState(() => getDismissedProgressionContinuityKeys(projectId));
  const [consultationByKey, setConsultationByKey] = useState<Record<string, ConsultationState>>({});
  const [budgetUsed, setBudgetUsed] = useState(() => getInspectorConsultationUsage(projectId));

  const documentsById = useMemo(() => new Map(documents.map((document) => [document.id, document])), [documents]);
  const visibleCandidates = candidates.filter((candidate) => !dismissedKeys.has(candidate.key));
  const inspector = aiConfig?.inspectorSettings;
  const consultationEnabled = inspector?.enableAIConsultation !== false;
  const maxConsultations = inspector?.maxConsultationsPerDay ?? 20;

  const dismiss = (key: string) => {
    dismissProgressionContinuityCandidate(projectId, key);
    setDismissedKeys(getDismissedProgressionContinuityKeys(projectId));
  };

  const restoreAll = () => {
    restoreAllDismissedProgressionContinuityCandidates(projectId);
    setDismissedKeys(getDismissedProgressionContinuityKeys(projectId));
  };

  const consult = async (candidate: ProgressionContinuityCandidate) => {
    if (!aiConfig) {
      setConsultationByKey((prev) => ({
        ...prev,
        [candidate.key]: {status: 'error', error: 'Configure an AI provider in Settings first.'}
      }));
      return;
    }
    if (!consultationEnabled) {
      setConsultationByKey((prev) => ({
        ...prev,
        [candidate.key]: {status: 'error', error: 'AI consultation is disabled in Settings.'}
      }));
      return;
    }
    const used = getInspectorConsultationUsage(projectId);
    if (used >= maxConsultations) {
      setConsultationByKey((prev) => ({
        ...prev,
        [candidate.key]: {
          status: 'error',
          error: `AI consultation budget reached for today (${used}/${maxConsultations}).`
        }
      }));
      return;
    }

    setConsultationByKey((prev) => ({...prev, [candidate.key]: {status: 'loading'}}));

    try {
      const evidence = candidate.sourceSceneIds.flatMap((sceneId) => {
        const document = documentsById.get(sceneId);
        if (!document) return [];
        return [{
          sceneTitle: document.title || 'Untitled scene',
          excerpt: document.content.length > MAX_EXCERPT_CHARS
            ? `${document.content.slice(0, MAX_EXCERPT_CHARS)}...`
            : document.content
        }];
      });
      const {systemPrompt, userPrompt} = buildProgressionContinuityConsultationPrompt({candidate, evidence});

      const service = new LLMService(aiConfig);
      incrementInspectorConsultationUsage(projectId);
      setBudgetUsed(getInspectorConsultationUsage(projectId));

      let content = '';
      for await (const chunk of service.stream({
        messages: [{role: 'user', content: userPrompt}],
        systemPrompt,
        model: inspector?.lowCostModel?.trim() || undefined,
        maxTokens: inspector?.maxResponseTokens
      })) {
        content += chunk;
      }

      const verdict = parseProgressionContinuityVerdict(content) ?? undefined;
      setConsultationByKey((prev) => ({...prev, [candidate.key]: {status: 'ready', content, verdict}}));
    } catch (error) {
      setConsultationByKey((prev) => ({
        ...prev,
        [candidate.key]: {
          status: 'error',
          error: describeError(error, 'The consultation could not be completed.')
        }
      }));
    }
  };

  const dismissedCount = candidates.length - visibleCandidates.length;

  return (
    <section className={styles.dashboardSection} aria-labelledby='dashboard-progression-continuity'>
      <div className={styles.dashboardSectionHeader}>
        <div>
          <span className={styles.derivedEyebrow}>Author-triggered, model-assisted shortlist</span>
          <h2 id='dashboard-progression-continuity'>Progression continuity</h2>
        </div>
        <span className={styles.coachPanelMeta}>{budgetUsed}/{maxConsultations} today</span>
      </div>

      {candidates.length === 0 ? (
        <p className={styles.derivedEmpty}>
          No unused-solution or abandoned-progression-method candidates found from established
          abilities and labeled advancement events.
        </p>
      ) : visibleCandidates.length === 0 ? (
        <p className={styles.derivedEmpty}>
          All {candidates.length} candidate{candidates.length === 1 ? ' is' : 's are'} dismissed.{' '}
          <button type='button' className={styles.sceneLink} onClick={restoreAll}>
            Restore dismissed
          </button>
        </p>
      ) : (
        <div className={styles.observationList}>
          {visibleCandidates.map((candidate) => {
            const consultation = consultationByKey[candidate.key];
            return (
              <article key={candidate.key} className={styles.observation}>
                <div className={styles.observationHeader}>
                  <h3>{KIND_LABELS[candidate.kind]}: {candidate.subjectLabel}</h3>
                </div>
                <p>{candidate.detailText}</p>
                <SourceScenes sceneIds={candidate.sourceSceneIds} scenes={scenes} onOpenScene={onOpenScene} />

                <div className={styles.coachPanel} aria-busy={consultation?.status === 'loading'}>
                  {consultation?.status === 'error' ? (
                    <p className={styles.coachError} role='alert'>{consultation.error}</p>
                  ) : consultation?.content ? (
                    <>
                      {consultation.verdict ? (
                        <strong className={styles.coachPanelTitle}>
                          {consultation.verdict.verdict === 'finding'
                            ? 'Likely a genuine finding'
                            : 'Likely a false positive'}
                        </strong>
                      ) : null}
                      <div className={styles.coachResponse}>
                        {consultation.verdict?.rationale ?? consultation.content}
                      </div>
                    </>
                  ) : (
                    <p className={styles.coachHint}>
                      Ask the model to weigh the cited evidence and judge whether this looks like a
                      genuine instance of the pattern.
                    </p>
                  )}
                </div>

                <div className={styles.actionRow}>
                  <button
                    type='button'
                    onClick={() => void consult(candidate)}
                    disabled={consultation?.status === 'loading' || !consultationEnabled}
                  >
                    {consultation?.status === 'loading' ? 'Asking...' : 'Ask about this'}
                  </button>
                  <button type='button' onClick={() => dismiss(candidate.key)}>
                    Dismiss
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {dismissedCount > 0 && visibleCandidates.length > 0 && (
        <p className={styles.inputNote}>
          {dismissedCount} dismissed candidate{dismissedCount === 1 ? '' : 's'} hidden.{' '}
          <button type='button' className={styles.sceneLink} onClick={restoreAll}>
            Restore dismissed
          </button>
        </p>
      )}
    </section>
  );
}
