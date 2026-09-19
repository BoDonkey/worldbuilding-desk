import {useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router';
import type {
  AIProviderId,
  ProjectAISettings,
  WorldCanvasDocument,
  WorldCanvasLensKind
} from '../../entityTypes';
import {useAIProposalConfirmation} from '../../hooks/useAIProposalConfirmation';
import type {ConfirmRequest} from '../../hooks/useConfirmDialog';
import type {UseConsultationBudget} from '../../hooks/useConsultationBudget';
import {describeError} from '../../services/errors';
import {LLMService} from '../../services/llm/LLMService';
import {
  BRAINSTORM_INVALID_RESPONSE_MESSAGE,
  BRAINSTORM_ITEM_KIND_LABELS,
  brainstormFocusKey,
  buildWorldCanvasBrainstormPrompt,
  describeBrainstormFocus,
  parseWorldCanvasBrainstormResponse,
  type WorldCanvasBrainstormFocus
} from '../../services/worldBible/worldCanvasBrainstorm';
import {
  brainstormSessionKey,
  getBrainstormProviderIssue,
  getPendingBrainstormItems,
  getShownBrainstormTexts,
  handleBrainstormBeforeUnload,
  hasBrainstormDisclosure,
  markBrainstormDisclosed,
  setPendingBrainstormItems,
  type PendingBrainstormItem
} from '../../services/worldBible/worldCanvasBrainstormSession';
import {ConsultationBudgetNotice} from '../common/ConsultationBudgetNotice';
import styles from './WorldCanvasView.module.css';

const HOSTED_PROVIDER_NAMES: Readonly<Record<Exclude<AIProviderId, 'ollama'>, string>> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google'
};

interface WorldCanvasBrainstormProps {
  projectId: string;
  focus: WorldCanvasBrainstormFocus;
  canvas: WorldCanvasDocument;
  canonNames: string[];
  aiConfig?: ProjectAISettings;
  budget: UseConsultationBudget;
  requestConfirm: (request: ConfirmRequest) => void;
  onKeepAsSourceNote: (item: {
    lensKind?: WorldCanvasLensKind;
    kindLabel: string;
    text: string;
  }) => Promise<unknown>;
  onAddQuestion: (text: string, lensKind?: WorldCanvasLensKind) => void;
  onFeedback?: (feedback: {tone: 'success' | 'error'; message: string}) => void;
}

