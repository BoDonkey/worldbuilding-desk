import {useId, useState} from 'react';
import {
  readExportParagraphStyle,
  writeExportParagraphStyle,
  type ExportParagraphStyle
} from '../../utils/exportParagraphStyle';
import styles from './ExportParagraphStyleChoice.module.css';

const HINTS: Record<ExportParagraphStyle, string> = {
  indented: 'First-line indents and no gap, like a printed book.',
  spaced: 'A gap between paragraphs and no indent.'
};

/**
 * The Paragraphs choice for EPUB and DOCX exports (slice 4.98), remembered for
 * this project on this computer. Export reads the stored value when it runs.
 */
export function ExportParagraphStyleChoice({projectId, note}: {projectId: string; note?: string}) {
  const [style, setStyle] = useState<ExportParagraphStyle>(() => readExportParagraphStyle(projectId));
  const selectId = useId();
  const hintId = useId();
  return (
    <div className={styles.choice}>
      <label htmlFor={selectId} className={styles.label}>Paragraphs</label>
      <select
        id={selectId}
        value={style}
        aria-describedby={hintId}
        onChange={(event) => {
          const next = event.target.value as ExportParagraphStyle;
          setStyle(next);
          writeExportParagraphStyle(projectId, next);
        }}
      >
        <option value='indented'>Indented</option>
        <option value='spaced'>Spaced</option>
      </select>
      <span id={hintId} className={styles.hint}>
        {HINTS[style]}
        {note ? ` ${note}` : ''}
      </span>
    </div>
  );
}
