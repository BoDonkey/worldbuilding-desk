import {useEffect, useMemo, useState, type FormEvent, type ReactNode} from 'react';
import type {
  EntityCategory,
  LoreDocument,
  WorldCanvasLensKind,
  WorldCanvasQuestion,
  WorldEntity
} from '../../entityTypes';
import type {useWorldCanvas} from '../../hooks/useWorldCanvas';
import {describeError} from '../../services/errors';
import {
  LENS_DEFINITIONS,
  deriveCanvasCanonName,
  findSuggestedCanvasCategory,
  getCanvasEntityLabel,
  resolveCanvasLinks
} from '../../services/worldBible/worldCanvasService';
import styles from './WorldCanvasView.module.css';

interface WorldCanvasViewProps {
  worldCanvas: ReturnType<typeof useWorldCanvas>;
  categories?: EntityCategory[];
  entities?: WorldEntity[];
  loreDocuments?: LoreDocument[];
  onOpenSourceNote?: (documentId: string) => void;
  onOpenEntity?: (entityId: string) => void;
  onProposeCanon?: (proposal: {
    category: EntityCategory;
    name: string;
    target: {type: 'lens'; kind: WorldCanvasLensKind} | {type: 'question'; id: string};
  }) => void;
  onFeedback?: (feedback: {tone: 'success' | 'error'; message: string}) => void;
}

const STATUS_LABELS = {
  open: 'Open',
  answered: 'Answered',
  dropped: 'Dropped'
} as const;

type BridgeTarget =
  | {type: 'lens'; kind: WorldCanvasLensKind; text: string}
  | {type: 'question'; id: string; text: string; lensKind?: WorldCanvasLensKind};

interface CanonDraft {
  key: string;
  target: BridgeTarget;
  categoryId: string;
  name: string;
}

const targetKey = (target: BridgeTarget) =>
  target.type === 'lens' ? `lens:${target.kind}` : `question:${target.id}`;