export function WorldCanvasBrainstorm({
  projectId,
  focus,
  canvas,
  canonNames,
  aiConfig,
  budget,
  requestConfirm,
  onKeepAsSourceNote,
  onAddQuestion,
  onFeedback
}: WorldCanvasBrainstormProps) {
  const key = brainstormSessionKey(projectId, focus);
  const lensKind = focus.type === 'lens' ? focus.kind : undefined;
  const focusLabel = describeBrainstormFocus(focus);
  const [items, setItems] = useState<PendingBrainstormItem[]>(() => getPendingBrainstormItems(key));
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [disclosed, setDisclosed] = useState(() => hasBrainstormDisclosure(projectId));

  const providerIssue = useMemo(() => getBrainstormProviderIssue(aiConfig), [aiConfig]);
  const inspector = aiConfig?.inspectorSettings;
  const consultationEnabled = inspector?.enableAIConsultation !== false;
  const provider = aiConfig?.provider;
  const disclosure = provider === 'ollama'
    ? 'Runs on your local Ollama model. Nothing leaves this computer.'
    : provider
      ? `Sends the premise, ${focus.type === 'lens' ? 'these lens notes, ' : ''}open questions, and World Bible record names to ${HOSTED_PROVIDER_NAMES[provider]}’s servers under that provider’s terms — only when you click, never in the background.`
      : null;

  useEffect(() => {
    setItems(getPendingBrainstormItems(key));
    setError(null);
  }, [key]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBrainstormBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBrainstormBeforeUnload);
  }, []);

  const updateItems = (next: PendingBrainstormItem[], newlyShown: string[] = []) => {
    setPendingBrainstormItems(key, next, newlyShown);
    setItems(next);
  };

  const removeItem = (id: string) => {
    updateItems(getPendingBrainstormItems(key).filter((item) => item.id !== id));
  };

  const ask = () => {
    if (status === 'loading' || !aiConfig || providerIssue) return;
    if (!consultationEnabled) {
      setError('AI consultation is disabled in Settings.');
      return;
    }
    if (budget.blocked) {
      setError(budget.blockedMessage ?? 'AI consultation budget reached for today.');
      return;
    }
    if (items.length > 0) {
      requestConfirm({
        title: 'Replace unreviewed ideas?',
        message: `${items.length} idea${items.length === 1 ? ' has' : 's have'} not been kept or dismissed. Asking again replaces ${items.length === 1 ? 'it' : 'them'}.`,
        confirmLabel: 'Replace',
        variant: 'danger',
        onConfirm: () => runRequest(aiConfig)
      });
      return;
    }
    void runRequest(aiConfig);
  };

  const runRequest = async (config: ProjectAISettings) => {
    setStatus('loading');
    setError(null);
    markBrainstormDisclosed(projectId);
    setDisclosed(true);
    try {
      const {systemPrompt, userPrompt} = buildWorldCanvasBrainstormPrompt({
        canvas,
        focus,
        canonNames,
        earlierItems: getShownBrainstormTexts(key)
      });
      const service = new LLMService(config);
      budget.spend('canvas-brainstorm');
      const response = await service.complete({
        messages: [{role: 'user', content: userPrompt}],
        systemPrompt,
        model: inspector?.lowCostModel?.trim() || undefined,
        maxTokens: inspector?.maxResponseTokens,
        responseFormat: 'json'
      });
      const parsed = parseWorldCanvasBrainstormResponse(response.content);
      updateItems(
        parsed.map((item) => ({...item, id: crypto.randomUUID()})),
        parsed.map((item) => item.text)
      );
    } catch (caught) {
      setError(describeError(caught, BRAINSTORM_INVALID_RESPONSE_MESSAGE, {
        context: 'world-canvas-brainstorm'
      }));
    } finally {
      setStatus('idle');
    }
  };

  const discardAll = () => {
    requestConfirm({
      title: 'Discard unreviewed ideas?',
      message: `${items.length} idea${items.length === 1 ? '' : 's'} will be discarded. Nothing was saved from ${items.length === 1 ? 'it' : 'them'}.`,
      confirmLabel: 'Discard',
      variant: 'danger',
      onConfirm: () => updateItems([])
    });
  };

  const headingId = `world-canvas-brainstorm-${brainstormFocusKey(focus).replace(':', '-')}`;
  const blocked = Boolean(providerIssue) || !consultationEnabled;

  return (
    <section className={styles.brainstorm} aria-labelledby={headingId} aria-busy={status === 'loading'}>
      <div className={styles.brainstormHeader}>
        <h5 id={headingId}>Brainstorm: {focusLabel}</h5>
        <button
          type='button'
          onClick={ask}
          disabled={status === 'loading' || blocked}
        >
          {status === 'loading' ? 'Asking...' : 'Ask for tensions and questions'}
        </button>
      </div>

      {providerIssue ? (
        <p className={styles.brainstormNote}>
          {providerIssue} <Link to='/settings'>Open Settings</Link>
        </p>
      ) : !consultationEnabled ? (
        <p className={styles.brainstormNote}>
          AI consultation is disabled in Settings. <Link to='/settings'>Open Settings</Link>
        </p>
      ) : (
        <>
          {!disclosed && disclosure && (
            <p className={styles.brainstormNote}>{disclosure}</p>
          )}
          <ConsultationBudgetNotice
            status={budget.status}
            isLocal={budget.isLocal}
            onGrantMore={budget.grantMore}
          />
        </>
      )}

      {error && <p className={styles.error} role='alert'>{error}</p>}

      {items.length > 0 && (
        <div className={styles.brainstormResults}>
          <div className={styles.brainstormResultsHeader}>
            <span className={styles.derivedLabel}>Suggested, not canon — keep only what you want</span>
            <button type='button' onClick={discardAll}>Discard all</button>
          </div>
          <ul className={styles.brainstormList} aria-label={`${focusLabel} brainstorm ideas`}>
            {items.map((item) => (
              <BrainstormItemRow
                key={item.id}
                item={item}
                onKeepAsSourceNote={async () => {
                  await onKeepAsSourceNote({
                    lensKind,
                    kindLabel: BRAINSTORM_ITEM_KIND_LABELS[item.kind],
                    text: item.text
                  });
                  removeItem(item.id);
                  onFeedback?.({tone: 'success', message: 'Brainstorm idea kept as a Source Note.'});
                }}
                onAddQuestion={(text) => {
                  onAddQuestion(text, lensKind);
                  removeItem(item.id);
                  onFeedback?.({tone: 'success', message: 'Brainstorm idea added as a question.'});
                }}
                onDismiss={() => removeItem(item.id)}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * One suggested idea. Keep actions follow the 1.5 proposal semantics: the app-owned action runs
 * only on an explicit author click, a second click while it runs is ignored, and a failure leaves
 * the idea in place with an error.
 */
function BrainstormItemRow({
  item,
  onKeepAsSourceNote,
  onAddQuestion,
  onDismiss
}: {
  item: PendingBrainstormItem;
  onKeepAsSourceNote: () => Promise<void>;
  onAddQuestion: (text: string) => void;
  onDismiss: () => void;
}) {
  const {confirm: keep, isConfirming, error} = useAIProposalConfirmation(onKeepAsSourceNote);
  const [rewrite, setRewrite] = useState<string | null>(null);
  // Only items the model phrased as questions go straight in; anything else must be rewritten by
  // the author first, so a question on the canvas is always either theirs or reviewed as one.
  const rewriteReady = rewrite !== null && Boolean(rewrite.trim()) && rewrite.trim() !== item.text.trim();

  return (
    <li className={styles.brainstormItem}>
      <span className={styles.brainstormKind}>{BRAINSTORM_ITEM_KIND_LABELS[item.kind]}</span>
      <p>{item.text}</p>
      {rewrite !== null && (
        <label className={styles.field}>
          Rewrite as a question
          <textarea rows={2} value={rewrite} onChange={(event) => setRewrite(event.target.value)} />
        </label>
      )}
      {error && <p className={styles.error} role='alert'>{error}</p>}
      <div className={styles.actionRow}>
        <button type='button' disabled={isConfirming} onClick={() => void keep()}>
          {isConfirming ? 'Keeping...' : 'Keep as Source Note'}
        </button>
        {item.kind === 'question' ? (
          <button type='button' onClick={() => onAddQuestion(item.text)}>Add as question</button>
        ) : rewrite !== null ? (
          <>
            <button type='button' disabled={!rewriteReady} onClick={() => onAddQuestion(rewrite)}>
              Add as question
            </button>
            <button type='button' onClick={() => setRewrite(null)}>Cancel rewrite</button>
          </>
        ) : (
          <button type='button' onClick={() => setRewrite(item.text)}>Rewrite as question</button>
        )}
        <button type='button' onClick={onDismiss} disabled={isConfirming}>Dismiss</button>
      </div>
    </li>
  );
}
