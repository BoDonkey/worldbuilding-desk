import {useMemo, useState} from 'react';
import {Link} from 'react-router';
import type {ProjectAISettings} from '../../entityTypes';
import type {ConsistencyAlias} from '../../services/consistency/aliasStorage';
import {
  buildCraftContextChunks,
  dedupeCraftCitations
} from '../../services/coach/writingCoachConsultation';
import {getCraftLibraryService} from '../../services/craft/getCraftLibraryService';
import type {CraftCitation} from '../../services/craft/types';
import {describeError} from '../../services/errors';
import {LLMService} from '../../services/llm/LLMService';
import type {UseConsultationBudget} from '../../hooks/useConsultationBudget';
import {useModelRun} from '../../hooks/useModelRun';
import type {CanvasReference} from '../../services/worldBible/worldCanvasDerived';
import {
  CANVAS_COACHING_ACTION_LABELS,
  CANVAS_COACHING_INVALID_RESPONSE_MESSAGE,
  CANVAS_COACHING_STOPPED_MESSAGE,
  WorldCanvasCoachingResponseError,
  buildSelectedCanvasReferenceLines,
  buildWorldCanvasCoachingPrompt,
  buildWorldCanvasCraftSearchQuery,
  canvasCoachingResponseTokens,
  parseWorldCanvasCoachingResponse,
  selectApplicableCanvasCraftResults,
  type WorldCanvasCoachingAction,
  type WorldCanvasCoachingFocus,
  type WorldCanvasCoachingProposal,
  type WorldCanvasCoachingResponse
} from '../../services/worldBible/worldCanvasCoaching';
import {AIProposalPreview} from '../common/AIProposalPreview';
import {ConsultationBudgetNotice} from '../common/ConsultationBudgetNotice';
import {ModelRunProgress} from '../common/ModelRunProgress';
import {CraftCitationList} from '../CraftCitationList';
import styles from './WorldCanvasView.module.css';
import {HOSTED_PROVIDER_NAMES} from '../../services/llm/providerConfig';

interface CoachingResult {
  action: WorldCanvasCoachingAction;
  data: WorldCanvasCoachingResponse;
  focusText: string;
  citations: CraftCitation[];
  selectedReferences: string[];
}

interface WorldCanvasCoachingProps {
  focus: WorldCanvasCoachingFocus;
  focusLabel: string;
  focusText: string;
  paletteReferences: CanvasReference[];
  aliases: ConsistencyAlias[];
  aiConfig?: ProjectAISettings;
  budget: UseConsultationBudget;
  onApplyProposal: (expectedFocusText: string, proposal: WorldCanvasCoachingProposal) => Promise<unknown>;
  onFeedback?: (feedback: {tone: 'success' | 'error'; message: string}) => void;
}

