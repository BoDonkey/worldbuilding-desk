export interface StateMutationTextAnchor {
  before: string;
  after: string;
}

export interface EditorTextSpan {
  textStart: number;
  textEnd: number;
  editorStart: number;
}

export interface EditorTextSnapshot {
  text: string;
  spans: EditorTextSpan[];
}

export type StateMutationAnchorResolution =
  | {status: 'exact' | 'moved'; position: number; textOffset: number}
  | {status: 'unresolved'};

const CONTEXT_LENGTH = 48;

export function editorPositionToTextOffset(
  snapshot: EditorTextSnapshot,
  position: number
): number {
  if (snapshot.spans.length === 0) return 0;
  for (const span of snapshot.spans) {
    const spanLength = span.textEnd - span.textStart;
    if (position >= span.editorStart && position <= span.editorStart + spanLength) {
      return span.textStart + Math.max(0, Math.min(spanLength, position - span.editorStart));
    }
  }
  const prior = snapshot.spans
    .filter((span) => span.editorStart <= position)
    .at(-1);
  return prior?.textEnd ?? 0;
}

export function textOffsetToEditorPosition(
  snapshot: EditorTextSnapshot,
  offset: number
): number | null {
  for (const span of snapshot.spans) {
    if (offset >= span.textStart && offset <= span.textEnd) {
      return span.editorStart + (offset - span.textStart);
    }
  }
  return snapshot.spans.at(-1)?.editorStart ?? null;
}

export function captureStateMutationAnchor(
  snapshot: EditorTextSnapshot,
  position: number
): StateMutationTextAnchor {
  const offset = editorPositionToTextOffset(snapshot, position);
  return {
    before: snapshot.text.slice(Math.max(0, offset - CONTEXT_LENGTH), offset),
    after: snapshot.text.slice(offset, offset + CONTEXT_LENGTH)
  };
}

export function normalizeStateMutationPosition(
  snapshot: EditorTextSnapshot,
  position: number
): number {
  const textOffset = editorPositionToTextOffset(snapshot, position);
  return textOffsetToEditorPosition(snapshot, textOffset) ?? position;
}

function candidateOffsets(text: string, anchor: StateMutationTextAnchor): number[] {
  const candidates: number[] = [];
  if (anchor.before && anchor.after) {
    const joined = `${anchor.before}${anchor.after}`;
    let start = text.indexOf(joined);
    while (start >= 0) {
      candidates.push(start + anchor.before.length);
      start = text.indexOf(joined, start + 1);
    }
    if (candidates.length > 0) return candidates;
  }
  const context = anchor.before || anchor.after;
  if (!context) return [];
  let start = text.indexOf(context);
  while (start >= 0) {
    candidates.push(start + (anchor.before ? anchor.before.length : 0));
    start = text.indexOf(context, start + 1);
  }
  return candidates;
}

export function resolveStateMutationAnchor(params: {
  snapshot: EditorTextSnapshot;
  anchor: StateMutationTextAnchor;
  originalPosition: number;
}): StateMutationAnchorResolution {
  const candidates = candidateOffsets(params.snapshot.text, params.anchor);
  if (candidates.length !== 1) return {status: 'unresolved'};
  const position = textOffsetToEditorPosition(params.snapshot, candidates[0]);
  if (position === null) return {status: 'unresolved'};
  return {
    status: position === params.originalPosition ? 'exact' : 'moved',
    position,
    textOffset: candidates[0]
  };
}

export function textSnapshotFromPlainText(text: string): EditorTextSnapshot {
  return {
    text,
    spans: text ? [{textStart: 0, textEnd: text.length, editorStart: 0}] : []
  };
}
