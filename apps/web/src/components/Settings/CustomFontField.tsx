import React, {useEffect, useState} from 'react';
import styles from '../../assets/components/EditorAppearanceControl.module.css';
import {
  CUSTOM_FONT_MAX_CHARS,
  cleanCustomFontName,
  customFontFamily,
  isFontInstalled
} from '../../services/editor/editorAppearance';

const PREVIEW_TEXT = 'The lantern swung once, and the harbor went dark.';

/**
 * The Custom text style: a font-family name the computer already has. The
 * name is saved as typed (cleaned); the preview line and a note say whether
 * the font was found, and a missing font falls back to the Serif stack.
 */
export const CustomFontField: React.FC<{value: string; onChange: (name: string) => void}> = ({
  value,
  onChange
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const name = cleanCustomFontName(draft);
  const installed = name ? isFontInstalled(name) : null;

  return (
    <div className={styles.customFont}>
      <label className={styles.label} htmlFor='editor-custom-font'>
        Font name
      </label>
      <input
        id='editor-custom-font'
        type='text'
        value={draft}
        maxLength={CUSTOM_FONT_MAX_CHARS}
        placeholder='For example, Baskerville'
        spellCheck={false}
        autoComplete='off'
        aria-describedby='editor-custom-font-status'
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(event.target.value);
        }}
      />
      <p
        className={styles.preview}
        style={{fontFamily: customFontFamily(name)}}
        data-testid='custom-font-preview'
      >
        {PREVIEW_TEXT}
      </p>
      <p id='editor-custom-font-status' className={styles.helper} aria-live='polite'>
        {!name
          ? 'Type the name of a font installed on this computer. Until then the editor uses Serif.'
          : installed === false
            ? `“${name}” was not found on this computer, so the editor uses Serif.`
            : 'The editor uses this font. If a computer does not have it, Serif is used instead.'}
      </p>
    </div>
  );
};