export function WorldCanvasCoaching({
  focus,
  focusLabel,
  focusText,
  paletteReferences,
  aliases,
  aiConfig,
  budget,
  onApplyProposal,
  onFeedback
}: WorldCanvasCoachingProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<CoachingResult | null>(null);
  const [proposalDismissed, setProposalDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectedReply, setRejectedReply] = useState<string | null>(null);
  const modelRun = useModelRun();
  const inspector = aiConfig?.inspectorSettings;
  const consultationEnabled = inspector?.enableAIConsultation !== false;

  const providerIssue = useMemo(() => {
    if (!aiConfig) return 'AI provider is not configured. Add one in Settings to use Canvas coaching.';
    try {
      new LLMService(aiConfig);
      return null;
    } catch (providerError) {
      return describeError(providerError, 'AI provider is not configured. Add one in Settings to use Canvas coaching.', {record: false});
    }
  }, [aiConfig]);

  const references = useMemo(() => paletteReferences.filter((reference) =>
    reference.existence === 'available' && (
      focus.type === 'premise' ||
      reference.lensKinds.length === 0 ||
      reference.lensKinds.includes(focus.kind)
    )
  ), [focus, paletteReferences]);
  const selectedReferences = references.filter((reference) =>
    selectedIds.has(`${reference.sourceType}:${reference.id}`)
  );

  const disclosure = budget.route.kind === 'private-local'
    ? 'Runs locally. The focused Canvas text, selected reference names or titles, and craft excerpts stay on this computer.'
    : budget.route.kind !== 'hosted'
      ? budget.route.reason ?? null
      : aiConfig?.provider && aiConfig.provider !== 'ollama'
      ? `Sends the focused Canvas text, selected reference names or titles, and retrieved craft excerpts to ${HOSTED_PROVIDER_NAMES[aiConfig.provider]}’s servers only when you choose an action. Source Note text and manuscript prose are not sent.`
      : null;

  const runCoaching = async (action: WorldCanvasCoachingAction) => {
    if (!aiConfig || providerIssue || modelRun.isRunning || !focusText.trim()) return;
    if (!consultationEnabled) {
      setError('AI consultation is disabled in Settings.');
      return;
    }
    if (budget.blocked) {
      setError(budget.blockedMessage ?? 'AI consultation budget reached for today.');
      return;
    }
    setError(null);
    setRejectedReply(null);
    setResult(null);
    setProposalDismissed(false);
    try {
      const craftLibrary = await getCraftLibraryService();
      const query = buildWorldCanvasCraftSearchQuery({action, focus, focusText});
      const craftResults = selectApplicableCanvasCraftResults(await craftLibrary.search(query, 12), 4);
      if (!craftResults.length) {
        throw new Error('No applicable vetted craft references were found for this coaching request.');
      }
      const selectedReferenceLines = buildSelectedCanvasReferenceLines(
        selectedReferences.map((reference) => ({
          id: reference.id,
          sourceType: reference.sourceType,
          label: reference.label
        })),
        aliases
      );
      const prompt = buildWorldCanvasCoachingPrompt({
        action,
        focus,
        focusText,
        selectedReferenceLines
      });
      const citations = dedupeCraftCitations(craftResults);
      const service = new LLMService(aiConfig);
      budget.spend('canvas-coach');
      const run = await modelRun.run(service, {
        messages: [{role: 'user', content: prompt.userPrompt}],
        context: buildCraftContextChunks(craftResults),
        systemPrompt: prompt.systemPrompt,
        model: inspector?.lowCostModel?.trim() || undefined,
        maxTokens: canvasCoachingResponseTokens(aiConfig.provider, inspector?.maxResponseTokens),
        responseFormat: 'json',
        cache: false
      });
      if (run.stopped) {
        setError(CANVAS_COACHING_STOPPED_MESSAGE);
        return;
      }
      const data = parseWorldCanvasCoachingResponse(run.answer, action);
      setResult({
        action,
        data,
        focusText,
        citations,
        selectedReferences: selectedReferenceLines
      });
    } catch (caught) {
      if (caught instanceof WorldCanvasCoachingResponseError && caught.reply.trim()) {
        setRejectedReply(caught.reply);
      }
      setError(describeError(caught, CANVAS_COACHING_INVALID_RESPONSE_MESSAGE, {
        context: 'world-canvas-coaching'
      }));
    }
  };

  const toggleReference = (reference: CanvasReference) => {
    const key = `${reference.sourceType}:${reference.id}`;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const proposalTitle = result?.data.proposal.kind === 'replacement'
    ? `Replace this ${focusLabel} text`
    : 'Keep this as an Open Thread';

  return <details className={styles.canvasCoach}>
    <summary>Craft-guided coaching</summary>
    <div className={styles.canvasCoachBody} aria-busy={modelRun.isRunning}>
      <p className={styles.brainstormNote}>Optional, author-triggered guidance grounded in the vetted craft library. Advice remains a proposal until you confirm it.</p>

      {providerIssue ? (
        <p className={styles.brainstormNote}>{providerIssue} <Link to='/settings'>Open Settings</Link></p>
      ) : !consultationEnabled ? (
        <p className={styles.brainstormNote}>AI consultation is disabled in Settings. <Link to='/settings'>Open Settings</Link></p>
      ) : (
        <>
          {disclosure && <p className={styles.coachingDisclosure}>{disclosure}</p>}
          <ConsultationBudgetNotice status={budget.status} isLocal={budget.isLocal} onGrantMore={budget.grantMore} />
        </>
      )}

      {references.length > 0 && <fieldset className={styles.referenceSelection}>
        <legend>Project references to include (optional)</legend>
        <p>Nothing is selected by default. World Bible references send names and aliases only; Source Notes send titles only, never their text.</p>
        <div className={styles.referenceSelectionList}>{references.map((reference) => {
          const key = `${reference.sourceType}:${reference.id}`;
          return <label key={key}>
            <input type='checkbox' checked={selectedIds.has(key)} onChange={() => toggleReference(reference)} />
            <span>{reference.label} <small>{reference.sourceType === 'world-bible' ? 'Accepted canon' : 'Source material'}</small></span>
          </label>;
        })}</div>
      </fieldset>}

      <div className={styles.coachingActions}>
        {(Object.entries(CANVAS_COACHING_ACTION_LABELS) as [WorldCanvasCoachingAction, string][]).map(([action, label]) => (
          <button key={action} type='button' disabled={Boolean(providerIssue) || !consultationEnabled || modelRun.isRunning || !focusText.trim()} onClick={() => void runCoaching(action)}>
            {label}
          </button>
        ))}
      </div>

      <ModelRunProgress run={modelRun} />
      {error && <p className={styles.error} role='alert'>{error}</p>}
      {rejectedReply && <details className={styles.rejectedReply}>
        <summary>Show the model’s reply</summary>
        <pre>{rejectedReply}</pre>
      </details>}

      {result && <div className={styles.coachingResult}>
        <span className={styles.derivedLabel}>Craft guidance — not canon</span>
        <ul>{result.data.observations.map((observation) => <li key={`${observation.pattern}:${observation.application}`}><strong>{observation.pattern}</strong><p>{observation.application}</p></li>)}</ul>
        {result.selectedReferences.length > 0 && <details>
          <summary>Selected project references sent ({result.selectedReferences.length})</summary>
          <ul>{result.selectedReferences.map((reference) => <li key={reference}>{reference}</li>)}</ul>
        </details>}
        {result.citations.length > 0 && <details>
          <summary>Craft reference material (not your canon)</summary>
          <CraftCitationList citations={result.citations} />
        </details>}
      </div>}

      {result && !proposalDismissed && <AIProposalPreview
        title={proposalTitle}
        text={result.data.proposal.text}
        beforeText={result.data.proposal.kind === 'replacement' ? result.focusText : undefined}
        onDismiss={() => setProposalDismissed(true)}
        onConfirm={async () => {
          await onApplyProposal(result.focusText, result.data.proposal);
          onFeedback?.({
            tone: 'success',
            message: result.data.proposal.kind === 'replacement'
              ? 'Canvas text updated from the confirmed coaching proposal.'
              : 'Coaching question kept as an Open Thread.'
          });
          setResult(null);
        }}
      />}
    </div>
  </details>;
}
