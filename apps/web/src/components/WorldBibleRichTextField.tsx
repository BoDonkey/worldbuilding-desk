import {useEffect, useMemo, useState} from 'react';
import TipTapEditor from './TipTapEditor';
import styles from '../assets/components/WorldBibleRichTextField.module.css';
import {
  extractPlainTextFromRichText,
  normalizeRichTextValue
} from '../services/worldBible/worldBibleEntityHelpers';

interface WorldBibleRichTextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  variant?: 'default' | 'character';
}

export function WorldBibleRichTextField({
  label,
  value,
  onChange,
  required = false,
  variant = 'default'
}: WorldBibleRichTextFieldProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const plainTextLength = useMemo(() => extractPlainTextFromRichText(value).length, [value]);
  const normalizedValue = useMemo(() => normalizeRichTextValue(value), [value]);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded]);

  return (
    <>
      <div
        className={`${styles.container} ${
          variant === 'character' ? styles.characterField : ''
        }`}
        data-rich-text-variant={variant}
      >
        <div className={styles.header}>
          <span className={styles.label}>
            {label}
            {required ? ' *' : ''}
          </span>
          <div className={styles.actions}>
            <span className={styles.meta}>{plainTextLength} chars</span>
            <button
              type='button'
              className={styles.toggle}
              onClick={() => setIsExpanded(true)}
            >
              Expand to document
            </button>
          </div>
        </div>
        <TipTapEditor
          content={normalizedValue}
          onChange={onChange}
        />
      </div>

      {isExpanded && (
        <div
          className={styles.overlay}
          role='dialog'
          aria-modal='true'
          aria-label={`${label} document editor`}
          onClick={() => setIsExpanded(false)}
        >
          <div
            className={`${styles.overlayCard} ${
              variant === 'character' ? styles.characterOverlayCard : ''
            }`}
            data-rich-text-variant={variant}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.overlayHeader}>
              <div>
                <div className={styles.overlayEyebrow}>World Bible document</div>
                <h3 className={styles.overlayTitle}>
                  {label}
                  {required ? ' *' : ''}
                </h3>
              </div>
              <div className={styles.actions}>
                <span className={styles.meta}>{plainTextLength} chars</span>
                <button
                  type='button'
                  className={styles.toggle}
                  onClick={() => setIsExpanded(false)}
                >
                  Close document
                </button>
              </div>
            </div>
            <TipTapEditor
              content={normalizedValue}
              onChange={onChange}
            />
          </div>
        </div>
      )}
    </>
  );
}
