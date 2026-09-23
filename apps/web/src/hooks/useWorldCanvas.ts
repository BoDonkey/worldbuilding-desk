import {useCallback, useEffect, useRef, useState} from 'react';
import type {WorldCanvasDocument, WorldCanvasLensKind, WorldCanvasOpenThread} from '../entityTypes';
import {useStatusAnnouncement} from './useStatusAnnouncement';
import {getWorldCanvasByProjectId, saveWorldCanvas} from '../worldCanvasStorage';
import {saveLoreDocument} from '../loreStorage';
import type {RAGProvider} from '../services/rag/RAGService';
import {
  addAnotherSketch, addOpenThread, buildSourceNoteFromBrainstormItem,
  buildSourceNoteFromCoreIdea, buildSourceNoteFromOpenThread, buildSourceNoteFromSketch,
  collapseLens, createEmptyWorldCanvas, linkCoreIdeaEntity, linkCoreIdeaSourceNote,
  linkOpenThreadEntity, linkOpenThreadSourceNote, linkSketchEntity, linkSketchSourceNote,
  openLens, pinCanvasReference, routeSketchToOpenThread, selectSketch,
  unlinkSketchTarget, unpinCanvasReference, updateOpenThread, updateSketchText,
  type CanvasReferenceTarget
} from '../services/worldBible/worldCanvasService';

