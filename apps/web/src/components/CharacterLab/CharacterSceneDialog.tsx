import {useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import {useModelRun} from '../../hooks/useModelRun';
import {useConsultationBudget} from '../../hooks/useConsultationBudget';
import {useCharacterLabData} from '../../hooks/useCharacterLabData';
import {
  buildCharacterSceneSeeds,
  buildCharacterVoicePrompt,
  formatCharacterSceneInsertHtml,
  formatCharacterSceneScratchpadHtml,
  type CharacterSceneDirection,
  type CharacterSceneDraft,
  type CharacterVoiceContext,
  type CharacterVoicePosition
} from '../../services/characterLab';
import {LLMService} from '../../services/llm/LLMService';
import {resolveResponseTokenLimit} from '../../services/llm/modelRun';
import {describeError} from '../../services/errors';
import {ModelRunProgress} from '../common/ModelRunProgress';
import {ConsultationBudgetNotice} from '../common/ConsultationBudgetNotice';
import styles from '../../styles/CharacterLab.module.css';
import {StoryPointPicker} from './StoryPointPicker';
import {describeCharacterLabDataFlow, getCharacterLabProviderIssue} from './characterLabProvider';
import {buildAITextProvenance, type AITextProvenance} from '../../services/editor/aiTextProvenance';

const MAX_CHARACTERS = 3;

interface CharacterSceneDialogProps {
  isOpen: boolean;
  projectId: string;
  /** Characters preselected when the dialog opens, e.g. the drawer's current choice. */
  initialEntityIds: string[];
  defaultPosition: CharacterVoicePosition;
  /** Present in Workspace: an ordinary, undoable editor insert at the cursor. */
  /** `provenance` records that a model wrote the inserted scene. */
  onInsertAtCursor?: (html: string, provenance: AITextProvenance) => void;
  onClose: () => void;
}

// Drafts live for the app session: closing and reopening keeps them; reloading drops them.
const sessionDrafts = new Map<string, CharacterSceneDraft[]>();

export function CharacterSceneDialog({
  isOpen,
  projectId,
  initialEntityIds,
  defaultPosition,
  onInsertAtCursor,
  onClose
}: CharacterSceneDialogProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lab = useCharacterLabData(projectId, isOpen);
  const modelRun = useModelRun();
  const inspector = lab.aiConfig?.inspectorSettings;
  const consultationEnabled = inspector?.enableAIConsultation !== false;
  const budget = useConsultationBudget(projectId, inspector, lab.aiConfig);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [position, setPosition] = useState<CharacterVoicePosition>(defaultPosition);
  const [directionKind, setDirectionKind] = useState<CharacterSceneDirection['kind']>('directed');
  const [setup, setSetup] = useState('');
  const [authorInstructions, setAuthorInstructions] = useState('');
  const [drafts, setDrafts] = useState<CharacterSceneDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  useFocusTrap(containerRef, isOpen);

  const updateDrafts = (update: (current: CharacterSceneDraft[]) => CharacterSceneDraft[]) =>
    setDrafts((current) => {
      const next = update(current);
      sessionDrafts.set(projectId, next);
      return next;
    });

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(initialEntityIds.slice(0, MAX_CHARACTERS));
    setPosition(defaultPosition);
    setDrafts(sessionDrafts.get(projectId) ?? []);
    setError(null);
    setSavedMessage(null);
    containerRef.current?.querySelector<HTMLElement>('input, button')?.focus();
    // Read once when the dialog opens, not on every cursor move behind it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId]);

  const {buildContext} = lab;
  const grounding = useMemo(() => {
    const contexts: CharacterVoiceContext[] = [];
    const errors: string[] = [];
    if (!isOpen) return {contexts, errors};
    selectedIds.forEach((entityId) => {
      const result = buildContext(entityId, position);
      if (result?.context) contexts.push(result.context);
      else if (result?.error) errors.push(result.error);
    });
    return {contexts, errors};
  }, [buildContext, isOpen, position, selectedIds]);

  const seeds = useMemo(
    () =>
      buildCharacterSceneSeeds({
        sceneId: position.kind === 'scene' ? position.sceneId : null,
        chapterCards: lab.chapterCards,
        openThreads: lab.openThreads
      }),
    [lab.chapterCards, lab.openThreads, position]
  );

  const providerIssue = useMemo(() => getCharacterLabProviderIssue(lab.aiConfig), [lab.aiConfig]);

  if (!isOpen) return null;

  const disclosure = describeCharacterLabDataFlow(
    budget.route,
    'the chosen characters’ World Bible records, accepted facts, dialogue styles, and story state, plus your setup or the listed story threads'
  );
  const direction: CharacterSceneDirection =
    directionKind === 'directed' ? {kind: 'directed', setup} : {kind: 'surprise', seeds};
  const castReady =
    grounding.errors.length === 0 &&
    grounding.contexts.length >= 2 &&
    grounding.contexts.length <= MAX_CHARACTERS;
  const directionReady = directionKind === 'directed' ? Boolean(setup.trim()) : seeds.length > 0;
  const canWrite =
    castReady && directionReady && !modelRun.isRunning && !providerIssue && consultationEnabled;
  const latest = drafts[drafts.length - 1] ?? null;

  const toggleCharacter = (entityId: string) =>
    setSelectedIds((current) =>
      current.includes(entityId)
        ? current.filter((id) => id !== entityId)
        : current.length < MAX_CHARACTERS
          ? [...current, entityId]
          : current
    );

  const write = async () => {
    if (!canWrite || !lab.aiConfig) return;
    if (budget.blocked) {
      setError(budget.blockedMessage ?? 'AI consultation budget reached for today.');
      return;
    }
    let prompt;
    try {
      prompt = buildCharacterVoicePrompt({
        mode: 'scene',
        characters: grounding.contexts,
        direction,
        authorInstructions
      });
    } catch (promptError) {
      setError(describeError(promptError, 'This scene cannot be written yet.'));
      return;
    }
    const draft: CharacterSceneDraft = {
      id: crypto.randomUUID(),
      characterNames: grounding.contexts.map((context) => context.name),
      positionLabel: grounding.contexts[0].positionLabel,
      direction,
      text: '',
      stopped: false
    };
    const updateDraft = (changes: Partial<CharacterSceneDraft>) =>
      updateDrafts((current) =>
        current.map((entry) => (entry.id === draft.id ? {...entry, ...changes} : entry))
      );

    setError(null);
    setSavedMessage(null);
    updateDrafts((current) => [...current, draft]);
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
        ({answer}) => updateDraft({text: answer})
      );
      updateDraft({text: result.answer, stopped: result.stopped});
    } catch (runError) {
      updateDrafts((current) => current.filter((entry) => entry.id !== draft.id));
      setError(describeError(runError, 'The character lab could not reach the model.'));
    }
  };

  const saveToScratchpad = async (sceneDraft: CharacterSceneDraft) => {
    setIsSaving(true);
    setError(null);
    try {
      await lab.saveToScratchpad(formatCharacterSceneScratchpadHtml(sceneDraft));
      setSavedMessage('Saved to Scratchpad.');
    } catch (saveError) {
      setError(describeError(saveError, 'Unable to save to the Scratchpad.'));
    } finally {
      setIsSaving(false);
    }
  };

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
        aria-labelledby='character-scene-title'
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
            <h2 id='character-scene-title'>Character scene</h2>
          </div>
          <button type='button' onClick={onClose}>Close</button>
        </header>

        {!lab.isLoaded ? (
          <p className={styles.hint}>{lab.loadError ?? 'Loading…'}</p>
        ) : (
          <div className={styles.body}>
            <section className={styles.conversation} aria-label='Scene'>
              <fieldset className={styles.castPicker}>
                <legend>Characters (choose 2 or 3)</legend>
                {lab.characterOptions.map((option) => {
                  const checked = selectedIds.includes(option.id);
                  return (
                    <label key={option.id}>
                      <input
                        type='checkbox'
                        checked={checked}
                        disabled={!checked && selectedIds.length >= MAX_CHARACTERS}
                        onChange={() => toggleCharacter(option.id)}
                      />
                      {option.name}
                    </label>
                  );
                })}
              </fieldset>

              <div className={styles.controls}>
                <div className={styles.modeToggle} role='group' aria-label='Scene direction'>
                  <button
                    type='button'
                    aria-pressed={directionKind === 'directed'}
                    className={directionKind === 'directed' ? styles.modeActive : ''}
                    onClick={() => setDirectionKind('directed')}
                  >
                    Directed
                  </button>
                  <button
                    type='button'
                    aria-pressed={directionKind === 'surprise'}
                    className={directionKind === 'surprise' ? styles.modeActive : ''}
                    onClick={() => setDirectionKind('surprise')}
                  >
                    Surprise me
                  </button>
                </div>
                <StoryPointPicker
                  documents={lab.documents}
                  position={position}
                  defaultPosition={defaultPosition}
                  onChange={setPosition}
                />
              </div>

              {directionKind === 'directed' ? (
                <label className={styles.field}>
                  <span>Scene setup</span>
                  <textarea
                    rows={3}
                    value={setup}
                    onChange={(event) => setSetup(event.target.value)}
                    placeholder='Where they are, what just happened, and what one of them wants.'
                  />
                </label>
              ) : seeds.length > 0 ? (
                <div className={styles.hint}>
                  The scene grows from one of these:
                  <ul className={styles.seedList}>
                    {seeds.map((seed) => <li key={seed}>{seed}</li>)}
                  </ul>
                </div>
              ) : (
                <p className={styles.hint}>
                  Surprise me draws on open World Canvas threads and chapter cards linked to the
                  chosen scene. Add one of those, or write a setup instead.
                </p>
              )}

              <details className={styles.instructions}>
                <summary>Instructions for this scene (optional)</summary>
                <textarea
                  aria-label='Instructions for this scene'
                  rows={2}
                  value={authorInstructions}
                  onChange={(event) => setAuthorInstructions(event.target.value)}
                  placeholder='For example: under 400 words; end on an unanswered question.'
                />
              </details>

              {latest && (
                <article className={styles.sceneDraft} aria-label='Draft scene'>
                  <strong>{latest.characterNames.join(', ')}</strong>
                  <p>{latest.text || (modelRun.isRunning ? '…' : '')}</p>
                  {latest.stopped && (
                    <span className={styles.stoppedNote}>Stopped before the scene finished.</span>
                  )}
                </article>
              )}

              <ModelRunProgress run={modelRun} />
              {(error || grounding.errors[0]) && (
                <p className={styles.error} role='alert'>{error ?? grounding.errors[0]}</p>
              )}
              {savedMessage && <p className={styles.hint} role='status'>{savedMessage}</p>}

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
                <button type='button' className={styles.primary} onClick={() => void write()} disabled={!canWrite}>
                  {latest ? 'Write another scene' : 'Write scene'}
                </button>
                <button
                  type='button'
                  onClick={() => latest && void saveToScratchpad(latest)}
                  disabled={!latest?.text.trim() || modelRun.isRunning || isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save to Scratchpad'}
                </button>
                {onInsertAtCursor && (
                  <button
                    type='button'
                    onClick={() => {
                      if (!latest) return;
                      onInsertAtCursor(
                        formatCharacterSceneInsertHtml(latest),
                        buildAITextProvenance('character-scene', lab.aiConfig, budget.route)
                      );
                      onClose();
                    }}
                    disabled={!latest?.text.trim() || modelRun.isRunning}
                  >
                    Insert at cursor
                  </button>
                )}
              </div>
            </section>

            <aside className={styles.grounding} aria-label='What the characters are grounded in'>
              <h3>Grounded in</h3>
              {grounding.contexts.length === 0 ? (
                <p className={styles.hint}>Choose two or three characters.</p>
              ) : (
                grounding.contexts.map((context) => (
                  <div key={context.entityId}>
                    <strong>{context.name}</strong>
                    <ul>
                      {context.sections.map((section) => (
                        <li key={section.kind}>{section.source}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
              <p className={styles.hint}>
                Only the chosen characters are sent. Story state is what is true in the story at this
                point, not what any character knows. Nothing here changes canon, facts, or state.
              </p>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
