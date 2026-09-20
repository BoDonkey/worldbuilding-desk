import {useCallback, useEffect, useRef, useState} from 'react';
import type {
  WorldCanvasDocument,
  WorldCanvasLensKind,
  WorldCanvasQuestion
} from '../entityTypes';
import {useStatusAnnouncement} from './useStatusAnnouncement';
import {getWorldCanvasByProjectId, saveWorldCanvas} from '../worldCanvasStorage';
import {saveLoreDocument} from '../loreStorage';
import type {RAGProvider} from '../services/rag/RAGService';
import {
  addQuestion,
  buildSourceNoteFromBrainstormItem,
  buildSourceNoteFromLens,
  buildSourceNoteFromQuestion,
  collapseLens,
  createEmptyWorldCanvas,
  linkLensEntity,
  linkLensSourceNote,
  linkQuestionEntity,
  linkQuestionSourceNote,
  openLens,
  unlinkLensTarget,
  updateLensNote,
  updateQuestion
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
    if (!projectId) {
      setCanvas(null);
      setStatus('idle');
      setLastSavedAt(null);
      setHydrated(false);
      setDirty(false);
      return;
    }

    let cancelled = false;
    setHydrated(false);
    setStatus('loading');
    getWorldCanvasByProjectId(projectId)
      .then((stored) => {
        if (cancelled) return;
        const next = stored ?? createEmptyWorldCanvas(projectId);
        setCanvas(next);
        setLastSavedAt(stored?.updatedAt ?? null);
        setHydrated(true);
        setDirty(false);
        setStatus('saved');
      })
      .catch(() => {
        if (cancelled) return;
        setCanvas(createEmptyWorldCanvas(projectId));
        setHydrated(true);
        setDirty(false);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !canvas || !isHydrated || !isDirty) return;
    const revision = revisionRef.current;
    setStatus('saving');
    const timeoutId = window.setTimeout(() => {
      saveWorldCanvas(canvas)
        .then(() => {
          if (revisionRef.current !== revision) return;
          setLastSavedAt(canvas.updatedAt);
          setDirty(false);
          setStatus('saved');
          announceStatus('World Canvas saved.');
        })
        .catch(() => {
          if (revisionRef.current === revision) setStatus('error');
        });
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [announceStatus, canvas, isDirty, isHydrated, projectId]);

  const changeCanvas = useCallback(
    (update: (current: WorldCanvasDocument) => WorldCanvasDocument) => {
      setCanvas((current) => {
        if (!current) return current;
        const next = update(current);
        if (next === current) return current;
        revisionRef.current += 1;
        setDirty(true);
        return next;
      });
    },
    []
  );

  const changeCanvasAndSave = useCallback(async (
    update: (current: WorldCanvasDocument) => WorldCanvasDocument
  ) => {
    if (!canvas) return null;
    const next = update(canvas);
    if (next === canvas) return canvas;
    revisionRef.current += 1;
    setCanvas(next);
    setDirty(false);
    setStatus('saving');
    try {
      await saveWorldCanvas(next);
      setLastSavedAt(next.updatedAt);
      setStatus('saved');
      announceStatus('World Canvas saved.');
      return next;
    } catch (error) {
      setDirty(true);
      setStatus('error');
      throw error;
    }
  }, [announceStatus, canvas]);

  const setPremise = useCallback((premise: string) => {
    changeCanvas((current) => ({...current, premise, updatedAt: Date.now()}));
  }, [changeCanvas]);

  const handleOpenLens = useCallback((kind: WorldCanvasLensKind) => {
    changeCanvas((current) => openLens(current, kind));
  }, [changeCanvas]);

  const handleCollapseLens = useCallback((kind: WorldCanvasLensKind) => {
    changeCanvas((current) => collapseLens(current, kind));
  }, [changeCanvas]);

  const setLensNote = useCallback((kind: WorldCanvasLensKind, note: string) => {
    changeCanvas((current) => updateLensNote(current, kind, note));
  }, [changeCanvas]);

  const handleAddQuestion = useCallback((
    text: string,
    lensKind?: WorldCanvasLensKind,
    origin?: WorldCanvasQuestion['origin']
  ) => {
    changeCanvas((current) => addQuestion(current, text, lensKind, origin));
  }, [changeCanvas]);

  const handleUpdateQuestion = useCallback((
    questionId: string,
    updates: Partial<Pick<WorldCanvasQuestion, 'text' | 'status' | 'lensKind'>>
  ) => {
    changeCanvas((current) => updateQuestion(current, questionId, updates));
  }, [changeCanvas]);

  const indexSourceNote = useCallback(async (document: ReturnType<typeof buildSourceNoteFromLens>) => {
    if (!ragService) return;
    await ragService.indexDocument(
      `lore:${document.id}`,
      document.title,
      document.content,
      'lore',
      {tags: [document.kind, 'lore'], entityIds: []}
    );
  }, [ragService]);

  const keepLensAsSourceNote = useCallback(async (kind: WorldCanvasLensKind) => {
    if (!canvas) return null;
    const lens = canvas.lenses.find((candidate) => candidate.kind === kind);
    if (!lens) return null;
    const document = buildSourceNoteFromLens(lens, canvas);
    await saveLoreDocument(document);
    await indexSourceNote(document);
    await changeCanvasAndSave((current) => linkLensSourceNote(current, kind, document.id));
    return document;
  }, [canvas, changeCanvasAndSave, indexSourceNote]);

  const keepQuestionAsSourceNote = useCallback(async (questionId: string) => {
    if (!canvas) return null;
    const question = canvas.questions.find((candidate) => candidate.id === questionId);
    if (!question) return null;
    const document = buildSourceNoteFromQuestion(question, canvas.projectId);
    await saveLoreDocument(document);
    await indexSourceNote(document);
    await changeCanvasAndSave((current) =>
      linkQuestionSourceNote(current, questionId, document.id)
    );
    return document;
  }, [canvas, changeCanvasAndSave, indexSourceNote]);

  const keepBrainstormItemAsSourceNote = useCallback(async (item: {
    lensKind?: WorldCanvasLensKind;
    kindLabel: string;
    text: string;
  }) => {
    if (!canvas) return null;
    const document = buildSourceNoteFromBrainstormItem({projectId: canvas.projectId, ...item});
    await saveLoreDocument(document);
    await indexSourceNote(document);
    const {lensKind} = item;
    if (lensKind) {
      await changeCanvasAndSave((current) => linkLensSourceNote(current, lensKind, document.id));
    }
    return document;
  }, [canvas, changeCanvasAndSave, indexSourceNote]);

  const handleLinkLensSourceNote = useCallback(
    (kind: WorldCanvasLensKind, sourceNoteId: string) =>
      changeCanvasAndSave((current) => linkLensSourceNote(current, kind, sourceNoteId)),
    [changeCanvasAndSave]
  );
  const handleLinkLensEntity = useCallback(
    (kind: WorldCanvasLensKind, entityId: string) =>
      changeCanvasAndSave((current) => linkLensEntity(current, kind, entityId)),
    [changeCanvasAndSave]
  );
  const handleUnlinkLensTarget = useCallback((
    kind: WorldCanvasLensKind,
    target: 'source-note' | 'entity',
    targetId: string
  ) => changeCanvasAndSave((current) => unlinkLensTarget(current, kind, target, targetId)), [changeCanvasAndSave]);
  const handleLinkQuestionSourceNote = useCallback(
    (questionId: string, sourceNoteId?: string) =>
      changeCanvasAndSave((current) =>
        linkQuestionSourceNote(current, questionId, sourceNoteId)
      ),
    [changeCanvasAndSave]
  );
  const handleLinkQuestionEntity = useCallback(
    (questionId: string, entityId?: string) =>
      changeCanvasAndSave((current) => linkQuestionEntity(current, questionId, entityId)),
    [changeCanvasAndSave]
  );

  return {
    canvas,
    status,
    lastSavedAt,
    setPremise,
    openLens: handleOpenLens,
    collapseLens: handleCollapseLens,
    setLensNote,
    addQuestion: handleAddQuestion,
    updateQuestion: handleUpdateQuestion,
    keepLensAsSourceNote,
    keepQuestionAsSourceNote,
    keepBrainstormItemAsSourceNote,
    linkLensSourceNote: handleLinkLensSourceNote,
    linkLensEntity: handleLinkLensEntity,
    unlinkLensTarget: handleUnlinkLensTarget,
    linkQuestionSourceNote: handleLinkQuestionSourceNote,
    linkQuestionEntity: handleLinkQuestionEntity
  };
}
