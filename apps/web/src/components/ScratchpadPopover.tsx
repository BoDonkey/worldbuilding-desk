import {useEffect, useMemo, useRef, useState} from 'react';
import type {Project} from '../entityTypes';
import TipTapEditor from './TipTapEditor';
import {ContextPopover} from './Editor/ContextPopover';
import {
  getScratchpadByProjectId,
  saveScratchpad
} from '../scratchpadStorage';
import styles from '../assets/components/ScratchpadPopover.module.css';

interface ScratchpadPopoverProps {
  activeProject: Project | null;
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_CONTENT = '<p></p>';

export function ScratchpadPopover({
  activeProject,
  isOpen,
  onClose
}: ScratchpadPopoverProps) {
  const [content, setContent] = useState(EMPTY_CONTENT);
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const lastSavedContentRef = useRef(EMPTY_CONTENT);
  const hydratedProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !activeProject) {
      return;
    }

    let cancelled = false;
    setStatus('loading');

    void (async () => {
      try {
        const scratchpad = await getScratchpadByProjectId(activeProject.id);
        if (cancelled) {
          return;
        }
        const nextContent = scratchpad?.content || EMPTY_CONTENT;
        setContent(nextContent);
        setCreatedAt(scratchpad?.createdAt ?? null);
        setLastUpdatedAt(scratchpad?.updatedAt ?? null);
        lastSavedContentRef.current = nextContent;
        hydratedProjectIdRef.current = activeProject.id;
        setStatus('idle');
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProject, isOpen]);

  useEffect(() => {
    if (!isOpen || !activeProject) {
      return;
    }
    if (hydratedProjectIdRef.current !== activeProject.id) {
      return;
    }
    if (content === lastSavedContentRef.current) {
      return;
    }

    setStatus('saving');
    const timeoutId = window.setTimeout(() => {
      const now = Date.now();
      void saveScratchpad({
        id: activeProject.id,
        projectId: activeProject.id,
        content,
        createdAt: createdAt ?? now,
        updatedAt: now
      })
        .then(() => {
          lastSavedContentRef.current = content;
          setCreatedAt((current) => current ?? now);
          setLastUpdatedAt(now);
          setStatus('saved');
        })
        .catch(() => {
          setStatus('error');
        });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [activeProject, content, createdAt, isOpen]);

  const saveLabel = useMemo(() => {
    if (!activeProject) {
      return 'Open a project to use the scratchpad.';
    }
    if (status === 'loading') {
      return 'Loading notes...';
    }
    if (status === 'saving') {
      return 'Saving...';
    }
    if (status === 'saved') {
      return 'Saved.';
    }
    if (status === 'error') {
      return 'Save failed. Keep the popover open and edit again to retry.';
    }
    if (lastUpdatedAt) {
      return `Last updated ${new Date(lastUpdatedAt).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
      })}.`;
    }
    return 'Autosaves to this project only.';
  }, [activeProject, lastUpdatedAt, status]);

  if (!isOpen) {
    return null;
  }

  return (
    <ContextPopover
      title='Scratchpad'
      eyebrow={activeProject?.name ?? 'No active project'}
      message='Freeform project notes that stay outside the world bible, consistency review, and backups.'
      left={Math.max(24, window.innerWidth - 760)}
      top={Math.max(24, window.innerHeight - 720)}
      onClose={onClose}
      className={styles.popover}
      bodyClassName={styles.body}
    >
      <div className={styles.metaRow}>
        <span className={styles.status}>{saveLabel}</span>
      </div>
      {activeProject ? (
        <TipTapEditor
          content={content}
          onChange={setContent}
          toolbarMode='basic'
        />
      ) : (
        <p className={styles.emptyState}>
          Select a project first. The scratchpad is stored per project.
        </p>
      )}
    </ContextPopover>
  );
}
