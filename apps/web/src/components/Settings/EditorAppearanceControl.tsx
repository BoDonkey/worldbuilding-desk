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
    setEditorSurface
  } = useAccessibility();

  return (
    <div className={styles.container}>
      <h3>Editor Appearance</h3>
      <p className={styles.helper}>
        These controls change the writing surface only, so you can tune readability
        without affecting the rest of the app.
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
    </div>
  );
};
