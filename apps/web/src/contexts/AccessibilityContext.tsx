import React, { createContext, useContext, useEffect, useState } from 'react';

type FontSize = 'small' | 'medium' | 'large';
type EditorFont = 'serif' | 'sans';
type EditorWidth = 'focused' | 'wide';
type EditorSurface = 'paper' | 'mist' | 'contrast';

interface AccessibilityContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  editorFont: EditorFont;
  setEditorFont: (font: EditorFont) => void;
  editorWidth: EditorWidth;
  setEditorWidth: (width: EditorWidth) => void;
  editorSurface: EditorSurface;
  setEditorSurface: (surface: EditorSurface) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    const stored = localStorage.getItem('fontSize');
    if (stored === 'small' || stored === 'medium' || stored === 'large') return stored;
    return 'medium';
  });
  const [editorFont, setEditorFont] = useState<EditorFont>(() => {
    const stored = localStorage.getItem('editorFont');
    if (stored === 'serif' || stored === 'sans') return stored;
    return 'serif';
  });
  const [editorWidth, setEditorWidth] = useState<EditorWidth>(() => {
    const stored = localStorage.getItem('editorWidth');
    if (stored === 'focused' || stored === 'wide') return stored;
    return 'focused';
  });
  const [editorSurface, setEditorSurface] = useState<EditorSurface>(() => {
    const stored = localStorage.getItem('editorSurface');
    if (stored === 'paper' || stored === 'mist' || stored === 'contrast') return stored;
    return 'paper';
  });

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
        setEditorSurface
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
