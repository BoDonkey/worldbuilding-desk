import React, { createContext, useContext, useEffect, useState } from 'react';

import {
  APPEARANCE_DEFAULTS,
  APPEARANCE_KEYS,
  EDITOR_FONTS,
  EDITOR_LINE_HEIGHTS,
  EDITOR_PARAGRAPH_STYLES,
  EDITOR_SURFACES,
  EDITOR_WIDTHS,
  cleanCustomFontName,
  customFontFamily,
  readChoice,
  readCustomFontName,
  type EditorFont,
  type EditorLineHeight,
  type EditorParagraphStyle,
  type EditorSurface,
  type EditorWidth
} from '../services/editor/editorAppearance';

type FontSize = 'small' | 'medium' | 'large';
/** Which view Source Notes open in: the visual editor or their stored text. */
export type SourceNoteView = 'visual' | 'markdown';

interface AccessibilityContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  editorFont: EditorFont;
  setEditorFont: (font: EditorFont) => void;
  editorWidth: EditorWidth;
  setEditorWidth: (width: EditorWidth) => void;
  editorSurface: EditorSurface;
  setEditorSurface: (surface: EditorSurface) => void;
  editorLineHeight: EditorLineHeight;
  setEditorLineHeight: (lineHeight: EditorLineHeight) => void;
  editorParagraphStyle: EditorParagraphStyle;
  setEditorParagraphStyle: (style: EditorParagraphStyle) => void;
  /** The font name for Custom, cleaned; empty until the author types one. */
  editorCustomFont: string;
  setEditorCustomFont: (name: string) => void;
  sourceNoteView: SourceNoteView;
  setSourceNoteView: (view: SourceNoteView) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    const stored = localStorage.getItem('fontSize');
    if (stored === 'small' || stored === 'medium' || stored === 'large') return stored;
    return 'medium';
  });
  const [editorFont, setEditorFont] = useState<EditorFont>(() =>
    readChoice(APPEARANCE_KEYS.editorFont, EDITOR_FONTS, APPEARANCE_DEFAULTS.editorFont));
  const [editorCustomFont, setEditorCustomFontState] = useState(readCustomFontName);
  const setEditorCustomFont = (name: string) => setEditorCustomFontState(cleanCustomFontName(name));
  const [editorWidth, setEditorWidth] = useState<EditorWidth>(() =>
    readChoice(APPEARANCE_KEYS.editorWidth, EDITOR_WIDTHS, APPEARANCE_DEFAULTS.editorWidth));
  const [editorSurface, setEditorSurface] = useState<EditorSurface>(() =>
    readChoice(APPEARANCE_KEYS.editorSurface, EDITOR_SURFACES, APPEARANCE_DEFAULTS.editorSurface));
  const [editorLineHeight, setEditorLineHeight] = useState<EditorLineHeight>(() =>
    readChoice(APPEARANCE_KEYS.editorLineHeight, EDITOR_LINE_HEIGHTS, APPEARANCE_DEFAULTS.editorLineHeight));
  const [editorParagraphStyle, setEditorParagraphStyle] = useState<EditorParagraphStyle>(() =>
    readChoice(APPEARANCE_KEYS.editorParagraphStyle, EDITOR_PARAGRAPH_STYLES, APPEARANCE_DEFAULTS.editorParagraphStyle));
  const [sourceNoteView, setSourceNoteView] = useState<SourceNoteView>(() =>
    localStorage.getItem('sourceNoteView') === 'markdown' ? 'markdown' : 'visual'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
    localStorage.setItem('fontSize', fontSize);
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.setAttribute('data-editor-font', editorFont);
    localStorage.setItem('editorFont', editorFont);
  }, [editorFont]);

  useEffect(() => {
    document.documentElement.setAttribute('data-editor-width', editorWidth);
    localStorage.setItem('editorWidth', editorWidth);
  }, [editorWidth]);

  useEffect(() => {
    document.documentElement.setAttribute('data-editor-surface', editorSurface);
    localStorage.setItem('editorSurface', editorSurface);
  }, [editorSurface]);

  useEffect(() => {
    document.documentElement.setAttribute('data-editor-line-height', editorLineHeight);
    localStorage.setItem('editorLineHeight', editorLineHeight);
  }, [editorLineHeight]);

  useEffect(() => {
    document.documentElement.setAttribute('data-editor-paragraph', editorParagraphStyle);
    localStorage.setItem(APPEARANCE_KEYS.editorParagraphStyle, editorParagraphStyle);
  }, [editorParagraphStyle]);

  useEffect(() => {
    // Read by `:root[data-editor-font="custom"]`; the fallback stack follows the name.
    document.documentElement.style.setProperty('--editor-custom-font-family', customFontFamily(editorCustomFont));
    localStorage.setItem(APPEARANCE_KEYS.editorCustomFont, editorCustomFont);
  }, [editorCustomFont]);

  useEffect(() => {
    localStorage.setItem('sourceNoteView', sourceNoteView);
  }, [sourceNoteView]);

  return (
    <AccessibilityContext.Provider
      value={{
        fontSize,
        setFontSize,
        editorFont,
        setEditorFont,
        editorWidth,
        setEditorWidth,
        editorSurface,
        setEditorSurface,
        editorLineHeight,
        setEditorLineHeight,
        editorParagraphStyle,
        setEditorParagraphStyle,
        editorCustomFont,
        setEditorCustomFont,
        sourceNoteView,
        setSourceNoteView
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return context;
};
