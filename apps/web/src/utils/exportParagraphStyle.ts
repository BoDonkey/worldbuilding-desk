import {readPreference, writePreference} from './browserPreferences';

/**
 * How EPUB and DOCX exports lay out paragraphs (slice 4.98). Indented is book
 * style: a first-line indent, no gap, and no indent on the first paragraph
 * after a heading or scene break. Spaced is a gap between paragraphs with no
 * indent. Separate from the editor's paragraph setting, which only changes how
 * the editor looks on this device. Markdown export ignores it.
 */
export const EXPORT_PARAGRAPH_STYLES = ['indented', 'spaced'] as const;
export type ExportParagraphStyle = (typeof EXPORT_PARAGRAPH_STYLES)[number];
export const DEFAULT_EXPORT_PARAGRAPH_STYLE: ExportParagraphStyle = 'indented';

/** Per project: `exportParagraphStyle:<projectId>` (removed with the project). */
export const EXPORT_PARAGRAPH_STYLE_KEY_PREFIX = 'exportParagraphStyle';

const isExportParagraphStyle = (value: string | null): value is ExportParagraphStyle =>
  (EXPORT_PARAGRAPH_STYLES as readonly string[]).includes(value ?? '');

export function readExportParagraphStyle(projectId: string | null | undefined): ExportParagraphStyle {
  if (!projectId) return DEFAULT_EXPORT_PARAGRAPH_STYLE;
  const stored = readPreference(`${EXPORT_PARAGRAPH_STYLE_KEY_PREFIX}:${projectId}`);
  return isExportParagraphStyle(stored) ? stored : DEFAULT_EXPORT_PARAGRAPH_STYLE;
}

export function writeExportParagraphStyle(projectId: string, style: ExportParagraphStyle): void {
  writePreference(`${EXPORT_PARAGRAPH_STYLE_KEY_PREFIX}:${projectId}`, style);
}
