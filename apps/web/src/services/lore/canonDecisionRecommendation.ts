import type {CanonDecisionCluster, CanonDecisionResolution} from '../../entityTypes';

/**
 * The subset of `CanonDecisionResolution` that maps to a one-click action
 * button in the Canon Decisions route. `merge` is excluded: no button
 * performs a merge today, so the rubber-duck is never asked to suggest one.
 */
export type CanonDecisionRecommendedAction = Exclude<CanonDecisionResolution, 'merge'>;

const VALID_TOKENS: ReadonlySet<string> = new Set<CanonDecisionRecommendedAction>([
  'alias',
  'accept_new',
  'accept_update',
  'keep_separate',
  'reject',
  'defer'
]);

const ACTIONS_BY_KIND: Record<CanonDecisionCluster['kind'], ReadonlySet<CanonDecisionRecommendedAction>> = {
  entity_identity: new Set(['alias', 'accept_new', 'keep_separate', 'reject', 'defer']),
  fact_conflict: new Set(['accept_update', 'keep_separate', 'reject', 'defer'])
};

const RECOMMENDED_STEP_HEADING = /(?:^|\n)\s*(?:\d+\.\s*)?Recommended Next Step\s*:?\s*\n?/i;
const SUGGESTED_ACTION_LINE = /\n?\s*Suggested Action:\s*(\S+)\s*$/i;

export interface ParsedCanonDecisionRecommendation {
  action: CanonDecisionRecommendedAction;
  rationale: string;
}

/**
 * Deterministically reads the rubber-duck's trailing `Suggested Action:` tag
 * and the rationale above it. This never pattern-matches free prose for an
 * action — only that explicit, position-anchored tag is trusted, and only
 * when it names a token that is both a known action and valid for this
 * cluster's kind (e.g. `alias` is rejected for a `fact_conflict` cluster).
 * Everything else about the response — the sections above it — is display
 * only; the author's click on a real action button is what actually decides
 * canon, exactly as with any other prefilled proposal.
 */
export function parseCanonDecisionRecommendation(
  content: string,
  clusterKind: CanonDecisionCluster['kind']
): ParsedCanonDecisionRecommendation | null {
  const actionMatch = content.match(SUGGESTED_ACTION_LINE);
  if (!actionMatch || actionMatch.index === undefined) return null;

  const token = actionMatch[1].toLowerCase();
  if (token === 'none' || !VALID_TOKENS.has(token)) return null;
  const action = token as CanonDecisionRecommendedAction;
  if (!ACTIONS_BY_KIND[clusterKind]?.has(action)) return null;

  const withoutTag = content.slice(0, actionMatch.index).trimEnd();
  const headingMatch = withoutTag.match(RECOMMENDED_STEP_HEADING);
  const rationale = (
    headingMatch && headingMatch.index !== undefined
      ? withoutTag.slice(headingMatch.index + headingMatch[0].length)
      : withoutTag
  ).trim();
  if (!rationale) return null;

  return {action, rationale};
}

export const CANON_DECISION_ACTION_LABELS: Record<CanonDecisionRecommendedAction, string> = {
  alias: 'Alias to existing',
  accept_new: 'Accept new',
  accept_update: 'Supersede',
  keep_separate: 'Keep separate',
  reject: 'Reject',
  defer: 'Defer'
};
