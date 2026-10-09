import {useId, useMemo} from 'react';
import type {LoreDocumentFormat} from '../../entityTypes';
import {sourceNoteContentToHtml} from '../../services/lore/sourceNoteFormat';
import styles from './SourceNoteContentField.module.css';

export type SourceNoteContentView = 'formatted' | 'edit';

interface SourceNoteContentFieldProps {
  content: string;
  format: LoreDocumentFormat;
  view: SourceNoteContentView;
  onViewChange: (view: SourceNoteContentView) => void;
  onChange: (content: string) => void;
}

/** Source Note body: the formatted note by default, with a switch to edit its text. */
export const SourceNoteContentField = ({
  content,
  format,
  view,
  onViewChange,
  onChange
}: SourceNoteContentFieldProps) => {
  const labelId = useId();
  const html = useMemo(
    () => (view === 'formatted' ? sourceNoteContentToHtml(content, format) : ''),
    [content, format, view]
  );
  const editLabel = format === 'markdown' ? 'Edit Markdown' : 'Edit text';

  return (
    <div className={styles.field}>
      <div className={styles.header}>
        <span id={labelId} className={styles.label}>
          Content
        </span>
        <button
          type='button'
          onClick={() => onViewChange(view === 'formatted' ? 'edit' : 'formatted')}
        >
          {view === 'formatted' ? editLabel : 'Show formatted'}
        </button>
      </div>
      {view === 'edit' ? (
        <>
          <textarea
            aria-labelledby={labelId}
            value={content}
            onChange={(event) => onChange(event.target.value)}
            rows={18}
          />
          {format === 'markdown' ? (
            <p className={styles.hint}>
              Markdown: # headings, - lists, **bold**, *italic*, and | pipe | tables |.
            </p>
          ) : null}
        </>
      ) : html ? (
        <div
          className={styles.formatted}
          role='document'
          aria-labelledby={labelId}
          // Sanitized by sourceNoteContentToHtml: allow-listed tags, safe link schemes only.
          dangerouslySetInnerHTML={{__html: html}}
        />
      ) : (
        <p className={styles.empty}>Nothing written yet.</p>
      )}
    </div>
  );
};