export function WorldCanvasView({
  worldCanvas,
  categories = [],
  entities = [],
  loreDocuments = [],
  onOpenSourceNote,
  onOpenEntity,
  onProposeCanon,
  onFeedback
}: WorldCanvasViewProps) {
  const [questionText, setQuestionText] = useState('');
  const [questionLensKind, setQuestionLensKind] = useState<WorldCanvasLensKind | ''>('');
  const [questionError, setQuestionError] = useState('');
  const [sourceNoteSelections, setSourceNoteSelections] = useState<Record<string, string>>({});
  const [entitySelections, setEntitySelections] = useState<Record<string, string>>({});
  const [canonDraft, setCanonDraft] = useState<CanonDraft | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const lensByKind = useMemo(
    () => new Map(worldCanvas.canvas?.lenses.map((lens) => [lens.kind, lens]) ?? []),
    [worldCanvas.canvas?.lenses]
  );

  useEffect(() => {
    if (!canonDraft || canonDraft.categoryId || categories.length === 0) return;
    const category = findSuggestedCanvasCategory(
      canonDraft.target.type === 'lens'
        ? canonDraft.target.kind
        : canonDraft.target.lensKind,
      categories
    );
    if (category) {
      setCanonDraft((current) => current ? {...current, categoryId: category.id} : current);
    }
  }, [canonDraft, categories]);

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

  const runBridgeAction = async (
    key: string,
    action: () => Promise<unknown>,
    successMessage: string
  ) => {
    setBusyKey(key);
    try {
      await action();
      onFeedback?.({tone: 'success', message: successMessage});
    } catch (error) {
      onFeedback?.({
        tone: 'error',
        message: describeError(error, 'Unable to update the World Canvas link.')
      });
    } finally {
      setBusyKey(null);
    }
  };

  const openCanonDraft = (target: BridgeTarget) => {
    const category = findSuggestedCanvasCategory(
      target.type === 'lens' ? target.kind : target.lensKind,
      categories
    );
    setCanonDraft({
      key: targetKey(target),
      target,
      categoryId: category?.id ?? '',
      name: deriveCanvasCanonName(target.text)
    });
  };

  const renderCanonDraft = (target: BridgeTarget) => {
    const key = targetKey(target);
    if (canonDraft?.key !== key) return null;
    return (
      <div className={styles.canonDraft}>
        <label>
          Canon category
          <select
            value={canonDraft.categoryId}
            onChange={(event) => setCanonDraft({...canonDraft, categoryId: event.target.value})}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label>
          Canon record name
          <input
            value={canonDraft.name}
            onChange={(event) => setCanonDraft({...canonDraft, name: event.target.value})}
          />
        </label>
        <div className={styles.actionRow}>
          <button
            type='button'
            disabled={!canonDraft.categoryId || !canonDraft.name.trim()}
            onClick={() => {
              const category = categories.find((candidate) => candidate.id === canonDraft.categoryId);
              if (!category || !canonDraft.name.trim()) return;
              onProposeCanon?.({
                category,
                name: canonDraft.name.trim(),
                target: canonDraft.target.type === 'lens'
                  ? {type: 'lens', kind: canonDraft.target.kind}
                  : {type: 'question', id: canonDraft.target.id}
              });
              setCanonDraft(null);
            }}
          >
            Open canon form
          </button>
          <button type='button' onClick={() => setCanonDraft(null)}>Cancel</button>
        </div>
      </div>
    );
  };

  const renderLinkPickers = (params: {
    target: BridgeTarget;
    onLinkSourceNote: (id: string) => Promise<unknown>;
    onLinkEntity: (id: string) => Promise<unknown>;
  }) => {
    const key = targetKey(params.target);
    const sourceNoteId = sourceNoteSelections[key] ?? '';
    const entityId = entitySelections[key] ?? '';
    return (
      <div className={styles.linkPickers}>
        <div className={styles.linkPicker}>
          <label>
            Existing Source Note
            <select
              value={sourceNoteId}
              onChange={(event) => setSourceNoteSelections((current) => ({
                ...current,
                [key]: event.target.value
              }))}
            >
              <option value=''>Choose a Source Note</option>
              {loreDocuments.map((document) => (
                <option key={document.id} value={document.id}>{document.title}</option>
              ))}
            </select>
          </label>
          <button
            type='button'
            disabled={!sourceNoteId || busyKey === `${key}:note-link`}
            onClick={() => void runBridgeAction(
              `${key}:note-link`,
              () => params.onLinkSourceNote(sourceNoteId),
              'Source Note linked from World Canvas.'
            )}
          >
            Link existing note
          </button>
        </div>
        <div className={styles.linkPicker}>
          <label>
            Existing World Bible record
            <select
              value={entityId}
              onChange={(event) => setEntitySelections((current) => ({
                ...current,
                [key]: event.target.value
              }))}
            >
              <option value=''>Choose a record</option>
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {getCanvasEntityLabel(entity, categories)}
                </option>
              ))}
            </select>
          </label>
          <button
            type='button'
            disabled={!entityId || busyKey === `${key}:entity-link`}
            onClick={() => void runBridgeAction(
              `${key}:entity-link`,
              () => params.onLinkEntity(entityId),
              'World Bible record linked from World Canvas.'
            )}
          >
            Link existing record
          </button>
        </div>
      </div>
    );
  };

  const renderChips = (params: {
    target: BridgeTarget;
    sourceNoteIds: string[];
    entityIds: string[];
    onUnlinkSourceNote: (id: string) => Promise<unknown>;
    onUnlinkEntity: (id: string) => Promise<unknown>;
  }) => {
    const key = targetKey(params.target);
    const sourceNoteLinks = resolveCanvasLinks(
      params.sourceNoteIds,
      loreDocuments,
      (note) => note.title
    );
    const entityLinks = resolveCanvasLinks(params.entityIds, entities, (entity) => entity.name);
    if (sourceNoteLinks.length === 0 && entityLinks.length === 0) return null;
    return (
      <div className={styles.chipList} aria-label='World Canvas links'>
        {sourceNoteLinks.map((link) => (
          <span className={styles.chip} key={`note:${link.id}`}>
            Source Note: {link.label}
            {!link.missing && (
              <button type='button' onClick={() => onOpenSourceNote?.(link.id)}>Open note</button>
            )}
            <button
              type='button'
              onClick={() => void runBridgeAction(
                `${key}:note-unlink:${link.id}`,
                () => params.onUnlinkSourceNote(link.id),
                'Source Note unlinked from World Canvas.'
              )}
            >
              Unlink
            </button>
          </span>
        ))}
        {entityLinks.map((link) => (
          <span className={styles.chip} key={`entity:${link.id}`}>
            World Bible: {link.label}
            {!link.missing && (
              <button type='button' onClick={() => onOpenEntity?.(link.id)}>Open record</button>
            )}
            <button
              type='button'
              onClick={() => void runBridgeAction(
                `${key}:entity-unlink:${link.id}`,
                () => params.onUnlinkEntity(link.id),
                'World Bible record unlinked from World Canvas.'
              )}
            >
              Unlink
            </button>
          </span>
        ))}
      </div>
    );
  };

  const renderBridgeActions = (params: {
    target: BridgeTarget;
    sourceNoteIds: string[];
    entityIds: string[];
    onKeep: () => Promise<LoreDocument | null>;
    onLinkSourceNote: (id: string) => Promise<unknown>;
    onLinkEntity: (id: string) => Promise<unknown>;
    onUnlinkSourceNote: (id: string) => Promise<unknown>;
    onUnlinkEntity: (id: string) => Promise<unknown>;
    extraAction?: ReactNode;
  }) => {
    const key = targetKey(params.target);
    return (
      <div className={styles.bridgePanel}>
        {renderChips(params)}
        <div className={styles.actionRow}>
          <button
            type='button'
            disabled={busyKey === `${key}:keep`}
            onClick={() => void runBridgeAction(
              `${key}:keep`,
              params.onKeep,
              'Source Note created from World Canvas.'
            )}
          >
            {busyKey === `${key}:keep` ? 'Creating...' : 'Keep as Source Note'}
          </button>
          <button type='button' onClick={() => openCanonDraft(params.target)}>
            Propose as canon
          </button>
          {params.extraAction}
        </div>
        {renderLinkPickers(params)}
        {renderCanonDraft(params.target)}
      </div>
    );
  };

  const renderQuestionBridge = (question: WorldCanvasQuestion) => {
    const target: BridgeTarget = {
      type: 'question',
      id: question.id,
      text: question.text,
      lensKind: question.lensKind
    };
    return renderBridgeActions({
      target,
      sourceNoteIds: question.linkedSourceNoteId ? [question.linkedSourceNoteId] : [],
      entityIds: question.linkedEntityId ? [question.linkedEntityId] : [],
      onKeep: () => worldCanvas.keepQuestionAsSourceNote(question.id),
      onLinkSourceNote: (id) => worldCanvas.linkQuestionSourceNote(question.id, id),
      onLinkEntity: (id) => worldCanvas.linkQuestionEntity(question.id, id),
      onUnlinkSourceNote: () => worldCanvas.linkQuestionSourceNote(question.id, undefined),
      onUnlinkEntity: () => worldCanvas.linkQuestionEntity(question.id, undefined),
      extraAction: question.status !== 'answered' ? (
        <button
          type='button'
          onClick={() => worldCanvas.updateQuestion(question.id, {status: 'answered'})}
        >
          Mark answered
        </button>
      ) : undefined
    });
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
            const target: BridgeTarget = {type: 'lens', kind: definition.kind, text: lens.note};
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
                {renderBridgeActions({
                  target,
                  sourceNoteIds: lens.linkedSourceNoteIds,
                  entityIds: lens.linkedEntityIds,
                  onKeep: () => worldCanvas.keepLensAsSourceNote(definition.kind),
                  onLinkSourceNote: (id) => worldCanvas.linkLensSourceNote(definition.kind, id),
                  onLinkEntity: (id) => worldCanvas.linkLensEntity(definition.kind, id),
                  onUnlinkSourceNote: (id) =>
                    worldCanvas.unlinkLensTarget(definition.kind, 'source-note', id),
                  onUnlinkEntity: (id) =>
                    worldCanvas.unlinkLensTarget(definition.kind, 'entity', id)
                })}
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
              <div className={styles.questionEditGrid}>
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
              </div>
              {renderQuestionBridge(question)}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
