import React from 'react';
import {useAccessibility} from '../../contexts/AccessibilityContext';
import styles from '../../assets/components/EditorAppearanceControl.module.css';

export const EditorAppearanceControl: React.FC = () => {
  const {
    editorFont,
    setEditorFont,
    editorWidth,
    setEditorWidth,
    editorSurface,
    setEditorSurface,
    editorLineHeight,
    setEditorLineHeight,
    sourceNoteView,
    setSourceNoteView
  } = useAccessibility();

  return (
    <div className={styles.container}>
      <h3>Editor Appearance</h3>
      <p className={styles.helper}>
        These controls change the writing surfaces only: how text looks, and which
        view Source Notes open in. The rest of the app is unaffected.
      </p>

      <div className={styles.group}>
        <span className={styles.label}>Text style</span>
        <div className={styles.buttonGroup}>
          <button
            type='button'
            onClick={() => setEditorFont('serif')}
            className={editorFont === 'serif' ? styles.active : ''}
            aria-pressed={editorFont === 'serif'}
          >
            Serif
          </button>
          <button
            type='button'
            onClick={() => setEditorFont('sans')}
            className={editorFont === 'sans' ? styles.active : ''}
            aria-pressed={editorFont === 'sans'}
          >
            Sans
          </button>
          <button
            type='button'
            onClick={() => setEditorFont('dyslexic')}
            className={editorFont === 'dyslexic' ? styles.active : ''}
            aria-pressed={editorFont === 'dyslexic'}
          >
            Dyslexic
          </button>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>Reading width</span>
        <div className={styles.buttonGroup}>
          <button
            type='button'
            onClick={() => setEditorWidth('focused')}
            className={editorWidth === 'focused' ? styles.active : ''}
            aria-pressed={editorWidth === 'focused'}
          >
            Focused
          </button>
          <button
            type='button'
            onClick={() => setEditorWidth('wide')}
            className={editorWidth === 'wide' ? styles.active : ''}
            aria-pressed={editorWidth === 'wide'}
          >
            Wide
          </button>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>Line height</span>
        <div className={styles.buttonGroup}>
          <button
            type='button'
            onClick={() => setEditorLineHeight('compact')}
            className={editorLineHeight === 'compact' ? styles.active : ''}
            aria-pressed={editorLineHeight === 'compact'}
          >
            Compact
          </button>
          <button
            type='button'
            onClick={() => setEditorLineHeight('comfortable')}
            className={editorLineHeight === 'comfortable' ? styles.active : ''}
            aria-pressed={editorLineHeight === 'comfortable'}
          >
            Comfortable
          </button>
          <button
            type='button'
            onClick={() => setEditorLineHeight('airy')}
            className={editorLineHeight === 'airy' ? styles.active : ''}
            aria-pressed={editorLineHeight === 'airy'}
          >
            Airy
          </button>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>Editor surface</span>
        <div className={styles.buttonGroup}>
          <button
            type='button'
            onClick={() => setEditorSurface('paper')}
            className={editorSurface === 'paper' ? styles.active : ''}
            aria-pressed={editorSurface === 'paper'}
          >
            Paper
          </button>
          <button
            type='button'
            onClick={() => setEditorSurface('mist')}
            className={editorSurface === 'mist' ? styles.active : ''}
            aria-pressed={editorSurface === 'mist'}
          >
            Mist
          </button>
          <button
            type='button'
            onClick={() => setEditorSurface('contrast')}
            className={editorSurface === 'contrast' ? styles.active : ''}
            aria-pressed={editorSurface === 'contrast'}
          >
            Contrast
          </button>
        </div>
      </div>

      <div className={styles.group}>
        <span className={styles.label}>Source Notes open in</span>
        <div className={styles.buttonGroup}>
          <button
            type='button'
            onClick={() => setSourceNoteView('visual')}
            className={sourceNoteView === 'visual' ? styles.active : ''}
            aria-pressed={sourceNoteView === 'visual'}
          >
            Visual editor
          </button>
          <button
            type='button'
            onClick={() => setSourceNoteView('markdown')}
            className={sourceNoteView === 'markdown' ? styles.active : ''}
            aria-pressed={sourceNoteView === 'markdown'}
          >
            Markdown source
          </button>
        </div>
      </div>
    </div>
  );
};
