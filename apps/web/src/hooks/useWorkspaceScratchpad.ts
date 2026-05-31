import {useCallback, useEffect, useRef, useState} from 'react';
import type {ScratchpadDocument} from '../entityTypes';
import {getScratchpadByProjectId, saveScratchpad} from '../scratchpadStorage';

export type ScratchpadSaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export function useWorkspaceScratchpad(projectId: string | null) {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<ScratchpadSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isHydrated, setHydrated] = useState(false);
  const [isDirty, setDirty] = useState(false);
  const createdAtRef = useRef<number | null>(null);

  const updateContent = useCallback((nextContent: string) => {
    setContent(nextContent);
    setDirty(true);
  }, []);

  useEffect(() => {
    if (!projectId) {
      setContent('');
      setStatus('idle');
      setLastSavedAt(null);
      setHydrated(false);
      setDirty(false);
      createdAtRef.current = null;
      return;
    }

    let cancelled = false;
    setHydrated(false);
    setStatus('loading');
    getScratchpadByProjectId(projectId)
      .then((scratchpad) => {
        if (cancelled) return;
        setContent(scratchpad?.content ?? '');
        setLastSavedAt(scratchpad?.updatedAt ?? null);
        createdAtRef.current = scratchpad?.createdAt ?? null;
        setHydrated(true);
        setDirty(false);
        setStatus('saved');
      })
      .catch(() => {
        if (cancelled) return;
        setContent('');
        setHydrated(true);
        setDirty(false);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !isHydrated || !isDirty) return;

    const now = Date.now();
    const scratchpad: ScratchpadDocument = {
      id: projectId,
      projectId,
      content,
      createdAt: createdAtRef.current ?? now,
      updatedAt: now
    };

    setStatus('saving');
    const timeoutId = window.setTimeout(() => {
      saveScratchpad(scratchpad)
        .then(() => {
          setLastSavedAt(scratchpad.updatedAt);
          createdAtRef.current = scratchpad.createdAt;
          setDirty(false);
          setStatus('saved');
        })
        .catch(() => {
          setStatus('error');
        });
    }, 600);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [content, isDirty, isHydrated, projectId]);

  return {
    scratchpadContent: content,
    setScratchpadContent: updateContent,
    scratchpadStatus: status,
    scratchpadLastSavedAt: lastSavedAt
  };
}
