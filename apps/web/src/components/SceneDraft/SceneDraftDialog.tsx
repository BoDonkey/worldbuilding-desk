import {useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import {useModelRun} from '../../hooks/useModelRun';
import {useConsultationBudget} from '../../hooks/useConsultationBudget';
import {useCharacterLabData} from '../../hooks/useCharacterLabData';
import type {CharacterVoiceContext, CharacterVoicePosition} from '../../services/characterLab';
import {
  SCENE_DRAFT_DEFAULT_WORDS,
  SCENE_DRAFT_MIN_WORDS,
  SCENE_DRAFT_WORD_CAP,
  buildSceneDraftPrompt,
  capDraftWords,
  clampTargetWords,
  formatSceneDraftInsertHtml,
  formatSceneDraftScratchpadHtml,
  previousSceneEnding,
  sceneGoalFromCards,
  type SceneDraft,
  type SceneDraftInputs
} from '../../services/sceneDraft/sceneDraft';
import {countWords} from '../../services/dashboard/storyDashboard';
import {LLMService} from '../../services/llm/LLMService';
import {resolveResponseTokenLimit} from '../../services/llm/modelRun';
import {describeRouteDataFlow} from '../../services/llm/providerRoute';
import {describeError} from '../../services/errors';
import {buildAITextProvenance, type AITextProvenance} from '../../services/editor/aiTextProvenance';
import {ModelRunProgress} from '../common/ModelRunProgress';
import {ConsultationBudgetNotice} from '../common/ConsultationBudgetNotice';
import {getCharacterLabProviderIssue} from '../CharacterLab/characterLabProvider';
import styles from '../../styles/CharacterLab.module.css';

const MAX_PRESENT = 4;

interface SceneDraftDialogProps {
  isOpen: boolean;
  projectId: string;
  sceneId: string;
  sceneTitle: string;
  /** One undoable editor insert at the cursor; `provenance` marks the text as AI text. */
  onInsert: (html: string, provenance: AITextProvenance) => void;
  onClose: () => void;
}

// Drafts live for the app session, per scene: closing and reopening keeps the latest one.
const sessionDrafts = new Map<string, SceneDraft>();

const emptyInputs = (): SceneDraftInputs => ({
  goal: '',
  povEntityId: null,
  presentEntityIds: [],
  setting: '',
  beats: '',
  targetWords: SCENE_DRAFT_DEFAULT_WORDS,
  previousEnding: '',
  notes: ''
});

/**
 * **Draft this scene** (Slice 4.52): the author fills in what the scene is,
 * sees exactly what will be sent, and gets a preview. Nothing reaches the
 * manuscript until Insert into scene; nothing ever reaches canon, state, or
 * records from here.
 */
export function SceneDraftDialog({isOpen, projectId, sceneId, sceneTitle, onInsert, onClose}: SceneDraftDialogProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lab = useCharacterLabData(projectId, isOpen);
  const modelRun = useModelRun();
  const inspector = lab.aiConfig?.inspectorSettings;
  const consultationEnabled = inspector?.enableAIConsultation !== false;
  const draftsAllowed = Boolean(lab.aiConfig?.allowSceneDrafts) && consultationEnabled;
  const budget = useConsultationBudget(projectId, inspector, lab.aiConfig);
  const [inputs, setInputs] = useState<SceneDraftInputs>(emptyInputs);
  const [draft, setDraft] = useState<SceneDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const initializedForRef = useRef<string | null>(null);
  useFocusTrap(containerRef, isOpen);

  useEffect(() => {
    if (!isOpen) {
      initializedForRef.current = null;
      return;
    }
    if (!lab.isLoaded || initializedForRef.current === sceneId) return;
    initializedForRef.current = sceneId;
    const saved = sessionDrafts.get(sceneId) ?? null;
    const linkedCards = lab.chapterCards.filter((card) => (card.sceneIds ?? []).includes(sceneId));
    // Opening the dialog seeds its fields once; later edits are the author's.
    setInputs(
      saved?.inputs ?? {
        ...emptyInputs(),
        goal: sceneGoalFromCards(linkedCards),
        previousEnding: previousSceneEnding(lab.documents, sceneId)
      }
    );
    setDraft(saved);
    setError(null);
    setSavedMessage(null);
    containerRef.current?.querySelector<HTMLElement>('textarea, input, button')?.focus();
  }, [isOpen, lab.chapterCards, lab.documents, lab.isLoaded, sceneId]);

  const position = useMemo<CharacterVoicePosition>(
    () => ({kind: 'scene', sceneId, moment: 'opening'}),
    [sceneId]
  );
  const {buildContext} = lab;
  const grounding = useMemo(() => {
    const contexts: CharacterVoiceContext[] = [];
    const errors: string[] = [];
    if (!isOpen) return {contexts, errors};
    inputs.presentEntityIds.forEach((entityId) => {
      const result = buildContext(entityId, position);
      if (result?.context) contexts.push(result.context);
      else if (result?.error) errors.push(result.error);
    });
    return {contexts, errors};
  }, [buildContext, inputs.presentEntityIds, isOpen, position]);
  const providerIssue = useMemo(() => getCharacterLabProviderIssue(lab.aiConfig), [lab.aiConfig]);

  if (!isOpen) return null;

  const update = (changes: Partial<SceneDraftInputs>) => setInputs((current) => ({...current, ...changes}));
  const togglePresent = (entityId: string) =>
    setInputs((current) => {
      const present = current.presentEntityIds.includes(entityId);
      const presentEntityIds = present
        ? current.presentEntityIds.filter((id) => id !== entityId)
        : current.presentEntityIds.length < MAX_PRESENT
          ? [...current.presentEntityIds, entityId]
          : current.presentEntityIds;
      return {
        ...current,
        presentEntityIds,
        povEntityId: presentEntityIds.includes(current.povEntityId ?? '') ? current.povEntityId : null
      };
    });

  const disclosure = (() => {
    const sentence = describeRouteDataFlow(
      budget.route,
      'the fields above and the present characters’ World Bible records, accepted facts, dialogue styles, and story state'
    );
    return budget.route.kind === 'hosted' && sentence
      ? `${sentence} Other scenes and Source Notes are not sent.`
      : sentence;
  })();
  const canDraft =
    draftsAllowed &&
    Boolean(inputs.goal.trim()) &&
    grounding.errors.length === 0 &&
    !modelRun.isRunning &&
    !providerIssue;
  const draftText = draft?.text ?? '';

  const write = async () => {
    if (!canDraft || !lab.aiConfig) return;
    if (budget.blocked) {
      setError(budget.blockedMessage ?? 'AI consultation budget reached for today.');
      return;
    }
    let prompt;
    try {
      prompt = buildSceneDraftPrompt({inputs, characters: grounding.contexts});
    } catch (promptError) {
      setError(describeError(promptError, 'This scene cannot be drafted yet.'));
      return;
    }
    const next: SceneDraft = {
      id: crypto.randomUUID(),
      sceneTitle,
      inputs,
      text: '',
      stopped: false,
      trimmed: false
    };
    const show = (changes: Partial<SceneDraft>) =>
      setDraft((current) => (current?.id === next.id ? {...current, ...changes} : current));
    setError(null);
    setSavedMessage(null);
    setDraft(next);
    let hitCap = false;
    try {
      const service = new LLMService(lab.aiConfig);
      budget.spend('scene-draft');
      const result = await modelRun.run(
        service,
        {
          systemPrompt: prompt.systemPrompt,
          messages: prompt.messages,
          maxTokens: resolveResponseTokenLimit(lab.aiConfig.provider, inspector?.maxResponseTokens),
          cache: false
        },
        ({answer}) => {
          show({text: answer});
          // Stop paying for words the cap will cut anyway.
          if (!hitCap && countWords(answer) > SCENE_DRAFT_WORD_CAP) {
            hitCap = true;
            modelRun.stop();
          }
        }
      );
      const capped = capDraftWords(result.answer);
      const finished: SceneDraft = {
        ...next,
        text: capped.text,
        trimmed: capped.trimmed,
        stopped: result.stopped && !hitCap
      };
      setDraft(finished);
      sessionDrafts.set(sceneId, finished);
    } catch (runError) {
      setDraft(sessionDrafts.get(sceneId) ?? null);
      setError(describeError(runError, 'The scene draft could not reach the model.'));
    }
  };

  const saveToScratchpad = async () => {
    if (!draft) return;
    setIsSaving(true);
    setError(null);
    try {
      await lab.saveToScratchpad(formatSceneDraftScratchpadHtml(draft));
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
        aria-labelledby='scene-draft-title'
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
            <span className={styles.eyebrow}>Scene draft · preview until you insert it</span>
            <h2 id='scene-draft-title'>Draft this scene: {sceneTitle || 'Untitled scene'}</h2>
          </div>
          <button type='button' onClick={onClose}>Close</button>
        </header>

        {!lab.isLoaded ? (
          <p className={styles.hint}>{lab.loadError ?? 'Loading…'}</p>
        ) : !draftsAllowed ? (
          <p className={styles.hint}>
            Scene drafts are off for this project.{' '}
            <Link to='/settings' onClick={onClose}>Open Settings</Link>
          </p>
        ) : (
          <div className={styles.body}>
            <section className={styles.conversation} aria-label='Scene draft'>
              <label className={styles.field}>
                <span>What happens in this scene</span>
                <textarea
                  rows={3}
                  value={inputs.goal}
                  onChange={(event) => update({goal: event.target.value})}
                  placeholder='The scene’s goal: who wants what, what stands in the way, and how it turns.'
                />
              </label>

              <fieldset className={styles.castPicker}>
                <legend>Characters present (up to {MAX_PRESENT})</legend>
                {lab.characterOptions.length === 0 && (
                  <span className={styles.hint}>No World Bible characters yet.</span>
                )}
                {lab.characterOptions.map((option) => {
                  const checked = inputs.presentEntityIds.includes(option.id);
                  return (
                    <label key={option.id}>
                      <input
                        type='checkbox'
                        checked={checked}
                        disabled={!checked && inputs.presentEntityIds.length >= MAX_PRESENT}
                        onChange={() => togglePresent(option.id)}
                      />
                      {option.name}
                    </label>
                  );
                })}
              </fieldset>

              <div className={styles.controls}>
                <label className={styles.field}>
                  <span>Point of view</span>
                  <select
                    value={inputs.povEntityId ?? ''}
                    onChange={(event) => update({povEntityId: event.target.value || null})}
                  >
                    <option value=''>Not set</option>
                    {lab.characterOptions
                      .filter((option) => inputs.presentEntityIds.includes(option.id))
                      .map((option) => (
                        <option key={option.id} value={option.id}>{option.name}</option>
                      ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Target length (words)</span>
                  <input
                    type='number'
                    min={SCENE_DRAFT_MIN_WORDS}
                    max={SCENE_DRAFT_WORD_CAP}
                    step={100}
                    value={inputs.targetWords}
                    onChange={(event) => update({targetWords: Number(event.target.value)})}
                    onBlur={() => update({targetWords: clampTargetWords(inputs.targetWords)})}
                  />
                </label>
              </div>

              <label className={styles.field}>
                <span>Setting</span>
                <input
                  type='text'
                  value={inputs.setting}
                  onChange={(event) => update({setting: event.target.value})}
                  placeholder='Where and when.'
                />
              </label>
              <label className={styles.field}>
                <span>Beats</span>
                <textarea
                  rows={3}
                  value={inputs.beats}
                  onChange={(event) => update({beats: event.target.value})}
                  placeholder='One per line, in order.'
                />
              </label>
              <label className={styles.field}>
                <span>How the previous scene ends</span>
                <textarea
                  rows={3}
                  value={inputs.previousEnding}
                  onChange={(event) => update({previousEnding: event.target.value})}
                  placeholder='Nothing comes before this scene.'
                />
              </label>
              <details className={styles.instructions}>
                <summary>Notes for this draft (optional)</summary>
                <textarea
                  aria-label='Notes for this draft'
                  rows={2}
                  value={inputs.notes}
                  onChange={(event) => update({notes: event.target.value})}
                  placeholder='For example: present tense; keep the dialogue sparse.'
                />
              </details>

              {draft && (
                <article className={styles.sceneDraft} aria-label='Draft preview'>
                  <p>{draftText || (modelRun.isRunning ? '…' : '')}</p>
                  {draft.stopped && (
                    <span className={styles.stoppedNote}>Stopped before the draft finished.</span>
                  )}
                  {draft.trimmed && (
                    <span className={styles.stoppedNote}>Cut at {SCENE_DRAFT_WORD_CAP.toLocaleString()} words.</span>
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
                hidden={Boolean(providerIssue)}
              />
              <div className={styles.actions}>
                <button type='button' className={styles.primary} onClick={() => void write()} disabled={!canDraft}>
                  {draft ? 'Draft again' : 'Draft scene'}
                </button>
                <button
                  type='button'
                  onClick={() => void saveToScratchpad()}
                  disabled={!draftText.trim() || modelRun.isRunning || isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save to Scratchpad'}
                </button>
                <button
                  type='button'
                  onClick={() => {
                    if (!draft) return;
                    onInsert(
                      formatSceneDraftInsertHtml(draft),
                      buildAITextProvenance('scene-draft', lab.aiConfig, budget.route)
                    );
                    onClose();
                  }}
                  disabled={!draftText.trim() || modelRun.isRunning}
                >
                  Insert into scene
                </button>
              </div>
            </section>

            <aside className={styles.grounding} aria-label='What the draft is grounded in'>
              <h3>Grounded in</h3>
              {grounding.contexts.length === 0 ? (
                <p className={styles.hint}>Only the fields on the left. Choose characters to add their records.</p>
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
                Story state is as of the start of this scene. Inserted text is marked as AI text and
                reaches canon only through the usual review, like anything you write.
              </p>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