export type WorldCanvasSaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export function useWorldCanvas(projectId: string | null, ragService: RAGProvider | null = null) {
  const [canvas, setCanvas] = useState<WorldCanvasDocument | null>(null);
  const [status, setStatus] = useState<WorldCanvasSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isHydrated, setHydrated] = useState(false);
  const [isDirty, setDirty] = useState(false);
  const revisionRef = useRef(0);
  const announceStatus = useStatusAnnouncement();

  useEffect(() => {
    revisionRef.current += 1;
    if (!projectId) {setCanvas(null); setStatus('idle'); setLastSavedAt(null); setHydrated(false); setDirty(false); return;}
    let cancelled = false; setHydrated(false); setStatus('loading');
    getWorldCanvasByProjectId(projectId).then((stored) => {
      if (cancelled) return;
      setCanvas(stored ?? createEmptyWorldCanvas(projectId)); setLastSavedAt(stored?.updatedAt ?? null);
      setHydrated(true); setDirty(false); setStatus('saved');
    }).catch(() => {if (!cancelled) {setCanvas(createEmptyWorldCanvas(projectId)); setHydrated(true); setDirty(false); setStatus('error');}});
    return () => {cancelled = true;};
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !canvas || !isHydrated || !isDirty) return;
    const revision = revisionRef.current; setStatus('saving');
    const timeoutId = window.setTimeout(() => {
      saveWorldCanvas(canvas).then(() => {if (revisionRef.current === revision) {setLastSavedAt(canvas.updatedAt); setDirty(false); setStatus('saved'); announceStatus('World Canvas saved.');}}).catch(() => {if (revisionRef.current === revision) setStatus('error');});
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [announceStatus, canvas, isDirty, isHydrated, projectId]);

  const changeCanvas = useCallback((update: (current: WorldCanvasDocument) => WorldCanvasDocument) => {
    setCanvas((current) => {if (!current) return current; const next = update(current); if (next === current) return current; revisionRef.current += 1; setDirty(true); return next;});
  }, []);
  const changeCanvasAndSave = useCallback(async (update: (current: WorldCanvasDocument) => WorldCanvasDocument) => {
    if (!canvas) return null; const next = update(canvas); if (next === canvas) return canvas;
    revisionRef.current += 1; setCanvas(next); setDirty(false); setStatus('saving');
    try {await saveWorldCanvas(next); setLastSavedAt(next.updatedAt); setStatus('saved'); announceStatus('World Canvas saved.'); return next;}
    catch (error) {setDirty(true); setStatus('error'); throw error;}
  }, [announceStatus, canvas]);

  const indexSourceNote = useCallback(async (document: ReturnType<typeof buildSourceNoteFromSketch>) => {
    if (ragService) await ragService.indexDocument(`lore:${document.id}`, document.title, document.content, 'lore', {tags: [document.kind, 'lore'], entityIds: []});
  }, [ragService]);
  const saveAndIndex = useCallback(async (document: ReturnType<typeof buildSourceNoteFromSketch>) => {await saveLoreDocument(document); await indexSourceNote(document); return document;}, [indexSourceNote]);

  const keepCoreIdeaAsSourceNote = useCallback(async () => {
    if (!canvas) return null;
    if (canvas.coreIdeaSourceNoteId) throw new Error('Core Idea already has a linked Source Note. Unlink it before creating another snapshot.');
    const document = await saveAndIndex(buildSourceNoteFromCoreIdea(canvas));
    await changeCanvasAndSave((current) => linkCoreIdeaSourceNote(current, document.id)); return document;
  }, [canvas, changeCanvasAndSave, saveAndIndex]);
  const developSketchAsSourceNote = useCallback(async (kind: WorldCanvasLensKind, sketchId: string) => {
    if (!canvas) return null; const lens = canvas.lenses.find((item) => item.kind === kind); const sketch = lens?.sketches.find((item) => item.id === sketchId); if (!sketch) return null;
    const document = await saveAndIndex(buildSourceNoteFromSketch(sketch, kind, canvas));
    await changeCanvasAndSave((current) => linkSketchSourceNote(current, kind, sketchId, document.id)); return document;
  }, [canvas, changeCanvasAndSave, saveAndIndex]);
  const keepOpenThreadAsSourceNote = useCallback(async (id: string) => {
    if (!canvas) return null; const thread = canvas.openThreads.find((item) => item.id === id); if (!thread) return null;
    const document = await saveAndIndex(buildSourceNoteFromOpenThread(thread, canvas.projectId));
    await changeCanvasAndSave((current) => linkOpenThreadSourceNote(current, id, document.id)); return document;
  }, [canvas, changeCanvasAndSave, saveAndIndex]);
  const keepBrainstormItemAsSourceNote = useCallback(async (item: {lensKind?: WorldCanvasLensKind; kindLabel: string; text: string}) => {
    if (!canvas) return null;
    const document = await saveAndIndex(buildSourceNoteFromBrainstormItem({projectId: canvas.projectId, ...item}));
    if (item.lensKind) {
      const lens = canvas.lenses.find((candidate) => candidate.kind === item.lensKind);
      if (lens) await changeCanvasAndSave((current) => linkSketchSourceNote(current, item.lensKind!, lens.activeSketchId, document.id));
    }
    return document;
  }, [canvas, changeCanvasAndSave, saveAndIndex]);

  return {
    canvas, status, lastSavedAt,
    setPremise: (premise: string) => changeCanvas((current) => ({...current, premise, updatedAt: Date.now()})),
    openLens: (kind: WorldCanvasLensKind) => changeCanvas((current) => openLens(current, kind)),
    collapseLens: (kind: WorldCanvasLensKind) => changeCanvas((current) => collapseLens(current, kind)),
    setSketchText: (kind: WorldCanvasLensKind, sketchId: string, text: string) => changeCanvas((current) => updateSketchText(current, kind, sketchId, text)),
    selectSketch: (kind: WorldCanvasLensKind, sketchId: string) => changeCanvas((current) => selectSketch(current, kind, sketchId)),
    addAnotherSketch: (kind: WorldCanvasLensKind) => changeCanvas((current) => addAnotherSketch(current, kind)),
    keepSketchAsOpenThread: (kind: WorldCanvasLensKind, sketchId: string) => changeCanvas((current) => routeSketchToOpenThread(current, kind, sketchId)),
    addOpenThread: (text: string, lensKind?: WorldCanvasLensKind, origin?: WorldCanvasOpenThread['origin']) => changeCanvas((current) => addOpenThread(current, text, lensKind, origin)),
    updateOpenThread: (id: string, updates: Partial<Pick<WorldCanvasOpenThread, 'text' | 'status' | 'lensKind'>>) => changeCanvas((current) => updateOpenThread(current, id, updates)),
    keepCoreIdeaAsSourceNote, developSketchAsSourceNote, keepOpenThreadAsSourceNote, keepBrainstormItemAsSourceNote,
    linkCoreIdeaSourceNote: (id?: string) => changeCanvasAndSave((current) => linkCoreIdeaSourceNote(current, id)),
    linkCoreIdeaEntity: (id?: string) => changeCanvasAndSave((current) => linkCoreIdeaEntity(current, id)),
    linkSketchSourceNote: (kind: WorldCanvasLensKind, sketchId: string, id: string) => changeCanvasAndSave((current) => linkSketchSourceNote(current, kind, sketchId, id)),
    linkSketchEntity: (kind: WorldCanvasLensKind, sketchId: string, id: string) => changeCanvasAndSave((current) => linkSketchEntity(current, kind, sketchId, id)),
    unlinkSketchTarget: (kind: WorldCanvasLensKind, sketchId: string, target: 'source-note' | 'entity', id: string) => changeCanvasAndSave((current) => unlinkSketchTarget(current, kind, sketchId, target, id)),
    linkOpenThreadSourceNote: (id: string, noteId?: string) => changeCanvasAndSave((current) => linkOpenThreadSourceNote(current, id, noteId)),
    linkOpenThreadEntity: (id: string, entityId?: string) => changeCanvasAndSave((current) => linkOpenThreadEntity(current, id, entityId)),
    pinReference: (target: CanvasReferenceTarget, lensKind: WorldCanvasLensKind) => changeCanvasAndSave((current) => pinCanvasReference(current, target, lensKind)),
    unpinReference: (target: CanvasReferenceTarget) => changeCanvasAndSave((current) => unpinCanvasReference(current, target))
  };
}
