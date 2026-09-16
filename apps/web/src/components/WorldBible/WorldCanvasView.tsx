import {useMemo, useState, type FormEvent} from 'react';
import type {WorldCanvasLensKind} from '../../entityTypes';
import type {useWorldCanvas} from '../../hooks/useWorldCanvas';
import {LENS_DEFINITIONS} from '../../services/worldBible/worldCanvasService';
import styles from './WorldCanvasView.module.css';

interface WorldCanvasViewProps {
  worldCanvas: ReturnType<typeof useWorldCanvas>;
}

const STATUS_LABELS = {
  open: 'Open',
  answered: 'Answered',
  dropped: 'Dropped'
} as const;

export function WorldCanvasView({worldCanvas}: WorldCanvasViewProps) {
  const [questionText, setQuestionText] = useState('');
  const [questionLensKind, setQuestionLensKind] = useState<WorldCanvasLensKind | ''>('');
  const [questionError, setQuestionError] = useState('');
  const lensByKind = useMemo(
    () => new Map(worldCanvas.canvas?.lenses.map((lens) => [lens.kind, lens]) ?? []),
    [worldCanvas.canvas?.lenses]
  );

  if (!worldCanvas.canvas || worldCanvas.status === 'loading') {
    return <section className={styles.section}>Loading World Canvas...</section>;
  }

  const saveStatus = worldCanvas.status === 'saving'
    ? 'Saving...'
    : worldCanvas.status === 'error'
      ? 'World Canvas could not be saved.'
      : worldCanvas.lastSavedAt
        ? `Saved at ${new Date(worldCanvas.lastSavedAt).toLocaleTimeString()}`
        : 'Ready when you are.';

  const handleAddQuestion = (event: FormEvent) => {
    event.preventDefault();
    if (!questionText.trim()) {
      setQuestionError('Enter a question before adding it.');
      return;
    }
    worldCanvas.addQuestion(questionText, questionLensKind || undefined);
    setQuestionText('');
    setQuestionLensKind('');
    setQuestionError('');
  };

  return (
    <div className={styles.canvas}>
      <section className={styles.intro}>
        <h2>World Canvas</h2>
        <p>
          Explore the shape of your world. Nothing here is canon. Every field is optional,
          and you can start writing without filling this in.
        </p>
        <p className={styles.saveStatus}>{saveStatus}</p>
      </section>

      <section className={styles.section} aria-labelledby='world-canvas-premise-heading'>
        <div className={styles.sectionHeader}>
          <div>
            <h3 id='world-canvas-premise-heading'>Premise</h3>
            <p>What makes this story world compelling to explore?</p>
          </div>
        </div>
        <label className={styles.field}>
          World premise
          <textarea
            rows={5}
            value={worldCanvas.canvas.premise}
            onChange={(event) => worldCanvas.setPremise(event.target.value)}
            placeholder='A city powered by borrowed memories begins to forget who built it.'
          />
        </label>
      </section>

      <section className={styles.section} aria-labelledby='world-canvas-lenses-heading'>
        <div className={styles.sectionHeader}>
          <div>
            <h3 id='world-canvas-lenses-heading'>Lenses</h3>
            <p>Open only the perspectives that help this project. Write freely; there are no required fields.</p>
          </div>
        </div>
        <div className={styles.lensList}>
          {LENS_DEFINITIONS.map((definition) => {
            const lens = lensByKind.get(definition.kind);
            if (!lens) {
              return (
                <article key={definition.kind} className={styles.lensRow}>
                  <div>
                    <h4>{definition.label}</h4>
                    <p className={styles.lensCopy}>{definition.prompt}</p>
                  </div>
                  <button type='button' onClick={() => worldCanvas.openLens(definition.kind)}>
                    Open lens
                  </button>
                </article>
              );
            }
            return (
              <article key={definition.kind} className={styles.lensOpen}>
                <div className={styles.lensHeader}>
                  <div>
                    <h4>{definition.label}</h4>
                    <p className={styles.lensCopy}>{definition.prompt}</p>
                  </div>
                </div>
                <label className={styles.field}>
                  {definition.label} notes
                  <textarea
                    rows={6}
                    value={lens.note}
                    onChange={(event) => worldCanvas.setLensNote(definition.kind, event.target.value)}
                  />
                </label>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.section} aria-labelledby='world-canvas-questions-heading'>
        <div className={styles.sectionHeader}>
          <div>
            <h3 id='world-canvas-questions-heading'>Questions</h3>
            <p>Keep uncertainties visible without forcing an answer before the story needs one.</p>
          </div>
        </div>
        <form className={styles.questionForm} onSubmit={handleAddQuestion}>
          <div className={styles.questionField}>
            <label htmlFor='world-canvas-new-question'>New question</label>
            <textarea
              id='world-canvas-new-question'
              rows={2}
              value={questionText}
              aria-invalid={Boolean(questionError)}
              aria-describedby={questionError ? 'world-canvas-question-error' : undefined}
              onChange={(event) => {
                setQuestionText(event.target.value);
                if (questionError) setQuestionError('');
              }}
              placeholder='Who benefits if the old treaty fails?'
            />
            {questionError && (
              <span id='world-canvas-question-error' className={styles.error}>{questionError}</span>
            )}
          </div>
          <div className={styles.questionField}>
            <label htmlFor='world-canvas-question-lens'>Lens (optional)</label>
            <select
              id='world-canvas-question-lens'
              value={questionLensKind}
              onChange={(event) => setQuestionLensKind(event.target.value as WorldCanvasLensKind | '')}
            >
              <option value=''>General</option>
              {LENS_DEFINITIONS.map((definition) => (
                <option key={definition.kind} value={definition.kind}>{definition.label}</option>
              ))}
            </select>
          </div>
          <button type='submit'>Add question</button>
        </form>

        <div className={styles.questionList}>
          {worldCanvas.canvas.questions.length === 0 ? (
            <p className={styles.emptyCopy}>Example: What truth would change how people understand this world?</p>
          ) : worldCanvas.canvas.questions.map((question, index) => (
            <article key={question.id} className={styles.questionCard}>
              <label className={styles.questionField}>
                Question {index + 1}
                <textarea
                  rows={2}
                  value={question.text}
                  onChange={(event) => worldCanvas.updateQuestion(question.id, {text: event.target.value})}
                />
              </label>
              <label className={styles.questionField}>
                Question {index + 1} status
                <select
                  value={question.status}
                  onChange={(event) => worldCanvas.updateQuestion(question.id, {
                    status: event.target.value as typeof question.status
                  })}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
