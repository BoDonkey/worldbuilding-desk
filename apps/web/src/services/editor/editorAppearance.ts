/*
 * Editor appearance settings (Settings → Editor Appearance). Each one is saved
 * per device in localStorage and shown as a `data-*` attribute on the root,
 * which sets a CSS variable in `styles/theme.css`. Reading is here so the
 * defaults and the handling of unknown stored values are tested in one place.
 */

export const EDITOR_FONTS = ['serif', 'book', 'sans', 'mono', 'dyslexic', 'custom'] as const;
export type EditorFont = (typeof EDITOR_FONTS)[number];

export const EDITOR_WIDTHS = ['narrow', 'focused', 'wide'] as const;
export type EditorWidth = (typeof EDITOR_WIDTHS)[number];

export const EDITOR_SURFACES = ['paper', 'mist', 'contrast'] as const;
export type EditorSurface = (typeof EDITOR_SURFACES)[number];

export const EDITOR_LINE_HEIGHTS = ['compact', 'comfortable', 'airy'] as const;
export type EditorLineHeight = (typeof EDITOR_LINE_HEIGHTS)[number];

/** Spaced: a gap between paragraphs. Indented: first-line indents, no gap (4.90). */
export const EDITOR_PARAGRAPH_STYLES = ['spaced', 'indented'] as const;
export type EditorParagraphStyle = (typeof EDITOR_PARAGRAPH_STYLES)[number];

/** Whether the Workspace opens in focus mode (4.91). */
export const FOCUS_MODE_STARTS = ['off', 'on'] as const;
export type FocusModeStart = (typeof FOCUS_MODE_STARTS)[number];

/** Typewriter scrolling in the manuscript editor (4.92). */
export const TYPEWRITER_MODES = ['off', 'on'] as const;
export type TypewriterMode = (typeof TYPEWRITER_MODES)[number];

/** localStorage keys. The older ones predate this module and keep their names. */
export const APPEARANCE_KEYS = {
  editorFont: 'editorFont',
  editorCustomFont: 'editorCustomFont',
  editorWidth: 'editorWidth',
  editorSurface: 'editorSurface',
  editorLineHeight: 'editorLineHeight',
  editorParagraphStyle: 'editorParagraphStyle',
  focusModeStart: 'focusModeStart',
  editorTypewriter: 'editorTypewriter'
} as const;

export const APPEARANCE_DEFAULTS = {
  editorFont: 'serif' as EditorFont,
  editorWidth: 'focused' as EditorWidth,
  editorSurface: 'paper' as EditorSurface,
  editorLineHeight: 'comfortable' as EditorLineHeight,
  editorParagraphStyle: 'spaced' as EditorParagraphStyle,
  focusModeStart: 'off' as FocusModeStart,
  editorTypewriter: 'off' as TypewriterMode
};

/** The Custom font falls back to this stack when the named font is not installed. */
export const CUSTOM_FONT_FALLBACK = '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif';
export const CUSTOM_FONT_MAX_CHARS = 80;

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** A stored value if it is one of `options`, otherwise `fallback`. */
export function readChoice<T extends string>(key: string, options: readonly T[], fallback: T): T {
  const stored = readStored(key);
  return stored !== null && (options as readonly string[]).includes(stored) ? (stored as T) : fallback;
}

/**
 * A font-family name as typed, made safe to put inside a quoted CSS string:
 * quotes, backslashes, and characters that could end the declaration are
 * removed, spaces are collapsed, and the length is capped.
 */
export function cleanCustomFontName(value: string): string {
  return value
    .replace(/["'\\;{}<>()\n\r\t]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CUSTOM_FONT_MAX_CHARS)
    .trim();
}

export function readCustomFontName(): string {
  return cleanCustomFontName(readStored(APPEARANCE_KEYS.editorCustomFont) ?? '');
}

/** The `--editor-font-family` value for Custom: the named font, then the fallback stack. */
export function customFontFamily(name: string): string {
  const clean = cleanCustomFontName(name);
  return clean ? `"${clean}", ${CUSTOM_FONT_FALLBACK}` : CUSTOM_FONT_FALLBACK;
}

/**
 * Whether `name` is installed, by measuring text against two generic fonts:
 * a missing font renders as the generic one, so both widths match. Returns
 * null when measuring is not possible (no canvas), so the caller says nothing.
 */
export function isFontInstalled(name: string, doc: Document = document): boolean | null {
  const clean = cleanCustomFontName(name);
  if (!clean) return null;
  const context = doc.createElement('canvas').getContext?.('2d');
  if (!context) return null;
  const sample = 'The quick brown fox jumps over the lazy dog 0123456789';
  return ['monospace', 'serif'].some((generic) => {
    context.font = `72px ${generic}`;
    const base = context.measureText(sample).width;
    context.font = `72px "${clean}", ${generic}`;
    return context.measureText(sample).width !== base;
  });
}
