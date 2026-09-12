import type {CanonicalFact, WorldEntity} from '../../entityTypes';
import type {
  ContinuityCorpusCase,
  CorpusExpectedAbsence,
  CorpusExpectedFinding,
  CorpusExpectedResolution,
  CorpusIssueCode
} from '../../fixtures/continuityCorpus';
import {buildExtractedProposal, ConsistencyEngineService} from './ConsistencyEngineService';
import type {ConsistencyAlias} from './aliasStorage';
import {findCanonContradictions} from './contradictionReview';
import {buildKnownConsistencyEntities} from './reviewLinkOptions';
import type {GuardrailIssue, KnownEntityRef} from './types';

/**
 * Runs the real deterministic review path over a corpus case: the same
 * known-entity assembly the Workspace uses, `buildExtractedProposal` +
 * `validateProposal`, and `findCanonContradictions`. No model calls.
 */

export interface CorpusFinding {
  code: CorpusIssueCode;
  sceneId: string;
  surface: string;
  focusText: string;
  entityIds: string[];
  message: string;
}

export interface CorpusMention {
  sceneId: string;
  surface: string;
  entityId?: string;
}

export interface CorpusRun {
  findings: CorpusFinding[];
  mentions: CorpusMention[];
}

export interface CorpusEvaluation {
  caseId: string;
  matched: CorpusExpectedFinding[];
  missed: CorpusExpectedFinding[];
  absenceViolations: Array<{absence: CorpusExpectedAbsence; finding: CorpusFinding}>;
  healedKnownGaps: CorpusExpectedAbsence[];
  resolutionViolations: Array<{rule: CorpusExpectedResolution; mention: CorpusMention}>;
  conflictViolations: Array<{entityId: string; finding: CorpusFinding}>;
  /** Findings whose focus text or surface is not a verbatim substring of their scene (highlights would fail). */
  unanchoredFindings: CorpusFinding[];
  findings: CorpusFinding[];
}

const CHARACTER_CATEGORY_ID = 'corpus-characters';
const GENERAL_CATEGORY_ID = 'corpus-general';

