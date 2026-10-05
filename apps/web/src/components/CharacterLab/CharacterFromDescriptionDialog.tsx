import {useEffect, useMemo, useRef, useState} from 'react';
import {Link, useNavigate} from 'react-router';
import {useFocusTrap} from '../../hooks/useFocusTrap';
import {useModelRun} from '../../hooks/useModelRun';
import {useConsultationBudget} from '../../hooks/useConsultationBudget';
import {useCharacterLabData} from '../../hooks/useCharacterLabData';
import {
  buildCharacterFromDescriptionRecords,
  buildCharacterVoicePrompt,
  parseCharacterProfileReply,
  type CharacterFromDescriptionTarget,
  type CharacterProfile
} from '../../services/characterLab';
import {LLMService} from '../../services/llm/LLMService';
import {HOSTED_STRUCTURED_RESPONSE_MINIMUM} from '../../services/llm/hostedResponsePolicy';
import {describeError} from '../../services/errors';
import {ModelRunProgress} from '../common/ModelRunProgress';
import {ConsultationBudgetNotice} from '../common/ConsultationBudgetNotice';
import styles from '../../styles/CharacterLab.module.css';
import {describeCharacterLabDataFlow, getCharacterLabProviderIssue} from './characterLabProvider';

interface CharacterFromDescriptionDialogProps {
  isOpen: boolean;
  projectId: string;
  /** The character category a new draft is created in. */
  category: {id: string; slug: string};
  onOpenCharacter: (entityId: string) => void;
  onClose: () => void;
}

interface EditableDetail {
  text: string;
  keep: boolean;
}

interface CreatedResult {
  entityId: string;
  name: string;
  noteId: string;
  factCount: number;
  createdNew: boolean;
}

const SEPARATE = 'separate';
/** Room for a dozen invented suggestions on top of the facts. */
const PROFILE_RESPONSE_MINIMUM = 3000;

