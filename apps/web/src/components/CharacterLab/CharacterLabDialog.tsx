import {useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import {useModelRun} from '../../hooks/useModelRun';
import {useConsultationBudget} from '../../hooks/useConsultationBudget';
import {useCharacterLabData} from '../../hooks/useCharacterLabData';
import {
  buildBudgetedVoicePrompt,
  buildCharacterTalkTranscript,
  buildCharacterVoicePrompt,
  formatCharacterLabScratchpadHtml,
  dropShownVersion,
  exchangeVersionCount,
  keepShownVersion,
  MAX_REPLY_VERSIONS,
  showExchangeVersion,
  startExchangeVersion,
  updateShownVersion,
  type CharacterLabExchange,
  type CharacterLabMode,
  type CharacterVoiceContext,
  type CharacterVoicePosition
} from '../../services/characterLab';
import {useModelContextSize} from '../../hooks/useModelContextSize';
import {ContextLeftOutNotice} from '../common/ContextLeftOutNotice';
import {ReplyVersionControls} from '../common/ReplyVersionControls';
import type {LLMMessage} from '../../services/llm/types';
import {PromptTokenSummary} from '../common/PromptTokenSummary';
import {sectionTokenLabel} from '../../services/llm/contextBudget';
import {LLMService} from '../../services/llm/LLMService';
import {resolveResponseTokenLimit} from '../../services/llm/modelRun';
import {describeError} from '../../services/errors';
import {ModelRunProgress} from '../common/ModelRunProgress';
import {ConsultationBudgetNotice} from '../common/ConsultationBudgetNotice';
import {CharacterStatCard} from '../CharacterSheets/CharacterStatCard';
import styles from '../../styles/CharacterLab.module.css';
import {StoryPointPicker} from './StoryPointPicker';
import {describeCharacterLabDataFlow, getCharacterLabProviderIssue} from './characterLabProvider';

interface CharacterLabDialogProps {
  isOpen: boolean;
  projectId: string;
  entityId: string;
  /** Where the character starts grounded; Workspace passes its cursor in the current scene. */
  defaultPosition: CharacterVoicePosition;
  onClose: () => void;
}

// Transcripts live for the app session: closing and reopening the lab keeps them; reloading drops them.
const sessionTranscripts = new Map<string, CharacterLabExchange[]>();
const transcriptKey = (projectId: string, entityId: string) => `${projectId}:${entityId}`;

const MODE_LABELS: Record<CharacterLabMode, string> = {
  talk: 'Talk',
  reaction: 'Reaction test'
};

export function CharacterLabDialog({
  isOpen,
  projectId,
  entityId,
  defaultPosition,
  onClose
}: CharacterLabDialogProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lab = useCharacterLabData(projectId, isOpen);
  const modelRun = useModelRun();
  const inspector = lab.aiConfig?.inspectorSettings;
  const consultationEnabled = inspector?.enableAIConsultation !== false;
  const budget = useConsultationBudget(projectId, inspector, lab.aiConfig);
  const [mode, setMode] = useState<CharacterLabMode>('talk');
  const [position, setPosition] = useState<CharacterVoicePosition>(defaultPosition);
  const [input, setInput] = useState('');
  const [authorInstructions, setAuthorInstructions] = useState('');
  const [exchanges, setExchanges] = useState<CharacterLabExchange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  useFocusTrap(containerRef, isOpen);

  const updateExchanges = (update: (current: CharacterLabExchange[]) => CharacterLabExchange[]) =>
    setExchanges((current) => {
      const next = update(current);
      sessionTranscripts.set(transcriptKey(projectId, entityId), next);
      return next;
    });

  useEffect(() => {
    if (!isOpen) return;
    setPosition(defaultPosition);
    setExchanges(sessionTranscripts.get(transcriptKey(projectId, entityId)) ?? []);
    setError(null);
    setSavedMessage(null);
    inputRef.current?.focus();
    // The default position is read when the lab opens, not on every cursor move behind it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, isOpen, projectId]);

  const {buildContext} = lab;
  const grounding = useMemo(
    () => (isOpen ? buildContext(entityId, position) : null),
    [buildContext, entityId, isOpen, position]
  );
  const context = grounding?.context ?? null;

  const providerIssue = useMemo(() => getCharacterLabProviderIssue(lab.aiConfig), [lab.aiConfig]);
  const contextSize = useModelContextSize(lab.aiConfig, isOpen);

  const maxTokens = lab.aiConfig ? resolveResponseTokenLimit(lab.aiConfig.provider, inspector?.maxResponseTokens) : undefined;
  // The grounding is fitted to the model's context for every send, and the same fit is shown below.
  const planPrompt = (
    character: CharacterVoiceContext,
    text: string,
    request: {mode: CharacterLabMode; history: CharacterLabExchange[]} = {mode, history: exchanges}
  ) =>
    buildBudgetedVoicePrompt({
      contexts: [character],
      contextTokens: contextSize?.tokens ?? null,
      replyTokens: maxTokens,
      build: ([fitted]) =>
        buildCharacterVoicePrompt(
          request.mode === 'talk'
            ? {
                mode: 'talk',
                character: fitted!,
                transcript: buildCharacterTalkTranscript(request.history),
                message: text,
                authorInstructions
              }
            : {mode: 'reaction', character: fitted!, situation: text, authorInstructions}
        )
    });

  if (!isOpen) return null;
  // Before anything is typed, plan with a stand-in message so the fit is shown from the start.
  const planned = context ? planPrompt(context, input.trim() ? input : '…') : null;
  const plannedFit = planned?.fit ?? null;

  const name = context?.name ?? 'this character';
  const disclosure = describeCharacterLabDataFlow(
    budget.route,
    `${name}’s World Bible record${lab.aiConfig?.includeLinkedRecords ? ' (with linked records)' : ''}, accepted facts, dialogue style, story state, and this conversation`
  );
  // Every generation, first or another version, passes the same checks and is charged once.
  const blockedReason = (): string | null => {
    if (providerIssue) return providerIssue;
    if (!consultationEnabled) return 'AI consultation is disabled in Settings.';
    if (budget.blocked) return budget.blockedMessage ?? 'AI consultation budget reached for today.';
    return null;
  };

  const generate = async (
    exchangeId: string,
    prompt: {systemPrompt: string; messages: LLMMessage[]},
    onFailure: (runError: unknown) => void
  ) => {
    const updateShown = (changes: Partial<Pick<CharacterLabExchange, 'reply' | 'stopped'>>) =>
      updateExchanges((current) =>
        current.map((entry) => (entry.id === exchangeId ? updateShownVersion(entry, changes) : entry))
      );
    try {
      const service = new LLMService(lab.aiConfig!);
      budget.spend('character-lab');
      const result = await modelRun.run(
        service,
        {systemPrompt: prompt.systemPrompt, messages: prompt.messages, maxTokens, cache: false},
        ({answer}) => updateShown({reply: answer})
      );
      updateShown({reply: result.answer, stopped: result.stopped});
    } catch (runError) {
      onFailure(runError);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !context || !lab.aiConfig || modelRun.isRunning) return;
    const blocked = blockedReason();
    if (blocked) {
      setError(blocked);
      return;
    }

    // Sending moves on: earlier replies keep the version shown, and the others are discarded.
    const history = exchanges.map(keepShownVersion);
    const {prompt} = planPrompt(context, text, {mode, history});
    const exchange: CharacterLabExchange = {
      id: crypto.randomUUID(),
      mode,
      prompt: text,
      reply: '',
      positionLabel: context.positionLabel,
      stopped: false
    };

    setError(null);
    setSavedMessage(null);
    setInput('');
    updateExchanges(() => [...history, exchange]);
    await generate(exchange.id, prompt, (runError) => {
      updateExchanges((current) => current.filter((entry) => entry.id !== exchange.id));
      setInput(text);
      setError(describeError(runError, 'The character lab could not reach the model.'));
    });
  };

  const latestExchange = exchanges[exchanges.length - 1] ?? null;
  // Another version repeats the same request: same mode, story point, and earlier conversation.
  const anotherVersionIssue = !latestExchange
    ? null
    : !context || context.positionLabel !== latestExchange.positionLabel
      ? `Return to ${latestExchange.positionLabel} to ask for another version.`
      : exchangeVersionCount(latestExchange) >= MAX_REPLY_VERSIONS
        ? `At most ${MAX_REPLY_VERSIONS} versions of one reply.`
        : null;

  const anotherVersion = async () => {
    const exchange = latestExchange;
    if (!exchange || !context || !lab.aiConfig || modelRun.isRunning || anotherVersionIssue) return;
    const blocked = blockedReason();
    if (blocked) {
      setError(blocked);
      return;
    }
    const {prompt} = planPrompt(context, exchange.prompt, {mode: exchange.mode, history: exchanges.slice(0, -1)});
    setError(null);
    setSavedMessage(null);
    updateExchanges((current) => current.map((entry) => (entry.id === exchange.id ? startExchangeVersion(entry) : entry)));
    await generate(exchange.id, prompt, (runError) => {
      updateExchanges((current) => current.map((entry) => (entry.id === exchange.id ? dropShownVersion(entry) : entry)));
      setError(describeError(runError, 'The character lab could not reach the model.'));
    });
  };

  const showVersion = (index: number) =>
    updateExchanges((current) =>
      current.map((entry) => (entry.id === latestExchange?.id ? showExchangeVersion(entry, index) : entry))
    );

  const saveToScratchpad = async () => {
    if (!context || exchanges.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      await lab.saveToScratchpad(
        formatCharacterLabScratchpadHtml({characterName: context.name, exchanges})
      );
      setSavedMessage('Saved to Scratchpad.');
    } catch (saveError) {
      setError(describeError(saveError, 'Unable to save to the Scratchpad.'));
    } finally {
      setIsSaving(false);
    }
  };

  const canGenerate = Boolean(context) && !modelRun.isRunning && !providerIssue && consultationEnabled;
  const canSend = canGenerate && Boolean(input.trim());

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className={styles.dialog}
        role='dialog'
        aria-modal='true'
        aria-labelledby='character-lab-title'
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      >
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Character lab · draft, not canon</span>
            <h2 id='character-lab-title'>{context ? `Talk to ${context.name}` : 'Character lab'}</h2>
          </div>
          <button type='button' onClick={onClose}>Close</button>
        </header>

        {!lab.isLoaded ? (
          <p className={styles.hint}>{lab.loadError ?? 'Loading…'}</p>
        ) : (
          <div className={styles.body}>
            <section className={styles.conversation} aria-label='Conversation'>
              <div className={styles.controls}>
                <div className={styles.modeToggle} role='group' aria-label='Lab mode'>
                  {(Object.keys(MODE_LABELS) as CharacterLabMode[]).map((option) => (
                    <button
                      key={option}
                      type='button'
                      aria-pressed={mode === option}
                      className={mode === option ? styles.modeActive : ''}
                      onClick={() => setMode(option)}
                    >
                      {MODE_LABELS[option]}
                    </button>
                  ))}
                </div>
                <StoryPointPicker
                  documents={lab.documents}
                  position={position}
                  defaultPosition={defaultPosition}
                  onChange={setPosition}
                />
              </div>

              {exchanges.length === 0 ? (
                <p className={styles.hint}>
                  {mode === 'talk'
                    ? `Ask ${name} anything. They answer in their own voice from canon, accepted facts, and story state, and may disagree or refuse.`
                    : `Describe a situation. You get ${name}'s likely behavior, the reasoning, and a few lines of dialogue.`}
                </p>
              ) : (
                <ol className={styles.transcript} aria-label='Transcript'>
                  {exchanges.map((exchange, index) => (
                    <li key={exchange.id} className={styles.exchange}>
                      <div className={styles.authorTurn}>
                        <strong>{exchange.mode === 'talk' ? 'You' : 'Reaction test'}</strong>
                        <p>{exchange.prompt}</p>
                      </div>
                      <div className={styles.characterTurn}>
                        <strong>{context?.name ?? 'Character'}</strong>
                        <p>{exchange.reply || (modelRun.isRunning && index === exchanges.length - 1 ? '…' : '')}</p>
                        {exchange.stopped && (
                          <span className={styles.stoppedNote}>Stopped before the reply finished.</span>
                        )}
                        {index === exchanges.length - 1 && (
                          <ReplyVersionControls
                            count={exchangeVersionCount(exchange)}
                            index={exchange.versionIndex ?? 0}
                            busy={modelRun.isRunning}
                            disabledReason={anotherVersionIssue ?? (canGenerate ? null : 'Not available right now.')}
                            onShow={showVersion}
                            onAnother={() => void anotherVersion()}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              <ModelRunProgress run={modelRun} />
              {(error || grounding?.error) && (
                <p className={styles.error} role='alert'>{error ?? grounding?.error}</p>
              )}
              {savedMessage && <p className={styles.hint} role='status'>{savedMessage}</p>}

              <label className={styles.field}>
                <span>{mode === 'talk' ? 'Your message' : 'Situation'}</span>
                <textarea
                  ref={inputRef}
                  rows={3}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
              </label>
              <details className={styles.instructions}>
                <summary>Instructions for this session (optional)</summary>
                <textarea
                  aria-label='Instructions for this session'
                  rows={2}
                  value={authorInstructions}
                  onChange={(event) => setAuthorInstructions(event.target.value)}
                  placeholder='For example: keep answers short; she is hiding an injury.'
                />
              </details>

              {providerIssue ? (
                <p className={styles.hint}>
                  {providerIssue} <Link to='/settings' onClick={onClose}>Open Settings</Link>
                </p>
              ) : (
                disclosure && <p className={styles.disclosure}>{disclosure}</p>
              )}
              <ConsultationBudgetNotice
                status={budget.status}
                isLocal={budget.isLocal}
                onGrantMore={budget.grantMore}
                hidden={!consultationEnabled || Boolean(providerIssue)}
              />
              <div className={styles.actions}>
                <button type='button' className={styles.primary} onClick={() => void send()} disabled={!canSend}>
                  {mode === 'talk' ? 'Send' : 'Test reaction'}
                </button>
                <button
                  type='button'
                  onClick={() => void saveToScratchpad()}
                  disabled={exchanges.length === 0 || modelRun.isRunning || isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save to Scratchpad'}
                </button>
                <button
                  type='button'
                  onClick={() => {
                    updateExchanges(() => []);
                    setSavedMessage(null);
                    modelRun.reset();
                  }}
                  disabled={exchanges.length === 0 || modelRun.isRunning}
                >
                  Clear conversation
                </button>
              </div>
            </section>

            {context && (
              <aside className={styles.grounding} aria-label='What the character is grounded in'>
                {lab.canUseGameSystems && context.snapshot && (
                  <CharacterStatCard
                    snapshot={context.snapshot}
                    asOfLabel={`Story state at ${context.positionLabel}`}
                  />
                )}
                <h3>Grounded in</h3>
                <ul>
                  {(plannedFit?.contexts[0] ?? context).sections.map((section) => (
                    <li key={section.source}>
                      {section.source} <small>{sectionTokenLabel(planned?.breakdown, section.source)}</small>
                    </li>
                  ))}
                </ul>
                {planned && <PromptTokenSummary className={styles.hint} breakdown={planned.breakdown} size={contextSize} />}
                <ContextLeftOutNotice
                  className={styles.hint}
                  omitted={plannedFit?.omitted ?? []}
                  budgetTokens={plannedFit?.budgetTokens ?? 0}
                  size={contextSize}
                />
                <p className={styles.hint}>
                  Story state is what is true in the story at this point, not what {context.name} knows.
                  Pending and rejected facts are left out. Nothing here changes canon, facts, or state.
                </p>
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
