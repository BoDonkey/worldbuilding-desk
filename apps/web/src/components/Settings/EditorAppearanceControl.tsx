import React from 'react';
import {useAccessibility} from '../../contexts/AccessibilityContext';
import styles from '../../assets/components/EditorAppearanceControl.module.css';
import {CustomFontField} from './CustomFontField';

interface Choice<T extends string> {
  value: T;
  label: string;
}

function ChoiceGroup<T extends string>({
  label,
  choices,
  value,
  onChange
}: {
  label: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.group} role='group' aria-label={label}>
      <span className={styles.label}>{label}</span>
      <div className={styles.buttonGroup}>
        {choices.map((choice) => (
          <button
            key={choice.value}
            type='button'
            onClick={() => onChange(choice.value)}
            className={value === choice.value ? styles.active : ''}
            aria-pressed={value === choice.value}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export const EditorAppearanceControl: React.FC = () => {
  const {
    editorFont,
    setEditorFont,
    editorCustomFont,
    setEditorCustomFont,
    editorWidth,
    setEditorWidth,
    editorSurface,
    setEditorSurface,
    editorLineHeight,
    setEditorLineHeight,
    editorParagraphStyle,
    setEditorParagraphStyle,
    focusModeStart,
    setFocusModeStart,
    editorTypewriter,
    setEditorTypewriter,
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

      <ChoiceGroup
        label='Text style'
        value={editorFont}
        onChange={setEditorFont}
        choices={[
          {value: 'serif', label: 'Serif'},
          {value: 'book', label: 'Book'},
          {value: 'sans', label: 'Sans'},
          {value: 'mono', label: 'Mono'},
          {value: 'dyslexic', label: 'Dyslexic'},
          {value: 'custom', label: 'Custom'}
        ]}
      />
      {editorFont === 'custom' && (
        <CustomFontField value={editorCustomFont} onChange={setEditorCustomFont} />
      )}

      <ChoiceGroup
        label='Reading width'
        value={editorWidth}
        onChange={setEditorWidth}
        choices={[
          {value: 'narrow', label: 'Narrow'},
          {value: 'focused', label: 'Focused'},
          {value: 'wide', label: 'Wide'}
        ]}
      />

      <ChoiceGroup
        label='Line height'
        value={editorLineHeight}
        onChange={setEditorLineHeight}
        choices={[
          {value: 'compact', label: 'Compact'},
          {value: 'comfortable', label: 'Comfortable'},
          {value: 'airy', label: 'Airy'}
        ]}
      />

      <ChoiceGroup
        label='Paragraphs'
        value={editorParagraphStyle}
        onChange={setEditorParagraphStyle}
        choices={[
          {value: 'spaced', label: 'Spaced'},
          {value: 'indented', label: 'Indented'}
        ]}
      />
      <p className={styles.helper}>
        Indented starts each paragraph with a first-line indent and no gap, like a printed
        book. It changes the manuscript and Source Notes editors only, not exports.
      </p>

      <ChoiceGroup
        label='Editor surface'
        value={editorSurface}
        onChange={setEditorSurface}
        choices={[
          {value: 'paper', label: 'Paper'},
          {value: 'mist', label: 'Mist'},
          {value: 'contrast', label: 'Contrast'}
        ]}
      />

      <ChoiceGroup
        label='Typewriter scrolling'
        value={editorTypewriter}
        onChange={setEditorTypewriter}
        choices={[
          {value: 'off', label: 'Off'},
          {value: 'on', label: 'On'}
        ]}
      />
      <p className={styles.helper}>
        Keeps the line you are typing a third of the way down the manuscript editor. Clicking
        or scrolling to read never moves the page; the next key you type brings the line back.
      </p>

      <ChoiceGroup
        label='Focus mode when the Workspace opens'
        value={focusModeStart}
        onChange={setFocusModeStart}
        choices={[
          {value: 'off', label: 'Off'},
          {value: 'on', label: 'On'}
        ]}
      />
      <p className={styles.helper}>
        Focus mode hides everything but the scene and a word count. Turn it on or off with
        the Focus mode button under the editor, the command palette, or Cmd/Ctrl+Shift+F;
        Escape leaves it.
      </p>

      <ChoiceGroup
        label='Source Notes open in'
        value={sourceNoteView}
        onChange={setSourceNoteView}
        choices={[
          {value: 'visual', label: 'Visual editor'},
          {value: 'markdown', label: 'Markdown source'}
        ]}
      />
    </div>
  );
};
