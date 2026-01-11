import React from 'react';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import styles from '../../assets/components/FontSizeControl.module.css';

export const FontSizeControl: React.FC = () => {
  const { fontSize, setFontSize } = useAccessibility();

  return (
    <div className={styles.container}>
      <h3>Font Size</h3>
      <div className={styles.buttonGroup}>
        <button
          onClick={() => setFontSize('small')}
          className={fontSize === 'small' ? styles.active : ''}
          aria-pressed={fontSize === 'small'}
        >
          Small
        </button>
        <button
          onClick={() => setFontSize('medium')}
          className={fontSize === 'medium' ? styles.active : ''}
          aria-pressed={fontSize === 'medium'}
        >
          Medium
        </button>
        <button
          onClick={() => setFontSize('large')}
          className={fontSize === 'large' ? styles.active : ''}
          aria-pressed={fontSize === 'large'}
        >
          Large
        </button>
      </div>
    </div>
  );
};