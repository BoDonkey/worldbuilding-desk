import {useEffect, useMemo, useState, type FormEvent, type ReactNode} from 'react';
import type {
  EntityCategory, LoreDocument, ProjectAISettings, WorldCanvasLensKind,
  WorldCanvasOpenThread, WorldCanvasSketch, WorldEntity
} from '../../entityTypes';
import {useConfirmDialog} from '../../hooks/useConfirmDialog';
import {useConsultationBudget} from '../../hooks/useConsultationBudget';
import type {useWorldCanvas} from '../../hooks/useWorldCanvas';
import type {ConsistencyAlias} from '../../services/consistency/aliasStorage';
import {describeError} from '../../services/errors';
import {
  LENS_DEFINITIONS, deriveCanvasCanonName, findSuggestedCanvasCategory,
  getActiveSketch, getCanvasEntityLabel, resolveCanvasLinks
} from '../../services/worldBible/worldCanvasService';
import {collectCanonNames} from '../../services/worldBible/worldCanvasBrainstorm';
import {WorldCanvasBrainstorm} from './WorldCanvasBrainstorm';
import styles from './WorldCanvasView.module.css';

type CanonLinkTarget =
  | {type: 'core-idea'}
  | {type: 'sketch'; kind: WorldCanvasLensKind; sketchId: string}
  | {type: 'open-thread'; id: string};
type BridgeTarget = CanonLinkTarget & {text: string; lensKind?: WorldCanvasLensKind};

interface WorldCanvasViewProps {
  worldCanvas: ReturnType<typeof useWorldCanvas>;
  categories?: EntityCategory[];
  entities?: WorldEntity[];
  loreDocuments?: LoreDocument[];
  aliases?: ConsistencyAlias[];
  aiConfig?: ProjectAISettings;
  onOpenSourceNote?: (documentId: string) => void;
  onOpenEntity?: (entityId: string) => void;
  onProposeCanon?: (proposal: {category: EntityCategory; name: string; target: CanonLinkTarget}) => void;
  onFeedback?: (feedback: {tone: 'success' | 'error'; message: string}) => void;
}

const STATUS_LABELS = {open: 'Open', settled: 'Settled', set_aside: 'Set aside'} as const;
const targetKey = (target: CanonLinkTarget) => target.type === 'core-idea' ? 'core-idea' : target.type === 'sketch' ? `sketch:${target.kind}:${target.sketchId}` : `thread:${target.id}`;

