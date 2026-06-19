import {useEffect, useMemo, useState} from 'react';
import {useWorkspaceScratchpad} from '../hooks/useWorkspaceScratchpad';
import {normalizeRichTextValue} from '../services/worldBible/worldBibleEntityHelpers';
import TipTapEditor from './TipTapEditor';
import styles from '../assets/components/ProjectScratchpadButton.module.css';

interface ProjectScratchpadButtonProps {
  projectId: string;
  className?: string;
}

export function ProjectScratchpadButton({
  projectId,
  className
}: ProjectScratchpadButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    scratchpadContent,
    setScratchpadContent,
    scratchpadStatus,
    scratchpadLastSavedAt
  } = useWorkspaceScratchpad(projectId);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const scratchpadStatusLabel = useMemo(() => {
    if (scratchpadStatus === 'loading') return 'Loading scratchpad...';
    if (scratchpadStatus === 'saving') return 'Saving scratchpad...';
    if (scratchpadStatus === 'error') return 'Scratchpad could not be saved.';
    if (scratchpadLastSavedAt) {
      return `Scratchpad saved at ${new Date(scratchpadLastSavedAt).toLocaleTimeString()}`;
    }
    return 'Scratchpad ready.';
  }, [scratchpadLastSavedAt, scratchpadStatus]);

  return (
    <>
      <button
        type='button'
        className={[styles.trigger, className].filter(Boolean).join(' ')}
        onClick={() => setIsOpen(true)}
      >
        Scratchpad
      </button>

      {isOpen && (
        <div
          role='dialog'
          aria-modal='true'
          aria-label='Project scratchpad'
          className={styles.overlay}
          onClick={() => setIsOpen(false)}
        >
          <div className={styles.card} onClick={(event) => event.stopPropagation()}>
            <div className={styles.header}>
              <div>
                <h2>Scratchpad</h2>
                <p>Loose project notes that can become lore, canon, or World Bible entries later.</p>
              </div>
              <button
                type='button'
                className={styles.secondaryButton}
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>

            <div className={styles.editorShell} aria-label='Project scratchpad'>
              <TipTapEditor
                content={normalizeRichTextValue(scratchpadContent)}
                onChange={setScratchpadContent}
              />
            </div>

            <div className={styles.footer}>
              <div className={styles.status} role='status'>
                {scratchpadStatusLabel}
              </div>
              <button type='button' onClick={() => setIsOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
