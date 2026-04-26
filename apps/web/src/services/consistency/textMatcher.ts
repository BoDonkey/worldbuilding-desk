export interface TextMatchPattern {
  id: string;
  surface: string;
  kind: 'known' | 'review';
  metadata?: Record<string, unknown>;
}

export interface TextMatch {
  pattern: TextMatchPattern;
  surface: string;
  normalized: string;
  from: number;
  to: number;
  reason: 'exact' | 'possessive';
}

export const normalizeCanonText = (value: string): string =>
  value
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .replace(/['’]s\b/gi, '')
    .replace(/s['’]\b/gi, 's')
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const isPossessiveFormOf = (value: string, canonSurface: string): boolean =>
  normalizeCanonText(value) === normalizeCanonText(canonSurface) &&
  /(?:['’]s|s['’])$/i.test(value.trim());

export const isInProgressCanonPrefix = (
  value: string,
  canonSurfaces: string[]
): boolean => {
  const normalized = normalizeCanonText(value);
  if (normalized.length < 6) {
    return false;
  }

  return canonSurfaces.some((canonSurface) => {
    const canon = normalizeCanonText(canonSurface);
    if (canon === normalized || !canon.startsWith(normalized)) {
      return false;
    }

    return canon[normalized.length] !== ' ';
  });
};

export const findTextMatches = (
  text: string,
  patterns: TextMatchPattern[]
): TextMatch[] => {
  const normalizedPatterns = patterns
    .map((pattern, order) => ({
      ...pattern,
      order,
      normalized: normalizeCanonText(pattern.surface)
    }))
    .filter((pattern) => pattern.normalized.length > 0)
    .sort((a, b) => b.normalized.length - a.normalized.length || a.order - b.order);
  const matches: TextMatch[] = [];
  const occupiedRanges: Array<{from: number; to: number}> = [];

  normalizedPatterns.forEach((pattern) => {
    const matcher = new RegExp(
      `(^|[^\\p{L}\\p{N}_])(${escapeRegex(pattern.normalized)})(['’]s|s['’])?(?=$|[^\\p{L}\\p{N}_])`,
      'giu'
    );
    let match: RegExpExecArray | null = null;
    while ((match = matcher.exec(text))) {
      const prefix = match[1] ?? '';
      const matchedSurface = match[2] ?? '';
      const possessiveSuffix = match[3] ?? '';
      const from = match.index + prefix.length;
      const to = from + matchedSurface.length + possessiveSuffix.length;
      const overlapsExisting = occupiedRanges.some(
        (range) => from < range.to && to > range.from
      );
      if (overlapsExisting) {
        continue;
      }

      occupiedRanges.push({from, to});
      matches.push({
        pattern,
        surface: text.slice(from, to),
        normalized: pattern.normalized,
        from,
        to,
        reason: possessiveSuffix ? 'possessive' : 'exact'
      });
    }
  });

  return matches.sort((a, b) => a.from - b.from || b.to - a.to);
};