export function WorldCanvasView({
  worldCanvas, categories = [], entities = [], loreDocuments = [], aliases = [], aiConfig,
  onOpenSourceNote, onOpenEntity, onProposeCanon, onFeedback
}: WorldCanvasViewProps) {
  const [threadText, setThreadText] = useState('');
  const [threadLensKind, setThreadLensKind] = useState<WorldCanvasLensKind | ''>('');
  const [threadError, setThreadError] = useState('');
  const [sourceSelections, setSourceSelections] = useState<Record<string, string>>({});
  const [entitySelections, setEntitySelections] = useState<Record<string, string>>({});
  const [canonDraft, setCanonDraft] = useState<{key: string; target: BridgeTarget; categoryId: string; name: string} | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const projectId = worldCanvas.canvas?.projectId ?? '';
  const budget = useConsultationBudget(projectId || null, aiConfig?.inspectorSettings, aiConfig?.provider);
  const {requestConfirm, confirmDialog} = useConfirmDialog();
  const canonNames = useMemo(() => collectCanonNames(entities, aliases), [entities, aliases]);
  const lensByKind = useMemo(() => new Map(worldCanvas.canvas?.lenses.map((lens) => [lens.kind, lens]) ?? []), [worldCanvas.canvas?.lenses]);

  useEffect(() => {
    if (!canonDraft || canonDraft.categoryId || !categories.length) return;
    const category = findSuggestedCanvasCategory(canonDraft.target.lensKind, categories);
    if (category) setCanonDraft((current) => current ? {...current, categoryId: category.id} : null);
  }, [canonDraft, categories]);

  if (!worldCanvas.canvas || worldCanvas.status === 'loading') return <section className={styles.section}>Loading World Canvas...</section>;
  const canvas = worldCanvas.canvas;
  const saveStatus = worldCanvas.status === 'saving' ? 'Saving...' : worldCanvas.status === 'error' ? 'World Canvas could not be saved.' : worldCanvas.lastSavedAt ? `Saved at ${new Date(worldCanvas.lastSavedAt).toLocaleTimeString()}` : 'Ready when you are.';

  const runAction = async (key: string, action: () => Promise<unknown> | unknown, success: string) => {
    setBusyKey(key);
    try {await action(); onFeedback?.({tone: 'success', message: success});}
    catch (error) {console.error(error); onFeedback?.({tone: 'error', message: describeError(error, 'Unable to update World Canvas.')});}
    finally {setBusyKey(null);}
  };
  const openCanonDraft = (target: BridgeTarget) => {
    const category = findSuggestedCanvasCategory(target.lensKind, categories);
    setCanonDraft({key: targetKey(target), target, categoryId: category?.id ?? '', name: deriveCanvasCanonName(target.text)});
  };

  const renderCanonDraft = (target: BridgeTarget) => {
    const key = targetKey(target);
    if (canonDraft?.key !== key) return null;
    return <div className={styles.canonDraft}>
      <label>World Bible category<select value={canonDraft.categoryId} onChange={(event) => setCanonDraft({...canonDraft, categoryId: event.target.value})}>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select></label>
      <label>Record name<input value={canonDraft.name} onChange={(event) => setCanonDraft({...canonDraft, name: event.target.value})} /></label>
      <div className={styles.actionRow}>
        <button type='button' disabled={!canonDraft.categoryId || !canonDraft.name.trim()} onClick={() => {
          const category = categories.find((item) => item.id === canonDraft.categoryId);
          if (!category || !canonDraft.name.trim()) return;
          const linkTarget: CanonLinkTarget = canonDraft.target.type === 'core-idea'
            ? {type: 'core-idea'}
            : canonDraft.target.type === 'sketch'
              ? {type: 'sketch', kind: canonDraft.target.kind, sketchId: canonDraft.target.sketchId}
              : {type: 'open-thread', id: canonDraft.target.id};
          onProposeCanon?.({category, name: canonDraft.name.trim(), target: linkTarget}); setCanonDraft(null);
        }}>Open World Bible form</button>
        <button type='button' onClick={() => setCanonDraft(null)}>Cancel</button>
      </div>
    </div>;
  };

  const renderChips = (params: {target: BridgeTarget; sourceIds: string[]; entityIds: string[]; threadIds?: string[]; unlinkSource: (id: string) => Promise<unknown>; unlinkEntity: (id: string) => Promise<unknown>}) => {
    const key = targetKey(params.target);
    const sourceLinks = resolveCanvasLinks(params.sourceIds, loreDocuments, (item) => item.title);
    const entityLinks = resolveCanvasLinks(params.entityIds, entities, (item) => item.name);
    const threadLinks = resolveCanvasLinks(params.threadIds ?? [], canvas.openThreads, (item) => item.text);
    if (!(sourceLinks.length || entityLinks.length || threadLinks.length)) return null;
    return <div className={styles.chipList} aria-label='World Canvas destinations'>
      {sourceLinks.map((link) => <span className={styles.chip} key={`source:${link.id}`}>Source Note: {link.label}{!link.missing && <button type='button' onClick={() => onOpenSourceNote?.(link.id)}>Open</button>}<button type='button' onClick={() => void runAction(`${key}:unlink-source:${link.id}`, () => params.unlinkSource(link.id), 'Source Note unlinked.')}>Unlink</button></span>)}
      {entityLinks.map((link) => <span className={styles.chip} key={`entity:${link.id}`}>World Bible: {link.label}{!link.missing && <button type='button' onClick={() => onOpenEntity?.(link.id)}>Open</button>}<button type='button' onClick={() => void runAction(`${key}:unlink-entity:${link.id}`, () => params.unlinkEntity(link.id), 'World Bible record unlinked.')}>Unlink</button></span>)}
      {threadLinks.map((link) => <span className={styles.chip} key={`thread:${link.id}`}>Open Thread: {link.label}</span>)}
    </div>;
  };

  const renderLinkPickers = (params: {target: BridgeTarget; linkSource: (id: string) => Promise<unknown>; linkEntity: (id: string) => Promise<unknown>}) => {
    const key = targetKey(params.target); const sourceId = sourceSelections[key] ?? ''; const entityId = entitySelections[key] ?? '';
    return <div className={styles.linkPickers}>
      <div className={styles.linkPicker}><label>Existing Source Note<select value={sourceId} onChange={(event) => setSourceSelections((current) => ({...current, [key]: event.target.value}))}><option value=''>Choose a Source Note</option>{loreDocuments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><button type='button' disabled={!sourceId} onClick={() => void runAction(`${key}:source`, () => params.linkSource(sourceId), 'Source Note linked.')}>Link note</button></div>
      <div className={styles.linkPicker}><label>Existing World Bible record<select value={entityId} onChange={(event) => setEntitySelections((current) => ({...current, [key]: event.target.value}))}><option value=''>Choose a record</option>{entities.map((item) => <option key={item.id} value={item.id}>{getCanvasEntityLabel(item, categories)}</option>)}</select></label><button type='button' disabled={!entityId} onClick={() => void runAction(`${key}:entity`, () => params.linkEntity(entityId), 'World Bible record linked.')}>Link record</button></div>
    </div>;
  };

  const renderBridge = (params: {
    target: BridgeTarget; sourceIds: string[]; entityIds: string[]; threadIds?: string[];
    primaryLabel: string; primaryAction: () => Promise<LoreDocument | null>;
    linkSource: (id: string) => Promise<unknown>; linkEntity: (id: string) => Promise<unknown>;
    unlinkSource: (id: string) => Promise<unknown>; unlinkEntity: (id: string) => Promise<unknown>;
    extra?: ReactNode; disablePrimary?: boolean;
  }) => {
    const key = targetKey(params.target);
    return <div className={styles.bridgePanel}>
      {renderChips({...params})}
      <div className={styles.actionRow}>
        <button type='button' disabled={params.disablePrimary || busyKey === `${key}:primary`} onClick={() => void runAction(`${key}:primary`, params.primaryAction, 'Source Note created from World Canvas.')}>{busyKey === `${key}:primary` ? 'Creating...' : params.primaryLabel}</button>
        <button type='button' disabled={!params.target.text.trim()} onClick={() => openCanonDraft(params.target)}>Propose canon anchor</button>
        {params.extra}
      </div>
      <p className={styles.bridgeHelp}>Canon anchors are for named people, places, groups, objects, or concepts. Assertions become canon only through the reviewed canon workflow.</p>
      {renderLinkPickers(params)}
      {renderCanonDraft(params.target)}
    </div>;
  };

  const renderBrainstorm = (focus: {type: 'premise'} | {type: 'lens'; kind: WorldCanvasLensKind}) => <WorldCanvasBrainstorm projectId={projectId} focus={focus} canvas={canvas} canonNames={canonNames} aiConfig={aiConfig} budget={budget} requestConfirm={requestConfirm} onKeepAsSourceNote={worldCanvas.keepBrainstormItemAsSourceNote} onAddOpenThread={(text, lensKind) => worldCanvas.addOpenThread(text, lensKind, 'brainstorm')} onFeedback={onFeedback} />;

  const renderThreadCard = (thread: WorldCanvasOpenThread, index: number) => {
    const target: BridgeTarget = {type: 'open-thread', id: thread.id, text: thread.text, lensKind: thread.lensKind};
    return <article key={thread.id} className={styles.questionCard}>
      {thread.origin === 'brainstorm' && <span className={styles.originBadge}>From World Canvas brainstorm</span>}
      <div className={styles.questionEditGrid}>
        <label className={styles.questionField}>Open Thread {index + 1}<textarea id={`world-canvas-thread-${thread.id}`} rows={2} value={thread.text} onChange={(event) => worldCanvas.updateOpenThread(thread.id, {text: event.target.value})} /></label>
        <label className={styles.questionField}>Status<select value={thread.status} onChange={(event) => worldCanvas.updateOpenThread(thread.id, {status: event.target.value as WorldCanvasOpenThread['status']})}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      {renderBridge({target, sourceIds: thread.linkedSourceNoteId ? [thread.linkedSourceNoteId] : [], entityIds: thread.linkedEntityId ? [thread.linkedEntityId] : [], primaryLabel: 'Develop as Source Note', primaryAction: () => worldCanvas.keepOpenThreadAsSourceNote(thread.id), linkSource: (id) => worldCanvas.linkOpenThreadSourceNote(thread.id, id), linkEntity: (id) => worldCanvas.linkOpenThreadEntity(thread.id, id), unlinkSource: () => worldCanvas.linkOpenThreadSourceNote(thread.id), unlinkEntity: () => worldCanvas.linkOpenThreadEntity(thread.id)})}
    </article>;
  };

  const coreTarget: BridgeTarget = {type: 'core-idea', text: canvas.premise};
  const openThreads = canvas.openThreads.filter((item) => item.status === 'open');
  const threadHistory = canvas.openThreads.filter((item) => item.status !== 'open');

  return <div className={styles.canvas}>
    {confirmDialog}
    <section className={styles.intro}><p>Paint the larger picture behind your story. Each lens is reusable: route a sketch you want to keep, then begin another. Nothing here is canon, and every field is optional.</p><p className={styles.guidanceCopy}>Start here with only a seed of an idea, or return after drafting to deepen existing material. Open Threads hold questions, tensions, possibilities, contradictions, and undecided ideas without forcing an answer.</p><p className={styles.saveStatus}>{saveStatus}</p></section>

    <section className={styles.section} aria-labelledby='world-canvas-premise-heading'>
      <div className={styles.sectionHeader}><div><h3 id='world-canvas-premise-heading'>Core Idea</h3><p>What central idea, tension, or possibility makes this world worth exploring?</p></div></div>
      <label className={styles.field}>Core idea<textarea rows={5} value={canvas.premise} onChange={(event) => worldCanvas.setPremise(event.target.value)} placeholder='A city powered by borrowed memories begins to forget who built it.' /></label>
      {renderBridge({target: coreTarget, sourceIds: canvas.coreIdeaSourceNoteId ? [canvas.coreIdeaSourceNoteId] : [], entityIds: canvas.coreIdeaEntityId ? [canvas.coreIdeaEntityId] : [], primaryLabel: 'Keep as Source Note', primaryAction: worldCanvas.keepCoreIdeaAsSourceNote, disablePrimary: Boolean(canvas.coreIdeaSourceNoteId), linkSource: worldCanvas.linkCoreIdeaSourceNote, linkEntity: worldCanvas.linkCoreIdeaEntity, unlinkSource: () => worldCanvas.linkCoreIdeaSourceNote(), unlinkEntity: () => worldCanvas.linkCoreIdeaEntity()})}
      {renderBrainstorm({type: 'premise'})}
    </section>

    <section className={styles.section} aria-labelledby='world-canvas-lenses-heading'>
      <div className={styles.sectionHeader}><div><h3 id='world-canvas-lenses-heading'>Lenses</h3><p>A directed question stays useful; successive sketches can explore different answers.</p></div></div>
      <div className={styles.lensList}>{LENS_DEFINITIONS.map((definition) => {
        const lens = lensByKind.get(definition.kind);
        if (!lens || lens.isCollapsed) {
          const latest = lens?.sketches.at(-1)?.text.trim() ?? '';
          return <article key={definition.kind} className={styles.lensRow}><div><h4>{definition.label}</h4><p className={styles.lensCopy}>{definition.prompt}</p>{lens && <p className={styles.savedSketchSummary}>{lens.sketches.length} {lens.sketches.length === 1 ? 'sketch' : 'sketches'} · {latest ? `${latest.slice(0, 120)}${latest.length > 120 ? '…' : ''}` : 'No text yet'}</p>}</div><button type='button' aria-label={`Bring ${definition.label} into focus`} onClick={() => worldCanvas.openLens(definition.kind)}>Bring into focus</button></article>;
        }
        const active = getActiveSketch(lens);
        const routed = Boolean(active.linkedSourceNoteIds.length || active.linkedEntityIds.length || active.linkedOpenThreadIds.length);
        const target: BridgeTarget = {type: 'sketch', kind: definition.kind, sketchId: active.id, text: active.text, lensKind: definition.kind};
        return <article key={definition.kind} className={styles.lensOpen}>
          <div className={styles.lensHeader}><div><h4>{definition.label}</h4><p className={styles.lensCopy}>{definition.prompt}</p></div><button type='button' aria-label={`Collapse ${definition.label}`} onClick={() => worldCanvas.collapseLens(definition.kind)}>Collapse</button></div>
          <details className={styles.lensGuidance}><summary>What this lens can uncover</summary><p>{definition.uncovers}</p><ul>{definition.starters.map((starter) => <li key={starter}>{starter}</li>)}</ul></details>
          <label className={styles.field}>{definition.label} working sketch<textarea rows={6} value={active.text} onChange={(event) => worldCanvas.setSketchText(definition.kind, active.id, event.target.value)} /></label>
          {renderBrainstorm({type: 'lens', kind: definition.kind})}
          {renderBridge({target, sourceIds: active.linkedSourceNoteIds, entityIds: active.linkedEntityIds, threadIds: active.linkedOpenThreadIds, primaryLabel: 'Develop as Source Note', primaryAction: () => worldCanvas.developSketchAsSourceNote(definition.kind, active.id), linkSource: (id) => worldCanvas.linkSketchSourceNote(definition.kind, active.id, id), linkEntity: (id) => worldCanvas.linkSketchEntity(definition.kind, active.id, id), unlinkSource: (id) => worldCanvas.unlinkSketchTarget(definition.kind, active.id, 'source-note', id), unlinkEntity: (id) => worldCanvas.unlinkSketchTarget(definition.kind, active.id, 'entity', id), extra: <><button type='button' disabled={!active.text.trim() || active.linkedOpenThreadIds.length > 0} onClick={() => worldCanvas.keepSketchAsOpenThread(definition.kind, active.id)}>Keep as Open Thread</button><button type='button' disabled={!routed} onClick={() => worldCanvas.addAnotherSketch(definition.kind)}>Add another sketch</button></>})}
          {lens.sketches.length > 1 && <div className={styles.sketchHistory}><h5>Sketches from this lens</h5>{lens.sketches.filter((item) => item.id !== active.id).map((sketch, index) => <button type='button' key={sketch.id} className={styles.sketchHistoryItem} onClick={() => worldCanvas.selectSketch(definition.kind, sketch.id)}><span>Sketch {index + 1}: {sketch.text.trim().slice(0, 90) || 'Untitled sketch'}</span><small>{destinationSummary(sketch)}</small></button>)}</div>}
        </article>;
      })}</div>
    </section>

    <section className={styles.section} aria-labelledby='world-canvas-threads-heading'>
      <div className={styles.sectionHeader}><div><h3 id='world-canvas-threads-heading'>Open Threads</h3><p>Keep promising pressure visible without deciding what it means yet.</p></div></div>
      <form className={styles.questionForm} onSubmit={(event: FormEvent) => {event.preventDefault(); if (!threadText.trim()) {setThreadError('Enter an open thread before adding it.'); return;} worldCanvas.addOpenThread(threadText, threadLensKind || undefined); setThreadText(''); setThreadLensKind(''); setThreadError('');}}>
        <div className={styles.questionField}><label htmlFor='world-canvas-new-thread'>Add an open thread</label><textarea id='world-canvas-new-thread' rows={2} value={threadText} aria-invalid={Boolean(threadError)} aria-describedby={threadError ? 'world-canvas-thread-error' : undefined} onChange={(event) => {setThreadText(event.target.value); if (threadError) setThreadError('');}} placeholder='The treaty protects the city and keeps its founders trapped.' />{threadError && <span id='world-canvas-thread-error' className={styles.error}>{threadError}</span>}</div>
        <div className={styles.questionField}><label htmlFor='world-canvas-thread-lens'>Lens (optional)</label><select id='world-canvas-thread-lens' value={threadLensKind} onChange={(event) => setThreadLensKind(event.target.value as WorldCanvasLensKind | '')}><option value=''>General</option>{LENS_DEFINITIONS.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}</select></div>
        <button type='submit'>Add open thread</button>
      </form>
      <div className={styles.questionList}>{openThreads.length ? openThreads.map(renderThreadCard) : <p className={styles.emptyCopy}>No open threads yet. Keep a possibility here when you want to revisit it.</p>}</div>
      {threadHistory.length > 0 && <details className={styles.threadHistory}><summary>Settled and set-aside history ({threadHistory.length})</summary><div className={styles.questionList}>{threadHistory.map((thread) => <article key={thread.id} className={styles.historyRow}><div><strong>{STATUS_LABELS[thread.status]}</strong><p>{thread.text}</p></div><button type='button' onClick={() => worldCanvas.updateOpenThread(thread.id, {status: 'open'})}>Reopen</button></article>)}</div></details>}
    </section>
  </div>;
}

function destinationSummary(sketch: WorldCanvasSketch): string {
  const destinations = [];
  if (sketch.linkedOpenThreadIds.length) destinations.push('Open Thread');
  if (sketch.linkedSourceNoteIds.length) destinations.push('Source Note');
  if (sketch.linkedEntityIds.length) destinations.push('World Bible');
  return destinations.length ? `Routed to ${destinations.join(', ')}` : 'Not routed';
}
