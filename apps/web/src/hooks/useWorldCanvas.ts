import {useCallback, useEffect, useRef, useState} from 'react';
import type {
  WorldCanvasDocument,
  WorldCanvasLensKind,
  WorldCanvasQuestion
} from '../entityTypes';
import {useStatusAnnouncement} from './useStatusAnnouncement';
import {getWorldCanvasByProjectId, saveWorldCanvas} from '../worldCanvasStorage';
import {
  addQuestion,
  createEmptyWorldCanvas,
  openLens,
  updateLensNote,
  updateQuestion
} from '../services/worldBible/worldCanvasService';

export type WorldCanvasSaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export function useWorldCanvas(projectId: string | null) {
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

  const setPremise = useCallback((premise: string) => {
    changeCanvas((current) => ({...current, premise, updatedAt: Date.now()}));
  }, [changeCanvas]);

  const handleOpenLens = useCallback((kind: WorldCanvasLensKind) => {
    changeCanvas((current) => openLens(current, kind));
  }, [changeCanvas]);

  const setLensNote = useCallback((kind: WorldCanvasLensKind, note: string) => {
    changeCanvas((current) => updateLensNote(current, kind, note));
  }, [changeCanvas]);

  const handleAddQuestion = useCallback((text: string, lensKind?: WorldCanvasLensKind) => {
    changeCanvas((current) => addQuestion(current, text, lensKind));
  }, [changeCanvas]);

  const handleUpdateQuestion = useCallback((
    questionId: string,
    updates: Partial<Pick<WorldCanvasQuestion, 'text' | 'status' | 'lensKind'>>
  ) => {
    changeCanvas((current) => updateQuestion(current, questionId, updates));
  }, [changeCanvas]);

  return {
    canvas,
    status,
    lastSavedAt,
    setPremise,
    openLens: handleOpenLens,
    setLensNote,
    addQuestion: handleAddQuestion,
    updateQuestion: handleUpdateQuestion
  };
}
