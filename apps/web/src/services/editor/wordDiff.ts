/**
 * Word-level diff for comparing a scene snapshot with the scene now (slice
 * 4.95). Myers' O(ND) algorithm over word tokens, after trimming the common
 * start and end. Paragraph breaks are tokens too ('\n'), so a moved break
 * shows. Past `maxEdits` differences the texts are treated as wholly
 * replaced rather than spending memory on a word-by-word answer.
 */

export type WordDiffKind = 'same' | 'added' | 'removed';

export interface WordDiffOp {
  kind: WordDiffKind;
  token: string;
}

export const PARAGRAPH_BREAK_TOKEN = '\n';

/** Plain text (paragraphs separated by newlines) as word and paragraph-break tokens. */
export function tokenizeWords(text: string): string[] {
  return text
    .replace(/\n+/g, ` ${PARAGRAPH_BREAK_TOKEN} `)
    .split(/[ \t\u00a0]+/)
    .filter(Boolean);
}

const DEFAULT_MAX_EDITS = 4000;

/** The ops that turn `before` into `after`, in order. */
export function diffWords(before: string[], after: string[], maxEdits = DEFAULT_MAX_EDITS): WordDiffOp[] {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
  let endBefore = before.length;
  let endAfter = after.length;
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
    endBefore -= 1;
    endAfter -= 1;
  }
  const same = (tokens: string[]): WordDiffOp[] => tokens.map((token) => ({kind: 'same', token}));
  const a = before.slice(start, endBefore);
  const b = after.slice(start, endAfter);
  const middle = myers(a, b, maxEdits) ?? [
    ...a.map((token): WordDiffOp => ({kind: 'removed', token})),
    ...b.map((token): WordDiffOp => ({kind: 'added', token}))
  ];
  return [...same(before.slice(0, start)), ...middle, ...same(before.slice(endBefore))];
}

function myers(a: string[], b: string[], maxEdits: number): WordDiffOp[] | null {
  const n = a.length;
  const m = b.length;
  if (n === 0) return b.map((token) => ({kind: 'added', token}));
  if (m === 0) return a.map((token) => ({kind: 'removed', token}));
  const limit = Math.min(n + m, maxEdits);
  const offset = limit + 1;
  const v = new Int32Array(2 * limit + 3);
  // trace[d] holds the furthest x on each diagonal k in [-d, d] before step d, at index k + d.
  const trace: Int32Array[] = [];
  for (let d = 0; d <= limit; d += 1) {
    trace.push(v.slice(offset - d, offset + d + 1));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])
        ? v[offset + k + 1]
        : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return backtrack(a, b, trace);
    }
  }
  return null;
}

function backtrack(a: string[], b: string[], trace: Int32Array[]): WordDiffOp[] {
  const ops: WordDiffOp[] = [];
  let x = a.length;
  let y = b.length;
  for (let d = trace.length - 1; d >= 0; d -= 1) {
    if (d === 0) {
      while (x > 0 && y > 0) {
        ops.push({kind: 'same', token: a[x - 1]});
        x -= 1;
        y -= 1;
      }
      break;
    }
    const previous = trace[d];
    const at = (k: number) => previous[k + d];
    const k = x - y;
    const previousK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
    const previousX = at(previousK);
    const previousY = previousX - previousK;
    while (x > previousX && y > previousY) {
      ops.push({kind: 'same', token: a[x - 1]});
      x -= 1;
      y -= 1;
    }
    if (x === previousX) ops.push({kind: 'added', token: b[y - 1]});
    else ops.push({kind: 'removed', token: a[x - 1]});
    x = previousX;
    y = previousY;
  }
  return ops.reverse();
}

/** Words added and removed, not counting paragraph breaks. */
export function countWordChanges(ops: readonly WordDiffOp[]): {added: number; removed: number} {
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.token === PARAGRAPH_BREAK_TOKEN) continue;
    if (op.kind === 'added') added += 1;
    if (op.kind === 'removed') removed += 1;
  }
  return {added, removed};
}