export function CharacterFromDescriptionDialog({
  isOpen,
  projectId,
  category,
  onOpenCharacter,
  onClose
}: CharacterFromDescriptionDialogProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lab = useCharacterLabData(projectId, isOpen);
  const modelRun = useModelRun();
  const inspector = lab.aiConfig?.inspectorSettings;
  const consultationEnabled = inspector?.enableAIConsultation !== false;
  const budget = useConsultationBudget(projectId, inspector, lab.aiConfig);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [description, setDescription] = useState('');
  const [authorInstructions, setAuthorInstructions] = useState('');
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [name, setName] = useState('');
  const [factKept, setFactKept] = useState<boolean[]>([]);
  const [details, setDetails] = useState<EditableDetail[]>([]);
  const [collisionChoice, setCollisionChoice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<CreatedResult | null>(null);
  useFocusTrap(containerRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    containerRef.current?.querySelector<HTMLElement>('textarea, button')?.focus();
  }, [isOpen, profile, result]);

  const {findNameCollisions} = lab;
  const collisions = useMemo(() => findNameCollisions(name), [findNameCollisions, name]);
  useEffect(() => {
    setCollisionChoice(null);
  }, [name]);

  const providerIssue = useMemo(() => getCharacterLabProviderIssue(lab.aiConfig), [lab.aiConfig]);

  if (!isOpen) return null;

  const disclosure = describeCharacterLabDataFlow(budget.route, 'your description and instructions');

  const draftProfile = async () => {
    const text = description.trim();
    if (!text || !lab.aiConfig || modelRun.isRunning) return;
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
    setError(null);
    try {
      const prompt = buildCharacterVoicePrompt({mode: 'generation', description, authorInstructions});
      const service = new LLMService(lab.aiConfig);
      budget.spend('character-lab');
      const run = await modelRun.run(service, {
        systemPrompt: prompt.systemPrompt,
        messages: prompt.messages,
        responseFormat: 'json',
        // Extraction gains little from long reasoning, and the quote check guards quality.
        // Only Ollama reads this; hosted providers keep their own thinking policy.
        think: false,
        maxTokens:
          lab.aiConfig.provider === 'ollama'
            ? undefined
            : Math.max(inspector?.maxResponseTokens ?? 0, HOSTED_STRUCTURED_RESPONSE_MINIMUM, PROFILE_RESPONSE_MINIMUM),
        cache: false
      });
      if (run.stopped) {
        setError('Stopped before the profile finished. Nothing was kept.');
        return;
      }
      const nextProfile = parseCharacterProfileReply(run.answer, description);
      setProfile(nextProfile);
      setName(nextProfile.name ?? '');
      setFactKept(nextProfile.stableFacts.map(() => true));
      setDetails(nextProfile.suggestedDetails.map((text) => ({text, keep: true})));
    } catch (draftError) {
      setError(describeError(draftError, 'The character lab could not draft a profile.'));
    }
  };

  const target: CharacterFromDescriptionTarget | null = (() => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (collisions.length === 0 || collisionChoice === SEPARATE) {
      return {kind: 'new', categoryId: category.id, name: trimmed};
    }
    const existing = collisions.find((collision) => collision.entityId === collisionChoice);
    return existing ? {kind: 'existing', entityId: existing.entityId, name: existing.name} : null;
  })();

  const accept = async () => {
    if (!profile || !target) return;
    setIsSaving(true);
    setError(null);
    try {
      const records = buildCharacterFromDescriptionRecords({
        projectId,
        sessionId,
        description,
        target,
        stableFacts: profile.stableFacts.filter((_, index) => factKept[index]),
        suggestedDetails: details.filter((detail) => detail.keep).map((detail) => detail.text)
      });
      await lab.saveFromDescription(records, category.slug);
      setResult({
        entityId: records.link.targetId,
        name: target.name,
        noteId: records.note.id,
        factCount: records.proposals.length,
        createdNew: target.kind === 'new'
      });
    } catch (saveError) {
      setError(describeError(saveError, 'Unable to save this character.'));
    } finally {
      setIsSaving(false);
    }
  };

  const startOver = () => {
    setProfile(null);
    setName('');
    setFactKept([]);
    setDetails([]);
    setError(null);
    modelRun.reset();
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
        className={`${styles.dialog} ${styles.narrowDialog}`}
        role='dialog'
        aria-modal='true'
        aria-labelledby='character-description-title'
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
            <span className={styles.eyebrow}>Character lab · nothing becomes canon without your review</span>
            <h2 id='character-description-title'>Character from a description</h2>
          </div>
          <button type='button' onClick={onClose}>Close</button>
        </header>

        <div className={styles.conversation}>
          {result ? (
            <>
              <p className={styles.hint} role='status'>
                {result.createdNew
                  ? `Created a draft character, ${result.name}. It is marked Needs completion.`
                  : `Added the description to ${result.name}.`}{' '}
                {result.factCount === 0
                  ? 'No facts are waiting for review.'
                  : `${result.factCount} ${result.factCount === 1 ? 'fact is' : 'facts are'} waiting for your review in Source Notes. None are canon until you accept them; an accepted age or occupation also fills an empty Age or Role field.`}
              </p>
              <div className={styles.actions}>
                {result.factCount > 0 && (
                  <button
                    type='button'
                    className={styles.primary}
                    onClick={() => {
                      onClose();
                      navigate('/lore', {state: {focusLoreDocumentId: result.noteId}});
                    }}
                  >
                    Review facts
                  </button>
                )}
                <button
                  type='button'
                  onClick={() => {
                    onClose();
                    onOpenCharacter(result.entityId);
                  }}
                >
                  Open {result.name}
                </button>
              </div>
            </>
          ) : !profile ? (
            <>
              <label className={styles.field}>
                <span>Describe the character in a few sentences</span>
                <textarea
                  rows={6}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder='Who they are, what they do, how they carry themselves, what they want.'
                />
              </label>
              <details className={styles.instructions}>
                <summary>Instructions (optional)</summary>
                <textarea
                  aria-label='Instructions for this profile'
                  rows={2}
                  value={authorInstructions}
                  onChange={(event) => setAuthorInstructions(event.target.value)}
                  placeholder='For example: suggest details that fit a river trade town.'
                />
              </details>
              <ModelRunProgress run={modelRun} />
              {error && <p className={styles.error} role='alert'>{error}</p>}
              {!lab.isLoaded ? null : providerIssue ? (
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
                <button
                  type='button'
                  className={styles.primary}
                  onClick={() => void draftProfile()}
                  disabled={
                    !description.trim() || modelRun.isRunning || !lab.isLoaded || Boolean(providerIssue) || !consultationEnabled
                  }
                >
                  Draft profile
                </button>
              </div>
            </>
          ) : (
            <>
              <label className={styles.field}>
                <span>Name</span>
                <input
                  className={styles.textInput}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              {!name.trim() && (
                <p className={styles.hint}>
                  {profile.droppedName
                    ? 'The model offered a name your description does not use, so it was left out. '
                    : 'Your description does not name this character. '}
                  Add a name to continue.
                </p>
              )}
              {collisions.length > 0 && (
                <fieldset className={styles.castPicker}>
                  <legend>
                    {collisions.length === 1 ? 'A character' : 'Characters'} already {collisions.length === 1 ? 'uses' : 'use'} this name
                  </legend>
                  {collisions.map((collision) => (
                    <label key={collision.entityId}>
                      <input
                        type='radio'
                        name='collision-choice'
                        checked={collisionChoice === collision.entityId}
                        onChange={() => setCollisionChoice(collision.entityId)}
                      />
                      Add to {collision.name}
                      {collision.via === 'alias' ? ` (alias “${collision.matchedText}”)` : ''}
                    </label>
                  ))}
                  <label>
                    <input
                      type='radio'
                      name='collision-choice'
                      checked={collisionChoice === SEPARATE}
                      onChange={() => setCollisionChoice(SEPARATE)}
                    />
                    Create a separate character with this name
                  </label>
                </fieldset>
              )}

              <section aria-label='Stable facts'>
                <h3 className={styles.sectionTitle}>Stable facts, for your review</h3>
                {profile.stableFacts.length === 0 ? (
                  <p className={styles.hint}>No facts could be traced to your description.</p>
                ) : (
                  <ul className={styles.choiceList}>
                    {profile.stableFacts.map((fact, index) => (
                      <li key={`${fact.factType}:${fact.value}`}>
                        <label>
                          <input
                            type='checkbox'
                            checked={factKept[index] ?? false}
                            onChange={() =>
                              setFactKept((current) =>
                                current.map((kept, position) => (position === index ? !kept : kept))
                              )
                            }
                          />
                          <span>
                            <strong>{fact.factType}:</strong> {fact.value}
                            {fact.typeUnsure && (
                              <span className={styles.hint}> (type unsure: check it in review)</span>
                            )}
                            <span className={styles.quote}>
                              {`${fact.source === 'auto' ? 'Read directly from' : 'From'} your description: “${fact.evidence.text}”`}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {profile.droppedFactCount > 0 && (
                  <p className={styles.hint}>
                    {profile.droppedFactCount} {profile.droppedFactCount === 1 ? 'fact was' : 'facts were'} left out
                    because {profile.droppedFactCount === 1 ? 'it did' : 'they did'} not quote your description.
                  </p>
                )}
              </section>

              <section aria-label='Suggested details'>
                <h3 className={styles.sectionTitle}>Suggested details, kept as notes</h3>
                {details.length === 0 ? (
                  <p className={styles.hint}>No suggestions.</p>
                ) : (
                  <ul className={styles.choiceList}>
                    {details.map((detail, index) => (
                      <li key={index}>
                        <label>
                          <input
                            type='checkbox'
                            aria-label={`Keep suggestion ${index + 1}`}
                            checked={detail.keep}
                            onChange={() =>
                              setDetails((current) =>
                                current.map((entry, position) =>
                                  position === index ? {...entry, keep: !entry.keep} : entry
                                )
                              )
                            }
                          />
                          <textarea
                            className={styles.textInput}
                            aria-label={`Suggestion ${index + 1}`}
                            rows={2}
                            value={detail.text}
                            onChange={(event) =>
                              setDetails((current) =>
                                current.map((entry, position) =>
                                  position === index ? {...entry, text: event.target.value} : entry
                                )
                              )
                            }
                          />
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <p className={styles.hint}>
                {target?.kind === 'existing'
                  ? `Saves your description and kept suggestions as a Source Note on ${target.name}. Kept facts go to review; nothing is merged.`
                  : 'Creates a draft character marked Needs completion, with your description as its Description and your kept suggestions in its Notes and a linked Source Note. Kept facts go to review.'}
              </p>
              {error && <p className={styles.error} role='alert'>{error}</p>}
              <div className={styles.actions}>
                <button
                  type='button'
                  className={styles.primary}
                  onClick={() => void accept()}
                  disabled={!target || isSaving}
                >
                  {isSaving
                    ? 'Saving…'
                    : target?.kind === 'existing'
                      ? `Add to ${target.name}`
                      : 'Create draft character'}
                </button>
                <button type='button' onClick={startOver} disabled={isSaving}>
                  Edit description
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
