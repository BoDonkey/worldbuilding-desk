import {useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import {useModelRun} from '../../hooks/useModelRun';
import {useConsultationBudget} from '../../hooks/useConsultationBudget';
import {useCharacterLabData} from '../../hooks/useCharacterLabData';
import {
  buildCharacterTalkTranscript,
  buildCharacterVoicePrompt,
  formatCharacterLabScratchpadHtml,
  type CharacterLabExchange,
  type CharacterLabMode,
  type CharacterVoicePosition
} from '../../services/characterLab';
import {appendToScratchpad} from '../../scratchpadStorage';
import {LLMService} from '../../services/llm/LLMService';
import {resolveResponseTokenLimit} from '../../services/llm/modelRun';
import {HOSTED_PROVIDER_NAMES} from '../../services/llm/providerConfig';
import {describeError} from '../../services/errors';
import type {CharacterSnapshotMoment} from '../../services/state/characterSnapshot';
import {ModelRunProgress} from '../common/ModelRunProgress';
import {ConsultationBudgetNotice} from '../common/ConsultationBudgetNotice';
import {CharacterStatCard} from '../CharacterSheets/CharacterStatCard';
import styles from '../../styles/CharacterLab.module.css';

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

const MOMENT_LABELS: Record<CharacterSnapshotMoment, string> = {
  opening: 'Opening',
  cursor: 'At the cursor',
  ending: 'End of scene'
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
  const budget = useConsultationBudget(projectId, inspector, lab.aiConfig?.provider);
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

  const providerIssue = useMemo(() => {
    if (!lab.aiConfig) return 'AI provider is not configured. Add one in Settings to use the character lab.';
    try {
      new LLMService(lab.aiConfig);
      return null;
    } catch (providerError) {
      return describeError(
        providerError,
        'AI provider is not configured. Add one in Settings to use the character lab.',
        {record: false}
      );
    }
  }, [lab.aiConfig]);

  if (!isOpen) return null;

  const provider = lab.aiConfig?.provider;
  const name = context?.name ?? 'this character';
  const disclosure = provider === 'ollama'
    ? 'Runs on your local Ollama model. Nothing leaves this computer.'
    : provider
      ? `Sends ${name}’s World Bible record, accepted facts, dialogue style, story state, and this conversation to ${HOSTED_PROVIDER_NAMES[provider]}’s servers only when you send. Manuscript prose is not sent.`
      : null;
  const cursorScene =
    defaultPosition.kind === 'scene' && defaultPosition.moment === 'cursor' ? defaultPosition : null;
  const sceneValue = position.kind === 'scene' ? position.sceneId : 'latest';
  const momentOptions: CharacterSnapshotMoment[] =
    cursorScene && position.kind === 'scene' && position.sceneId === cursorScene.sceneId
      ? ['opening', 'cursor', 'ending']
      : ['opening', 'ending'];

  const changeScene = (value: string) => {
    if (value === 'latest') {
      setPosition({kind: 'latest'});
    } else if (cursorScene && value === cursorScene.sceneId) {
      setPosition(cursorScene);
    } else {
      setPosition({kind: 'scene', sceneId: value, moment: 'ending'});
    }
  };

  const changeMoment = (moment: CharacterSnapshotMoment) => {
    if (position.kind !== 'scene') return;
    setPosition(
      moment === 'cursor' && cursorScene
        ? cursorScene
        : {kind: 'scene', sceneId: position.sceneId, moment}
    );
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !context || !lab.aiConfig || modelRun.isRunning) return;
    if (providerIssue) {
      setError(providerIssue);
      return;
    }
    if (!consultationEnabled) {
      setError('AI consultation is disabled in Settings.');
      return;
    }
    if (budget.blocked) {
      setError(budget.blockedMessage ?? 'AI consultation budget reached for today.');
      return;
    }

    const prompt = buildCharacterVoicePrompt(
      mode === 'talk'
        ? {
            mode: 'talk',
            character: context,
            transcript: buildCharacterTalkTranscript(exchanges),
            message: text,
            authorInstructions
          }
        : {mode: 'reaction', character: context, situation: text, authorInstructions}
    );
    const exchange: CharacterLabExchange = {
      id: crypto.randomUUID(),
      mode,
      prompt: text,
      reply: '',
      positionLabel: context.positionLabel,
      stopped: false
    };
    const updateExchange = (changes: Partial<CharacterLabExchange>) =>
      updateExchanges((current) =>
        current.map((entry) => (entry.id === exchange.id ? {...entry, ...changes} : entry))
      );

    setError(null);
    setSavedMessage(null);
    setInput('');
    updateExchanges((current) => [...current, exchange]);
    try {
      const service = new LLMService(lab.aiConfig);
      budget.spend('character-lab');
      const result = await modelRun.run(
        service,
        {
          systemPrompt: prompt.systemPrompt,
          messages: prompt.messages,
          maxTokens: resolveResponseTokenLimit(lab.aiConfig.provider, inspector?.maxResponseTokens),
          cache: false
        },
        ({answer}) => updateExchange({reply: answer})
      );
      updateExchange({reply: result.answer, stopped: result.stopped});
    } catch (runError) {
      updateExchanges((current) => current.filter((entry) => entry.id !== exchange.id));
      setInput(text);
      setError(describeError(runError, 'The character lab could not reach the model.'));
    }
  };

  const saveToScratchpad = async () => {
    if (!context || exchanges.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      await appendToScratchpad(
        projectId,
        formatCharacterLabScratchpadHtml({characterName: context.name, exchanges})
      );
      setSavedMessage('Saved to Scratchpad.');
    } catch (saveError) {
      setError(describeError(saveError, 'Unable to save to the Scratchpad.'));
    } finally {
      setIsSaving(false);
    }
  };

  const canSend =
    Boolean(context) && Boolean(input.trim()) && !modelRun.isRunning && !providerIssue && consultationEnabled;

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
                <label className={styles.field}>
                  <span>Story point</span>
                  <select value={sceneValue} onChange={(event) => changeScene(event.target.value)}>
                    <option value='latest'>Latest, after every accepted change</option>
                    {lab.documents.map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.title || 'Untitled scene'}
                      </option>
                    ))}
                  </select>
                </label>
                {position.kind === 'scene' && (
                  <label className={styles.field}>
                    <span>Moment</span>
                    <select
                      value={position.moment}
                      onChange={(event) => changeMoment(event.target.value as CharacterSnapshotMoment)}
                    >
                      {momentOptions.map((moment) => (
                        <option key={moment} value={moment}>{MOMENT_LABELS[moment]}</option>
                      ))}
                    </select>
                  </label>
                )}
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
                  {context.sections.map((section) => (
                    <li key={section.kind}>{section.source}</li>
                  ))}
                </ul>
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
