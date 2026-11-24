/*
 * Typewriter scrolling (slice 4.92): keep the line being typed at a fixed
 * height in the editor's scroll area by scrolling the area, not the caret.
 */

/** Where the caret line should sit, as a share of the scroll area's height. */
export const TYPEWRITER_LINE_RATIO = 1 / 3;
/** Smaller moves than this are ignored, so scrolling does not jitter. */
export const TYPEWRITER_TOLERANCE_PX = 4;
/** Only edits and caret moves this soon after a key press count as typing. */
export const TYPEWRITER_KEY_WINDOW_MS = 500;

export interface TypewriterScrollInput {
  /** Top of the caret line, in viewport coordinates. */
  caretTop: number;
  /** Top of the scroll area, in viewport coordinates. */
  viewTop: number;
  /** Visible height of the scroll area. */
  viewHeight: number;
  scrollTop: number;
  /** scrollHeight − clientHeight. */
  maxScrollTop: number;
  ratio?: number;
  tolerance?: number;
}

/**
 * The scrollTop that puts the caret line at `ratio` of the way down the
 * scroll area, or null when it is already there (within `tolerance`) or the
 * area cannot scroll any further toward it.
 */
export function typewriterScrollTarget({
  caretTop,
  viewTop,
  viewHeight,
  scrollTop,
  maxScrollTop,
  ratio = TYPEWRITER_LINE_RATIO,
  tolerance = TYPEWRITER_TOLERANCE_PX
}: TypewriterScrollInput): number | null {
  if (!(viewHeight > 0)) return null;
  const delta = caretTop - (viewTop + viewHeight * ratio);
  if (Math.abs(delta) <= tolerance) return null;
  const next = Math.round(Math.min(Math.max(scrollTop + delta, 0), Math.max(maxScrollTop, 0)));
  return Math.abs(next - scrollTop) < 1 ? null : next;
}

/**
 * Whether an editor change should scroll: it changed the text or moved the
 * caret, the editor has focus, and the last input was a key press made just
 * before it (not a click, a drag, or the author scrolling to read).
 */
export function isTypingChange(params: {
  changed: boolean;
  hasFocus: boolean;
  lastKeyAt: number;
  lastPointerAt: number;
  now: number;
  windowMs?: number;
}): boolean {
  const {changed, hasFocus, lastKeyAt, lastPointerAt, now, windowMs = TYPEWRITER_KEY_WINDOW_MS} = params;
  return changed && hasFocus && lastKeyAt > lastPointerAt && now - lastKeyAt <= windowMs;
}
