export type ProgressionContinuityVerdict = 'finding' | 'not_a_finding';

export interface ParsedProgressionContinuityVerdict {
  verdict: ProgressionContinuityVerdict;
  rationale: string;
}

const VERDICT_LINE = /\n?\s*Verdict:\s*(\S+)\s*$/i;

/**
 * Deterministically reads the consultation's trailing, position-anchored
 * `Verdict:` tag and the rationale above it. Free prose is never
 * pattern-matched for a verdict — only this explicit tag is trusted, and
 * only when it names one of the two allowed tokens.
 */
export function parseProgressionContinuityVerdict(
  content: string
): ParsedProgressionContinuityVerdict | null {
  const match = content.match(VERDICT_LINE);
  if (!match || match.index === undefined) return null;

  const token = match[1].toLowerCase();
  if (token !== 'finding' && token !== 'not_a_finding') return null;

  const rationale = content.slice(0, match.index).trim();
  if (!rationale) return null;

  return {verdict: token, rationale};
}