export const normalizeCorpusSurface = (value: string): string =>
  value
    .toLowerCase()
    .replace(/^(a|an|the)\s+/, '')
    .replace(/['’]s$/, '')
    .replace(/[.,!?;:"“”]+$/g, '')
    .trim();

function toWorldEntities(corpusCase: ContinuityCorpusCase): WorldEntity[] {
  return corpusCase.entities.map((entity) => ({
    id: entity.id,
    projectId: 'corpus',
    categoryId: entity.kind === 'character' ? CHARACTER_CATEGORY_ID : GENERAL_CATEGORY_ID,
    name: entity.name,
    fields: {},
    links: [],
    createdAt: 1,
    updatedAt: 1
  }));
}

function toAliases(corpusCase: ContinuityCorpusCase): ConsistencyAlias[] {
  return corpusCase.entities.flatMap((entity) =>
    (entity.aliases ?? []).map((alias, index) => ({
      id: `${entity.id}-alias-${index}`,
      projectId: 'corpus',
      targetId: entity.id,
      targetType: 'entity' as const,
      entityId: entity.id,
      alias,
      createdAt: 1,
      updatedAt: 1
    }))
  );
}

function toCanonicalFacts(corpusCase: ContinuityCorpusCase): CanonicalFact[] {
  return (corpusCase.facts ?? []).map((fact, index) => ({
    id: `${corpusCase.id}-fact-${index}`,
    projectId: 'corpus',
    targetType: 'entity' as const,
    targetId: fact.targetId,
    targetName: corpusCase.entities.find((entity) => entity.id === fact.targetId)?.name,
    sourceLoreDocumentTitle: fact.sourceTitle,
    factType: fact.factType,
    value: fact.value,
    acceptedAt: 1,
    updatedAt: 1
  }));
}

export function buildCorpusKnownEntities(corpusCase: ContinuityCorpusCase): KnownEntityRef[] {
  return buildKnownConsistencyEntities({
    entities: toWorldEntities(corpusCase),
    aliases: toAliases(corpusCase),
    characterLoreEntityIdByCharacterId: new Map()
  });
}

const issueToFinding = (sceneId: string, issue: GuardrailIssue): CorpusFinding => ({
  code: issue.code as CorpusIssueCode,
  sceneId,
  surface: issue.surface ?? '',
  focusText: issue.focusText ?? '',
  entityIds: (issue.relatedEntities ?? []).map((entity) => entity.id),
  message: issue.message
});

export async function runContinuityCase(corpusCase: ContinuityCorpusCase): Promise<CorpusRun> {
  const knownEntities = buildCorpusKnownEntities(corpusCase);
  const engine = new ConsistencyEngineService();
  const findings: CorpusFinding[] = [];
  const mentions: CorpusMention[] = [];

  for (const scene of corpusCase.scenes) {
    const proposal = buildExtractedProposal(
      {projectId: 'corpus', text: scene.text, source: 'workspace-save', knownEntities},
      {id: `${corpusCase.id}-${scene.id}`, createdAt: 1}
    );
    proposal.entities.forEach((ref) => {
      mentions.push({sceneId: scene.id, surface: ref.surface, entityId: ref.entityId});
    });
    const validation = await engine.validateProposal(proposal);
    validation.issues.forEach((issue) => findings.push(issueToFinding(scene.id, issue)));
  }

  const contradictions = findCanonContradictions({
    documents: corpusCase.scenes.map((scene) => ({
      id: scene.id,
      projectId: 'corpus',
      title: scene.title,
      content: scene.text,
      createdAt: 1,
      updatedAt: 1
    })),
    entities: toWorldEntities(corpusCase),
    characters: [],
    canonicalFacts: toCanonicalFacts(corpusCase),
    knownEntities
  });
  contradictions.forEach((item) => findings.push(issueToFinding(item.sceneId, item.issue)));

  return {findings, mentions};
}

const findingMatches = (expected: CorpusExpectedFinding, finding: CorpusFinding): boolean => {
  if (finding.code !== expected.code || finding.sceneId !== expected.sceneId) return false;
  if (expected.entityId && !finding.entityIds.includes(expected.entityId)) return false;
  if (expected.surfaceIncludes) {
    const needle = expected.surfaceIncludes.toLowerCase();
    const haystack = `${finding.surface} ${finding.focusText} ${finding.message}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
};

const absenceViolated = (absence: CorpusExpectedAbsence, finding: CorpusFinding): boolean =>
  finding.sceneId === absence.sceneId &&
  (finding.code === 'UNKNOWN_ENTITY' || finding.code === 'AMBIGUOUS_REFERENCE') &&
  normalizeCorpusSurface(finding.surface) === normalizeCorpusSurface(absence.surface);

export function evaluateContinuityCase(corpusCase: ContinuityCorpusCase, run: CorpusRun): CorpusEvaluation {
  const matched: CorpusExpectedFinding[] = [];
  const missed: CorpusExpectedFinding[] = [];
  corpusCase.expected.forEach((expected) => {
    (run.findings.some((finding) => findingMatches(expected, finding)) ? matched : missed).push(expected);
  });

  const absenceViolations: CorpusEvaluation['absenceViolations'] = [];
  const healedKnownGaps: CorpusExpectedAbsence[] = [];
  corpusCase.expectedAbsent.forEach((absence) => {
    const violation = run.findings.find((finding) => absenceViolated(absence, finding));
    if (violation && !absence.knownGap) absenceViolations.push({absence, finding: violation});
    if (!violation && absence.knownGap) healedKnownGaps.push(absence);
  });

  const resolutionViolations: CorpusEvaluation['resolutionViolations'] = [];
  (corpusCase.expectedNotResolved ?? []).forEach((rule) => {
    run.mentions.forEach((mention) => {
      if (
        mention.sceneId === rule.sceneId &&
        mention.surface.toLowerCase().includes(rule.surfaceIncludes.toLowerCase()) &&
        mention.entityId === rule.mustNotResolveTo
      ) {
        resolutionViolations.push({rule, mention});
      }
    });
  });

  const conflictViolations: CorpusEvaluation['conflictViolations'] = [];
  (corpusCase.expectedNoConflictFor ?? []).forEach(({entityId, knownGap}) => {
    const conflicts = run.findings.filter(
      (finding) => finding.code === 'STATE_CONFLICT' && finding.entityIds.includes(entityId)
    );
    if (conflicts.length > 0 && !knownGap) {
      conflicts.forEach((finding) => conflictViolations.push({entityId, finding}));
    }
    if (conflicts.length === 0 && knownGap) {
      healedKnownGaps.push({sceneId: '*', surface: `conflict:${entityId}`, reason: knownGap, knownGap});
    }
  });

  const sceneTextById = new Map(corpusCase.scenes.map((scene) => [scene.id, scene.text]));
  const unanchoredFindings = run.findings.filter((finding) => {
    const anchor = finding.focusText || finding.surface;
    if (!anchor) return false;
    return !(sceneTextById.get(finding.sceneId) ?? '').includes(anchor);
  });

  return {
    caseId: corpusCase.id,
    matched,
    missed,
    absenceViolations,
    healedKnownGaps,
    resolutionViolations,
    conflictViolations,
    unanchoredFindings,
    findings: run.findings
  };
}

export function summarizeCorpusEvaluations(evaluations: CorpusEvaluation[]): string {
  const expected = evaluations.reduce((sum, item) => sum + item.matched.length + item.missed.length, 0);
  const matched = evaluations.reduce((sum, item) => sum + item.matched.length, 0);
  const violations = evaluations.reduce((sum, item) => sum + item.absenceViolations.length, 0);
  const total = evaluations.reduce((sum, item) => sum + item.findings.length, 0);
  const recall = expected === 0 ? 1 : matched / expected;
  const precision = total === 0 ? 1 : (total - violations) / total;
  const lines = [
    `continuity corpus: ${evaluations.length} cases, ${expected} expected findings, ${matched} matched (recall ${(recall * 100).toFixed(0)}%), ` +
      `${total} findings produced, ${violations} planted-absence violations (precision floor ${(precision * 100).toFixed(0)}%)`
  ];
  evaluations.forEach((item) => {
    item.missed.forEach((expectedFinding) =>
      lines.push(`  MISSED  [${item.caseId}] ${expectedFinding.code} in ${expectedFinding.sceneId}: ${expectedFinding.surfaceIncludes ?? expectedFinding.entityId ?? ''} — ${expectedFinding.note}`)
    );
    item.absenceViolations.forEach(({absence, finding}) =>
      lines.push(`  NOISE   [${item.caseId}] "${finding.surface}" surfaced in ${absence.sceneId} (${absence.reason}) — ${finding.message}`)
    );
    item.resolutionViolations.forEach(({rule, mention}) =>
      lines.push(`  MISLINK [${item.caseId}] "${mention.surface}" resolved to ${rule.mustNotResolveTo} in ${rule.sceneId} — ${rule.reason}`)
    );
    item.conflictViolations.forEach(({entityId, finding}) =>
      lines.push(`  FALSE CONFLICT [${item.caseId}] ${entityId} in ${finding.sceneId} — ${finding.message}`)
    );
    item.unanchoredFindings.forEach((finding) =>
      lines.push(`  UNANCHORED [${item.caseId}] ${finding.code} in ${finding.sceneId}: "${finding.focusText || finding.surface}" is not verbatim scene text`)
    );
    item.healedKnownGaps.forEach((absence) =>
      lines.push(`  HEALED  [${item.caseId}] "${absence.surface}" no longer surfaces in ${absence.sceneId}; remove its knownGap from the corpus`)
    );
  });
  return lines.join('\n');
}
