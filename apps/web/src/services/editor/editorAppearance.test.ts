// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  APPEARANCE_DEFAULTS,
  APPEARANCE_KEYS,
  CUSTOM_FONT_FALLBACK,
  CUSTOM_FONT_MAX_CHARS,
  EDITOR_FONTS,
  EDITOR_PARAGRAPH_STYLES,
  EDITOR_WIDTHS,
  cleanCustomFontName,
  customFontFamily,
  isFontInstalled,
  readChoice,
  readCustomFontName
} from './editorAppearance';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('readChoice', () => {
  it('uses the default when nothing is stored', () => {
    expect(readChoice(APPEARANCE_KEYS.editorWidth, EDITOR_WIDTHS, APPEARANCE_DEFAULTS.editorWidth)).toBe('focused');
    expect(
      readChoice(APPEARANCE_KEYS.editorParagraphStyle, EDITOR_PARAGRAPH_STYLES, APPEARANCE_DEFAULTS.editorParagraphStyle)
    ).toBe('spaced');
    expect(readChoice(APPEARANCE_KEYS.editorFont, EDITOR_FONTS, APPEARANCE_DEFAULTS.editorFont)).toBe('serif');
  });

  it('keeps a stored value it knows, including the new ones', () => {
    localStorage.setItem(APPEARANCE_KEYS.editorWidth, 'narrow');
    localStorage.setItem(APPEARANCE_KEYS.editorFont, 'custom');
    localStorage.setItem(APPEARANCE_KEYS.editorParagraphStyle, 'indented');
    expect(readChoice(APPEARANCE_KEYS.editorWidth, EDITOR_WIDTHS, 'focused')).toBe('narrow');
    expect(readChoice(APPEARANCE_KEYS.editorFont, EDITOR_FONTS, 'serif')).toBe('custom');
    expect(readChoice(APPEARANCE_KEYS.editorParagraphStyle, EDITOR_PARAGRAPH_STYLES, 'spaced')).toBe('indented');
  });

  it('falls back on an unknown or differently cased stored value', () => {
    localStorage.setItem(APPEARANCE_KEYS.editorWidth, 'huge');
    localStorage.setItem(APPEARANCE_KEYS.editorFont, 'Serif');
    expect(readChoice(APPEARANCE_KEYS.editorWidth, EDITOR_WIDTHS, 'focused')).toBe('focused');
    expect(readChoice(APPEARANCE_KEYS.editorFont, EDITOR_FONTS, 'serif')).toBe('serif');
  });

  it('falls back when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readChoice(APPEARANCE_KEYS.editorWidth, EDITOR_WIDTHS, 'focused')).toBe('focused');
    expect(readCustomFontName()).toBe('');
  });
});

describe('custom font name', () => {
  it('removes characters that could end the CSS value and collapses spaces', () => {
    expect(cleanCustomFontName('  Libre   Baskerville ')).toBe('Libre Baskerville');
    expect(cleanCustomFontName('Evil"; } body { color: red')).toBe('Evil body color: red');
    expect(cleanCustomFontName("O'Brien\\Sans")).toBe('OBrienSans');
  });

  it('caps the length', () => {
    expect(cleanCustomFontName('x'.repeat(200))).toHaveLength(CUSTOM_FONT_MAX_CHARS);
  });

  it('reads the stored name cleaned', () => {
    localStorage.setItem(APPEARANCE_KEYS.editorCustomFont, ' "Garamond" ');
    expect(readCustomFontName()).toBe('Garamond');
  });

  it('puts the name before the Serif fallback, or uses the fallback alone', () => {
    expect(customFontFamily('Garamond')).toBe(`"Garamond", ${CUSTOM_FONT_FALLBACK}`);
    expect(customFontFamily('  ')).toBe(CUSTOM_FONT_FALLBACK);
  });
});

describe('isFontInstalled', () => {
  function fakeDocument(widthFor: (font: string) => number) {
    const context = {font: '', measureText: () => ({width: widthFor(context.font)})};
    return {createElement: () => ({getContext: () => context})} as unknown as Document;
  }

  it('is true when the named font changes the measured width', () => {
    const doc = fakeDocument((font) => (font.includes('"Garamond"') ? 500 : 400));
    expect(isFontInstalled('Garamond', doc)).toBe(true);
  });

  it('is false when every width matches the generic font', () => {
    expect(isFontInstalled('Nope Sans', fakeDocument(() => 400))).toBe(false);
  });

  it('is null for an empty name or when there is no canvas', () => {
    expect(isFontInstalled('', fakeDocument(() => 400))).toBeNull();
    const noCanvas = {createElement: () => ({getContext: () => null})} as unknown as Document;
    expect(isFontInstalled('Garamond', noCanvas)).toBeNull();
  });
});
