import {useId, useState} from 'react';
import type {LoreDocumentFormat} from '../../entityTypes';
import {useAccessibility} from '../../contexts/AccessibilityContext';
import {SourceNoteEditor} from './SourceNoteEditor';
import styles from './SourceNoteContentField.module.css';

/** `formatted` is the visual editor; `edit` is the stored text in a plain textarea. */
export type SourceNoteContentView = 'formatted' | 'edit';

interface SourceNoteContentFieldProps {
  content: string;
  format: LoreDocumentFormat;
  /** This note's view, or null to follow the author's preference. */
  view: SourceNoteContentView | null;
  onViewChange: (view: SourceNoteContentView) => void;
  onChange: (content: string) => void;
  onFormatChange: (format: LoreDocumentFormat) => void;
}

export const SourceNoteContentField = ({
  content,
  format,
  view: noteView,
  onViewChange,
  onChange,
  onFormatChange
}: SourceNoteContentFieldProps) => {
  const labelId = useId();
  const {sourceNoteView, setSourceNoteView} = useAccessibility();
  const preferredView: SourceNoteContentView = sourceNoteView === 'markdown' ? 'edit' : 'formatted';
  const view = noteView ?? preferredView;
  const isMarkdown = format === 'markdown';
  // The visual editor owns its document once mounted; content that arrives
  // from anywhere else (another note, an import, the textarea) remounts it.
  const [editorContent, setEditorContent] = useState(content);
  const [editorKey, setEditorKey] = useState(0);
  if (content !== editorContent) {
    setEditorContent(content);
    setEditorKey((key) => key + 1);
  }
  const handleEditorChange = (next: string, nextFormat: LoreDocumentFormat) => {
    setEditorContent(next);
    onChange(next);
    if (nextFormat !== format) onFormatChange(nextFormat);
  };

  return (
    <div className={styles.field}>
      <div className={styles.header}>
        <span id={labelId} className={styles.label}>
          Content
        </span>
        <div className={styles.viewActions}>
          {view !== preferredView ? (
            <button
              type='button'
              className={styles.rememberButton}
              onClick={() => setSourceNoteView(view === 'edit' ? 'markdown' : 'visual')}
            >
              Always open notes this way
            </button>
          ) : null}
          <button
            type='button'
            onClick={() => onViewChange(view === 'formatted' ? 'edit' : 'formatted')}
          >
            {view === 'edit' ? 'Visual editor' : isMarkdown ? 'Edit Markdown' : 'Edit text'}
          </button>
        </div>
      </div>
      {view === 'edit' ? (
        <>
          <textarea
            aria-labelledby={labelId}
            value={content}
            onChange={(event) => onChange(event.target.value)}
            rows={18}
          />
          <p className={styles.hint}>
            {isMarkdown
              ? 'Markdown: # headings, - lists, **bold**, _italic_, and | pipe | tables |.'
              : 'Plain text. Editing in the visual editor saves this note as Markdown.'}
          </p>
        </>
      ) : (
        <SourceNoteEditor
          key={editorKey}
          content={content}
          format={format}
          labelId={labelId}
          onChange={handleEditorChange}
        />
      )}
    </div>
  );
};
